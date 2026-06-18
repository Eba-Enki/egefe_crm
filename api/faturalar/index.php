<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'satis');

const DURUM_DEGERLERI = ['Ödendi','Ödenmedi'];



function faturaResponse(PDO $pdo, array $row): array {
    return [
        'id'              => $row['id'],
        'faturaNo'        => $row['fatura_no'],
        'siparisId'       => $row['siparis_id'],
        'siparisNo'       => $row['siparis_no'],
        'kurum'           => $row['kurum'],
        'tutar'           => (float)$row['tutar'],
        'paraBirimi'      => $row['para_birimi'],
        'faturaTarihi'    => $row['fatura_tarihi'],
        'vadeTarihi'      => $row['vade_tarihi'],
        'durum'           => $row['durum'],
        'olusturmaTarihi' => $row['created_at'],
    ];
}

// Tüm kalemler hem teslim hem faturalananı tam ise siparişi Fatura Edildi'ye taşır
function checkAutoFaturaEdildi(PDO $pdo, string $orderId): void {
    $stmt = $pdo->prepare('SELECT COUNT(*) AS eksik FROM order_line_items WHERE order_id = ? AND (gonderilen < miktar OR faturalanan < miktar)');
    $stmt->execute([$orderId]);
    if ((int)$stmt->fetch()['eksik'] === 0) {
        $pdo->prepare("UPDATE orders SET durum = 'Fatura Edildi' WHERE id = ? AND durum != 'Fatura Edildi'")->execute([$orderId]);
    }
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT i.*, o.siparis_no, o.kurum, o.para_birimi FROM invoices i JOIN orders o ON o.id = i.siparis_id ORDER BY i.created_at DESC');
        $rows = $stmt->fetchAll();
        echo json_encode(['faturalar' => array_map(fn(array $r) => faturaResponse($pdo, $r), $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $siparisId   = strOrNull($input['siparisId'] ?? null);
        $faturaNo    = strOrNull($input['faturaNo'] ?? null);
        $faturaTarihi = strOrNull($input['faturaTarihi'] ?? null);
        if (!$siparisId || !$faturaNo || !$faturaTarihi) {
            http_response_code(400);
            echo json_encode(['error' => 'siparisId, faturaNo ve faturaTarihi zorunlu']);
            exit;
        }

        $check = $pdo->prepare('SELECT id FROM orders WHERE id = ?');
        $check->execute([$siparisId]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Sipariş bulunamadı']);
            exit;
        }

        $dupe = $pdo->prepare('SELECT id FROM invoices WHERE fatura_no = ?');
        $dupe->execute([$faturaNo]);
        if ($dupe->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Bu fatura numarası zaten kullanılıyor']);
            exit;
        }

        // Kalem bazlı faturalanan miktarlar: ['sira' => miktar] veya sıralı dizi
        $satirFaturalananlar = $input['satirFaturalananlar'] ?? [];

        // Mevcut kalem satırlarını al
        $satirStmt = $pdo->prepare('SELECT * FROM order_line_items WHERE order_id = ? ORDER BY sira ASC, id ASC');
        $satirStmt->execute([$siparisId]);
        $kalemler = $satirStmt->fetchAll();

        $tutar = 0.0;
        $guncellemeler = [];
        foreach ($kalemler as $idx => $k) {
            $buSeferFaturalanan = (float)($satirFaturalananlar[$idx] ?? 0);
            if ($buSeferFaturalanan < 0) $buSeferFaturalanan = 0;
            $maxFaturalanabilir = (float)$k['miktar'] - (float)$k['faturalanan'];
            if ($buSeferFaturalanan > $maxFaturalanabilir) $buSeferFaturalanan = $maxFaturalanabilir;
            if ($buSeferFaturalanan > 0) {
                $tutar += $buSeferFaturalanan * (float)$k['birim_fiyat'];
                $guncellemeler[] = ['id' => $k['id'], 'artis' => $buSeferFaturalanan];
            }
        }

        if ($tutar <= 0 && empty($guncellemeler)) {
            http_response_code(400);
            echo json_encode(['error' => 'Faturalanacak kalem bulunamadı']);
            exit;
        }

        $id = 'ft' . (string)(int)round(microtime(true) * 1000);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO invoices (id, fatura_no, siparis_id, tutar, fatura_tarihi, vade_tarihi, durum) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $id, $faturaNo, $siparisId, round($tutar, 2), $faturaTarihi,
                strOrNull($input['vadeTarihi'] ?? null),
                'Ödenmedi',
            ]);

            $updStmt = $pdo->prepare('UPDATE order_line_items SET faturalanan = faturalanan + ? WHERE id = ?');
            foreach ($guncellemeler as $g) {
                $updStmt->execute([$g['artis'], $g['id']]);
            }

            checkAutoFaturaEdildi($pdo, $siparisId);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT i.*, o.siparis_no, o.kurum, o.para_birimi FROM invoices i JOIN orders o ON o.id = i.siparis_id WHERE i.id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['fatura' => faturaResponse($pdo, $stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (string)($input['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM invoices WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Fatura bulunamadı']);
            exit;
        }

        $faturaNo = strOrNull($input['faturaNo'] ?? $existing['fatura_no']);
        if ($faturaNo !== $existing['fatura_no']) {
            $dupe = $pdo->prepare('SELECT id FROM invoices WHERE fatura_no = ? AND id != ?');
            $dupe->execute([$faturaNo, $id]);
            if ($dupe->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Bu fatura numarası zaten kullanılıyor']);
                exit;
            }
        }

        $stmt = $pdo->prepare('UPDATE invoices SET fatura_no=?, fatura_tarihi=?, vade_tarihi=?, durum=? WHERE id=?');
        $stmt->execute([
            $faturaNo,
            strOrNull($input['faturaTarihi'] ?? $existing['fatura_tarihi']),
            strOrNull($input['vadeTarihi'] ?? $existing['vade_tarihi']),
            enumOrDefault($input['durum'] ?? $existing['durum'], DURUM_DEGERLERI, $existing['durum']),
            $id,
        ]);

        $stmt = $pdo->prepare('SELECT i.*, o.siparis_no, o.kurum, o.para_birimi FROM invoices i JOIN orders o ON o.id = i.siparis_id WHERE i.id = ?');
        $stmt->execute([$id]);
        echo json_encode(['fatura' => faturaResponse($pdo, $stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $stmt = $pdo->prepare('DELETE FROM invoices WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Fatura bulunamadı']);
            exit;
        }
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
