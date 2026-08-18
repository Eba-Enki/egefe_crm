<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');


function mapSatirRow(array $row): array {
    return [
        'lotId'       => $row['lot_id'],
        'lotNo'       => $row['lot_no'],
        'parametreAd' => $row['parametre_ad'],
        'cutoff'      => $row['cutoff'],
        'kategoriId'  => $row['lot_kategori_id'],
        'stripCikis'  => (int)$row['strip_cikis'],
    ];
}

function fetchSatirlar(PDO $pdo, string $exitId): array {
    $stmt = $pdo->prepare('SELECT i.*, l.lot_no, l.cutoff, l.kategori_id AS lot_kategori_id FROM raw_stock_exit_items i LEFT JOIN raw_stock_lots l ON l.id = i.lot_id WHERE i.exit_id = ? ORDER BY i.id ASC');
    $stmt->execute([$exitId]);
    return array_map('mapSatirRow', $stmt->fetchAll());
}

function cikisResponse(PDO $pdo, array $row, ?array $satirlar = null): array {
    return [
        'id'                 => $row['id'],
        'evrakNo'            => $row['evrak_no'],
        'tarih'              => $row['tarih'],
        'kategoriId'         => $row['kategori_id'],
        'kitMiktari'         => $row['kit_miktari'] !== null ? (int)$row['kit_miktari'] : null,
        'aciklama'           => $row['aciklama'],
        'notlar'             => $row['notlar'],
        'satirlar'           => $satirlar ?? fetchSatirlar($pdo, $row['id']),
        'olusturanKullanici' => $row['olusturan_kullanici'],
        'olusturmaTarihi'    => $row['created_at'],
    ];
}

function nextHamCikisEvrak(PDO $pdo): string {
    $prefix = 'HC';
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['stok']);
    $row = $stmt->fetch();
    if ($row) {
        $data = json_decode($row['data'], true) ?? [];
        if (!empty($data['hamCikisPrefix'])) $prefix = (string)$data['hamCikisPrefix'];
    }

    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(evrak_no, ?) AS UNSIGNED)) AS mx FROM raw_stock_exits WHERE evrak_no LIKE CONCAT(?, '-%')");
    $stmt->execute([strlen($prefix) + 2, $prefix]);
    $mx = (int)($stmt->fetch()['mx'] ?? 0);

    return $prefix . '-' . str_pad((string)($mx + 1), 5, '0', STR_PAD_LEFT);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM raw_stock_exits ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();

        $satirlarMap = [];
        if ($rows) {
            $ids = array_column($rows, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $satirStmt = $pdo->prepare("SELECT i.*, l.lot_no, l.cutoff, l.kategori_id AS lot_kategori_id FROM raw_stock_exit_items i LEFT JOIN raw_stock_lots l ON l.id = i.lot_id WHERE i.exit_id IN ($placeholders) ORDER BY i.exit_id, i.id ASC");
            $satirStmt->execute($ids);
            foreach ($satirStmt->fetchAll() as $s) {
                $satirlarMap[$s['exit_id']][] = mapSatirRow($s);
            }
        }

        echo json_encode(['cikislar' => array_map(
            fn(array $r) => cikisResponse($pdo, $r, $satirlarMap[$r['id']] ?? []),
            $rows
        )]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $tarih = strOrNull($input['tarih'] ?? null);
        $kategoriId = strOrNull($input['kategoriId'] ?? null);
        $kitMiktari = (int)($input['kitMiktari'] ?? 0);
        $aciklama = strOrNull($input['aciklama'] ?? null);
        $satirlar = $input['satirlar'] ?? [];

        if (!$tarih || !$kategoriId) {
            http_response_code(400);
            echo json_encode(['error' => 'tarih ve kategoriId zorunludur']);
            exit;
        }
        if ($kitMiktari < 1) {
            http_response_code(400);
            echo json_encode(['error' => 'Kit miktarı geçerli olmalı']);
            exit;
        }
        if (!$aciklama) {
            http_response_code(400);
            echo json_encode(['error' => 'Müşteri / Amaç zorunludur']);
            exit;
        }
        if (!is_array($satirlar) || count($satirlar) === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'En az bir parametre satırı ekleyin']);
            exit;
        }

        $lots = [];
        $paramTotals = [];
        foreach ($satirlar as $i => $s) {
            $paramKey = strOrNull($s['paramKey'] ?? null);
            $lotId = strOrNull($s['lotId'] ?? null);
            $miktar = (int)($s['miktar'] ?? 0);
            if (!$paramKey || !$lotId) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. satırda parametre veya LOT seçilmedi']);
                exit;
            }
            if ($miktar < 1) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. satırda miktar geçersiz']);
                exit;
            }
            $stmt = $pdo->prepare('SELECT * FROM raw_stock_lots WHERE id = ?');
            $stmt->execute([$lotId]);
            $lot = $stmt->fetch();
            if (!$lot) {
                http_response_code(404);
                echo json_encode(['error' => 'Seçili LOT bulunamadı']);
                exit;
            }
            if ($miktar > (int)$lot['mevcut_strip']) {
                http_response_code(400);
                echo json_encode(['error' => $lot['parametre_ad'] . ' (' . $lot['lot_no'] . ') için yeterli stok yok. Mevcut: ' . $lot['mevcut_strip'] . ' strip']);
                exit;
            }
            $paramTotals[$paramKey] = ($paramTotals[$paramKey] ?? 0) + $miktar;
            $lots[] = ['paramKey' => $paramKey, 'lot' => $lot, 'miktar' => $miktar];
        }
        foreach ($paramTotals as $paramKey => $total) {
            if ($total !== $kitMiktari) {
                http_response_code(400);
                echo json_encode(['error' => $paramKey . ' için dağıtılan miktar (' . $total . ') kit miktarına (' . $kitMiktari . ') eşit değil']);
                exit;
            }
        }

        $evrakNo = strOrNull($input['evrakNo'] ?? null) ?? nextHamCikisEvrak($pdo);
        $id = 'hc' . (string)(int)round(microtime(true) * 1000);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO raw_stock_exits (id, evrak_no, tarih, kategori_id, aciklama, notlar, kit_miktari, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$id, $evrakNo, $tarih, $kategoriId, $aciklama, strOrNull($input['notlar'] ?? null), $kitMiktari, $user['id']]);

            $itemStmt = $pdo->prepare('INSERT INTO raw_stock_exit_items (exit_id, lot_id, strip_cikis, parametre_ad) VALUES (?, ?, ?, ?)');
            $decStmt = $pdo->prepare('UPDATE raw_stock_lots SET mevcut_strip = mevcut_strip - ? WHERE id = ?');
            foreach ($lots as $l) {
                $itemStmt->execute([$id, $l['lot']['id'], $l['miktar'], $l['paramKey']]);
                $decStmt->execute([$l['miktar'], $l['lot']['id']]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM raw_stock_exits WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['cikis' => cikisResponse($pdo, $stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM raw_stock_exits WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Çıkış bulunamadı']);
            exit;
        }

        $pdo->beginTransaction();
        try {
            $items = $pdo->prepare('SELECT lot_id, strip_cikis FROM raw_stock_exit_items WHERE exit_id = ?');
            $items->execute([$id]);
            $incStmt = $pdo->prepare('UPDATE raw_stock_lots SET mevcut_strip = mevcut_strip + ? WHERE id = ?');
            foreach ($items->fetchAll() as $item) {
                if ($item['lot_id']) {
                    $incStmt->execute([$item['strip_cikis'], $item['lot_id']]);
                }
            }
            $pdo->prepare('DELETE FROM raw_stock_exits WHERE id = ?')->execute([$id]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
