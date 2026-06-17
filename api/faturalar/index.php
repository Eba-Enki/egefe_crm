<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'satis');

const DURUM_DEGERLERI = ['Ödendi','Ödenmedi'];



function faturaTutar(PDO $pdo, string $siparisId): float {
    $stmt = $pdo->prepare('SELECT COALESCE(SUM(miktar * birim_fiyat), 0) AS tutar FROM order_line_items WHERE order_id = ?');
    $stmt->execute([$siparisId]);
    return (float)($stmt->fetch()['tutar'] ?? 0);
}

function faturaResponse(PDO $pdo, array $row): array {
    return [
        'id'              => $row['id'],
        'faturaNo'        => $row['fatura_no'],
        'siparisId'       => $row['siparis_id'],
        'siparisNo'       => $row['siparis_no'],
        'kurum'           => $row['kurum'],
        'tutar'           => isset($row['tutar']) ? (float)$row['tutar'] : faturaTutar($pdo, $row['siparis_id']),
        'paraBirimi'      => $row['para_birimi'],
        'faturaTarihi'    => $row['fatura_tarihi'],
        'vadeTarihi'      => $row['vade_tarihi'],
        'durum'           => $row['durum'],
        'olusturmaTarihi' => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT i.*, o.siparis_no, o.kurum, o.para_birimi, COALESCE(SUM(oli.miktar * oli.birim_fiyat), 0) AS tutar FROM invoices i JOIN orders o ON o.id = i.siparis_id LEFT JOIN order_line_items oli ON oli.order_id = i.siparis_id GROUP BY i.id ORDER BY i.created_at DESC');
        $rows = $stmt->fetchAll();
        echo json_encode(['faturalar' => array_map(fn(array $r) => faturaResponse($pdo, $r), $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $siparisId = strOrNull($input['siparisId'] ?? null);
        $faturaNo = strOrNull($input['faturaNo'] ?? null);
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

        $id = 'ft' . (string)(int)round(microtime(true) * 1000);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO invoices (id, fatura_no, siparis_id, fatura_tarihi, vade_tarihi, durum) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $id, $faturaNo, $siparisId, $faturaTarihi,
                strOrNull($input['vadeTarihi'] ?? null),
                'Ödenmedi',
            ]);
            $pdo->prepare("UPDATE orders SET durum = 'Fatura Edildi' WHERE id = ?")->execute([$siparisId]);
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
