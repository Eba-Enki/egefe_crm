<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');


function kalemResponse(array $row): array {
    return [
        'lotId'           => $row['lot_id'],
        'lotNo'           => $row['lot_no'],
        'urunAdi'         => $row['urun_adi'],
        'kategoriId'      => $row['lot_kategori_id'],
        'sistemMiktar'    => (float)$row['sistem_miktar'],
        'sayilanMiktar'   => (float)$row['sayilan_miktar'],
        'duzeltmeEvrakNo' => $row['duzeltme_evrak_no'],
    ];
}

function fetchKalemler(PDO $pdo, string $countId): array {
    $stmt = $pdo->prepare('SELECT i.*, l.lot_no, l.kategori_id AS lot_kategori_id FROM finished_stock_count_items i LEFT JOIN finished_stock_lots l ON l.id = i.lot_id WHERE i.count_id = ? ORDER BY i.id ASC');
    $stmt->execute([$countId]);
    return array_map('kalemResponse', $stmt->fetchAll());
}

function sayimResponse(PDO $pdo, array $row, ?array $kalemler = null): array {
    return [
        'id'                 => $row['id'],
        'evrakNo'            => $row['evrak_no'],
        'tarih'              => $row['tarih'],
        'kategoriId'         => $row['kategori_id'],
        'notlar'             => $row['notlar'],
        'kalemler'           => $kalemler ?? fetchKalemler($pdo, $row['id']),
        'olusturanKullanici' => $row['olusturan_kullanici'],
        'olusturmaTarihi'    => $row['created_at'],
    ];
}

function nextBitmisSayimEvrak(PDO $pdo): string {
    $prefix = 'BSY';
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['stok']);
    $row = $stmt->fetch();
    if ($row) {
        $data = json_decode($row['data'], true) ?? [];
        if (!empty($data['bitmisSayimPrefix'])) $prefix = (string)$data['bitmisSayimPrefix'];
    }

    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(evrak_no, ?) AS UNSIGNED)) AS mx FROM finished_stock_counts WHERE evrak_no LIKE CONCAT(?, '-%')");
    $stmt->execute([strlen($prefix) + 2, $prefix]);
    $mx = (int)($stmt->fetch()['mx'] ?? 0);

    return $prefix . '-' . str_pad((string)($mx + 1), 5, '0', STR_PAD_LEFT);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM finished_stock_counts ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();

        $kalemlerMap = [];
        if ($rows) {
            $ids = array_column($rows, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $kalemStmt = $pdo->prepare("SELECT i.*, l.lot_no, l.kategori_id AS lot_kategori_id FROM finished_stock_count_items i LEFT JOIN finished_stock_lots l ON l.id = i.lot_id WHERE i.count_id IN ($placeholders) ORDER BY i.count_id, i.id ASC");
            $kalemStmt->execute($ids);
            foreach ($kalemStmt->fetchAll() as $k) {
                $kalemlerMap[$k['count_id']][] = kalemResponse($k);
            }
        }

        echo json_encode(['sayimlar' => array_map(
            fn(array $r) => sayimResponse($pdo, $r, $kalemlerMap[$r['id']] ?? []),
            $rows
        )]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $tarih = strOrNull($input['tarih'] ?? null);
        $kategoriId = strOrNull($input['kategoriId'] ?? null);
        $notlar = strOrNull($input['notlar'] ?? null);
        $kalemler = $input['kalemler'] ?? [];

        if (!$tarih) {
            http_response_code(400);
            echo json_encode(['error' => 'tarih zorunludur']);
            exit;
        }
        if (!is_array($kalemler) || count($kalemler) === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'En az bir LOT sayılmalı']);
            exit;
        }

        $items = [];
        foreach ($kalemler as $i => $k) {
            $lotId = strOrNull($k['lotId'] ?? null);
            if (!$lotId) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. kalemde LOT eksik']);
                exit;
            }
            if (!isset($k['sayilanMiktar']) || $k['sayilanMiktar'] === '' || (float)$k['sayilanMiktar'] < 0) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. kalemde sayılan miktar geçersiz']);
                exit;
            }
            $stmt = $pdo->prepare('SELECT * FROM finished_stock_lots WHERE id = ?');
            $stmt->execute([$lotId]);
            $lot = $stmt->fetch();
            if (!$lot) {
                http_response_code(404);
                echo json_encode(['error' => 'Seçili LOT bulunamadı']);
                exit;
            }
            // Sistem miktarı, sayım kaydedildiği andaki mevcut_miktar değerinin anlık görüntüsüdür.
            $items[] = ['lot' => $lot, 'sistemMiktar' => (float)$lot['mevcut_miktar'], 'sayilanMiktar' => (float)$k['sayilanMiktar']];
        }

        $evrakNo = strOrNull($input['evrakNo'] ?? null) ?? nextBitmisSayimEvrak($pdo);
        $id = 'bs' . (string)(int)round(microtime(true) * 1000);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO finished_stock_counts (id, evrak_no, tarih, kategori_id, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$id, $evrakNo, $tarih, $kategoriId, $notlar, $user['id']]);

            $itemStmt = $pdo->prepare('INSERT INTO finished_stock_count_items (count_id, lot_id, urun_adi, sistem_miktar, sayilan_miktar) VALUES (?, ?, ?, ?, ?)');
            foreach ($items as $it) {
                $itemStmt->execute([$id, $it['lot']['id'], $it['lot']['urun_adi'], $it['sistemMiktar'], $it['sayilanMiktar']]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM finished_stock_counts WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['sayim' => sayimResponse($pdo, $stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM finished_stock_counts WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Sayım kaydı bulunamadı']);
            exit;
        }

        $pdo->prepare('DELETE FROM finished_stock_counts WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
