<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

function strOrNull($value): ?string {
    $value = trim((string)($value ?? ''));
    return $value === '' ? null : $value;
}

function kalemResponse(array $row): array {
    return [
        'lotId'        => $row['id'],
        'lotNo'        => $row['lot_no'],
        'urunAdi'      => $row['urun_adi'],
        'kategoriId'   => $row['kategori_id'],
        'parametreler' => $row['parametreler'] ? json_decode($row['parametreler'], true) : [],
        'miktar'       => (float)$row['miktar'],
        'sktTarih'     => $row['skt_tarih'],
    ];
}

function girisResponse(PDO $pdo, array $row): array {
    $stmt = $pdo->prepare('SELECT * FROM finished_stock_lots WHERE giris_id = ? ORDER BY id ASC');
    $stmt->execute([$row['id']]);
    return [
        'id'                 => $row['id'],
        'evrakNo'            => $row['evrak_no'],
        'tarih'              => $row['tarih'],
        'notlar'             => $row['notlar'],
        'kalemler'           => array_map('kalemResponse', $stmt->fetchAll()),
        'olusturanKullanici' => $row['olusturan_kullanici'],
        'olusturmaTarihi'    => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM finished_stock_entries ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();
        echo json_encode(['girisler' => array_map(fn(array $r) => girisResponse($pdo, $r), $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $evrakNo = strOrNull($input['evrakNo'] ?? null);
        $tarih = strOrNull($input['tarih'] ?? null);
        $kalemler = $input['kalemler'] ?? [];
        if (!$evrakNo || !$tarih) {
            http_response_code(400);
            echo json_encode(['error' => 'evrakNo ve tarih zorunludur']);
            exit;
        }
        if (!is_array($kalemler) || count($kalemler) === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'En az bir kalem ekleyin']);
            exit;
        }
        foreach ($kalemler as $i => $k) {
            if (strOrNull($k['kategoriId'] ?? null) === null || strOrNull($k['urunAdi'] ?? null) === null || strOrNull($k['lotNo'] ?? null) === null) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. kalemde kategori, ürün adı ve LOT No zorunludur']);
                exit;
            }
            if ((float)($k['miktar'] ?? 0) < 1) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. kalemde miktar geçersiz']);
                exit;
            }
        }

        $girisId = 'bg' . (string)(int)round(microtime(true) * 1000);
        $notlar = strOrNull($input['notlar'] ?? null);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO finished_stock_entries (id, evrak_no, tarih, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$girisId, $evrakNo, $tarih, $notlar, $user['id']]);

            $lotStmt = $pdo->prepare('INSERT INTO finished_stock_lots (id, giris_id, evrak_no, lot_no, tarih, urun_adi, kategori_id, parametreler, miktar, mevcut_miktar, skt_tarih, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            foreach ($kalemler as $i => $k) {
                $miktar = (float)$k['miktar'];
                $lotId = 'bl' . (string)(int)round(microtime(true) * 1000) . $i;
                $lotStmt->execute([
                    $lotId, $girisId, $evrakNo,
                    (string)$k['lotNo'], $tarih, (string)$k['urunAdi'], (string)$k['kategoriId'],
                    json_encode($k['parametreler'] ?? [], JSON_UNESCAPED_UNICODE),
                    $miktar, $miktar,
                    strOrNull($k['sktTarih'] ?? null), $user['id'],
                ]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM finished_stock_entries WHERE id = ?');
        $stmt->execute([$girisId]);
        http_response_code(201);
        echo json_encode(['giris' => girisResponse($pdo, $stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $pdo->prepare('DELETE FROM finished_stock_entries WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
