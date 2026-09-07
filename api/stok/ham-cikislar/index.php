<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');


function stokSPS(PDO $pdo, string $kategoriId): int {
    $stmt = $pdo->prepare('SELECT sheet_boyu, kesim_boleni, fire_pct FROM stock_categories WHERE id = ?');
    $stmt->execute([$kategoriId]);
    $k = $stmt->fetch();
    if (!$k || !$k['sheet_boyu'] || !$k['kesim_boleni']) return 90;
    return (int)round(((float)$k['sheet_boyu'] / (float)$k['kesim_boleni']) * (1 - (float)($k['fire_pct'] ?? 0) / 100));
}

function mapSatirRow(array $row): array {
    // fire, kesilen sheete EK tüketimdir; kullanılabilir (kit'e sayılan) miktar kesilenden düşülmez.
    $stripCikis = (int)$row['strip_cikis'];
    return [
        'lotId'              => $row['lot_id'],
        'lotNo'              => $row['lot_no'],
        'parametreAd'        => $row['parametre_ad'],
        'cutoff'             => $row['cutoff'],
        'ekOzellik'          => $row['ek_ozellik'],
        'kategoriId'         => $row['lot_kategori_id'],
        'sheetCikis'         => (float)$row['sheet_cikis'],
        'stripCikis'         => $stripCikis,
        'fireSheet'          => (float)$row['fire_sheet'],
        'fireStrip'          => (int)$row['fire_strip'],
        'kullanilabilirStrip'=> $stripCikis,
    ];
}

function fetchSatirlar(PDO $pdo, string $exitId): array {
    $stmt = $pdo->prepare('SELECT i.*, l.lot_no, l.cutoff, l.ek_ozellik, l.kategori_id AS lot_kategori_id FROM raw_stock_exit_items i LEFT JOIN raw_stock_lots l ON l.id = i.lot_id WHERE i.exit_id = ? ORDER BY i.id ASC');
    $stmt->execute([$exitId]);
    return array_map('mapSatirRow', $stmt->fetchAll());
}

function cikisResponse(PDO $pdo, array $row, ?array $satirlar = null): array {
    return [
        'id'                 => $row['id'],
        'evrakNo'            => $row['evrak_no'],
        'tarih'              => $row['tarih'],
        'kategoriId'         => $row['kategori_id'],
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
            $satirStmt = $pdo->prepare("SELECT i.*, l.lot_no, l.cutoff, l.ek_ozellik, l.kategori_id AS lot_kategori_id FROM raw_stock_exit_items i LEFT JOIN raw_stock_lots l ON l.id = i.lot_id WHERE i.exit_id IN ($placeholders) ORDER BY i.exit_id, i.id ASC");
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
        $aciklama = strOrNull($input['aciklama'] ?? null);
        $satirlar = $input['satirlar'] ?? [];

        if (!$tarih || !$kategoriId) {
            http_response_code(400);
            echo json_encode(['error' => 'tarih ve kategoriId zorunludur']);
            exit;
        }
        if (!$aciklama) {
            http_response_code(400);
            echo json_encode(['error' => 'Müşteri / Amaç zorunludur']);
            exit;
        }
        if (!is_array($satirlar) || count($satirlar) === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'En az bir satır ekleyin']);
            exit;
        }

        $lots = [];
        foreach ($satirlar as $i => $s) {
            $paramKey = strOrNull($s['paramKey'] ?? null);
            $lotId = strOrNull($s['lotId'] ?? null);
            $sheetMiktar = (float)($s['sheetMiktar'] ?? 0);
            $fireSheet = (float)($s['fireSheet'] ?? 0);
            if (!$paramKey || !$lotId) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. satırda parametre veya LOT seçilmedi']);
                exit;
            }
            if ($sheetMiktar <= 0) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. satırda kesilen sheet miktarı geçersiz']);
                exit;
            }
            if ($fireSheet < 0) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. satırda fire miktarı geçersiz']);
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
            $sps = stokSPS($pdo, (string)$lot['kategori_id']);
            // Fire, kesilen sheete EK olarak tüketilen malzemedir (kesilen + fire = stoktan
            // düşülecek toplam). Strip'i tek seferde toplam sheet üzerinden yuvarlıyoruz ki
            // ayrı ayrı yuvarlanan parçaların toplamı gerçek toplamdan fazla çıkmasın.
            $totalSheet = $sheetMiktar + $fireSheet;
            $totalStrip = (int)round($totalSheet * $sps);
            $usableStrip = min((int)round($sheetMiktar * $sps), $totalStrip);
            $fireStrip = $totalStrip - $usableStrip;
            if ($totalStrip > (int)$lot['mevcut_strip']) {
                http_response_code(400);
                echo json_encode(['error' => $lot['parametre_ad'] . ' (' . $lot['lot_no'] . ') için yeterli stok yok. Mevcut: ' . $lot['mevcut_strip'] . ' strip, istenen: ' . $totalStrip . ' strip']);
                exit;
            }
            $lots[] = ['paramKey' => $paramKey, 'lot' => $lot, 'sheetMiktar' => $sheetMiktar, 'stripCikis' => $usableStrip, 'fireSheet' => $fireSheet, 'fireStrip' => $fireStrip, 'totalSheet' => $totalSheet, 'totalStrip' => $totalStrip];
        }

        $evrakNo = strOrNull($input['evrakNo'] ?? null) ?? nextHamCikisEvrak($pdo);
        $id = 'hc' . (string)(int)round(microtime(true) * 1000);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO raw_stock_exits (id, evrak_no, tarih, kategori_id, aciklama, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$id, $evrakNo, $tarih, $kategoriId, $aciklama, strOrNull($input['notlar'] ?? null), $user['id']]);

            $itemStmt = $pdo->prepare('INSERT INTO raw_stock_exit_items (exit_id, lot_id, sheet_cikis, strip_cikis, fire_sheet, fire_strip, parametre_ad) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $decStmt = $pdo->prepare('UPDATE raw_stock_lots SET mevcut_strip = mevcut_strip - ?, mevcut_sheet = GREATEST(0, mevcut_sheet - ?) WHERE id = ?');
            foreach ($lots as $l) {
                $itemStmt->execute([$id, $l['lot']['id'], $l['sheetMiktar'], $l['stripCikis'], $l['fireSheet'], $l['fireStrip'], $l['paramKey']]);
                $decStmt->execute([$l['totalStrip'], $l['totalSheet'], $l['lot']['id']]);
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

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = strOrNull($input['id'] ?? null);
        $tarih = strOrNull($input['tarih'] ?? null);
        $kategoriId = strOrNull($input['kategoriId'] ?? null);
        $aciklama = strOrNull($input['aciklama'] ?? null);
        $satirlar = $input['satirlar'] ?? [];

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        if (!$tarih || !$kategoriId) {
            http_response_code(400);
            echo json_encode(['error' => 'tarih ve kategoriId zorunludur']);
            exit;
        }
        if (!$aciklama) {
            http_response_code(400);
            echo json_encode(['error' => 'Müşteri / Amaç zorunludur']);
            exit;
        }
        if (!is_array($satirlar) || count($satirlar) === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'En az bir satır ekleyin']);
            exit;
        }

        $existsStmt = $pdo->prepare('SELECT * FROM raw_stock_exits WHERE id = ?');
        $existsStmt->execute([$id]);
        $existing = $existsStmt->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Çıkış bulunamadı']);
            exit;
        }

        $evrakNo = strOrNull($input['evrakNo'] ?? null) ?? $existing['evrak_no'];

        $pdo->beginTransaction();
        try {
            // Eski satırların stok etkisini geri al, sonra POST ile aynı mantıkla yeniden uygula.
            // Fire, kesilene EK olduğu için geri iadede de sheet_cikis+fire_sheet ve strip_cikis+fire_strip toplanır.
            $oldItems = $pdo->prepare('SELECT lot_id, sheet_cikis, strip_cikis, fire_sheet, fire_strip FROM raw_stock_exit_items WHERE exit_id = ?');
            $oldItems->execute([$id]);
            $revertStmt = $pdo->prepare('UPDATE raw_stock_lots SET mevcut_strip = mevcut_strip + ?, mevcut_sheet = mevcut_sheet + ? WHERE id = ?');
            foreach ($oldItems->fetchAll() as $oi) {
                if ($oi['lot_id']) $revertStmt->execute([(float)$oi['strip_cikis'] + (float)$oi['fire_strip'], (float)$oi['sheet_cikis'] + (float)$oi['fire_sheet'], $oi['lot_id']]);
            }
            $pdo->prepare('DELETE FROM raw_stock_exit_items WHERE exit_id = ?')->execute([$id]);

            $lots = [];
            foreach ($satirlar as $i => $s) {
                $paramKey = strOrNull($s['paramKey'] ?? null);
                $lotId = strOrNull($s['lotId'] ?? null);
                $sheetMiktar = (float)($s['sheetMiktar'] ?? 0);
                $fireSheet = (float)($s['fireSheet'] ?? 0);
                if (!$paramKey || !$lotId) {
                    throw new RuntimeException((($i + 1)) . '. satırda parametre veya LOT seçilmedi');
                }
                if ($sheetMiktar <= 0) {
                    throw new RuntimeException((($i + 1)) . '. satırda kesilen sheet miktarı geçersiz');
                }
                if ($fireSheet < 0) {
                    throw new RuntimeException((($i + 1)) . '. satırda fire miktarı geçersiz');
                }
                $stmt = $pdo->prepare('SELECT * FROM raw_stock_lots WHERE id = ?');
                $stmt->execute([$lotId]);
                $lot = $stmt->fetch();
                if (!$lot) {
                    throw new RuntimeException('Seçili LOT bulunamadı');
                }
                $sps = stokSPS($pdo, (string)$lot['kategori_id']);
                $totalSheet = $sheetMiktar + $fireSheet;
                $totalStrip = (int)round($totalSheet * $sps);
                $usableStrip = min((int)round($sheetMiktar * $sps), $totalStrip);
                $fireStrip = $totalStrip - $usableStrip;
                if ($totalStrip > (int)$lot['mevcut_strip']) {
                    throw new RuntimeException($lot['parametre_ad'] . ' (' . $lot['lot_no'] . ') için yeterli stok yok. Mevcut: ' . $lot['mevcut_strip'] . ' strip, istenen: ' . $totalStrip . ' strip');
                }
                $lots[] = ['paramKey' => $paramKey, 'lot' => $lot, 'sheetMiktar' => $sheetMiktar, 'stripCikis' => $usableStrip, 'fireSheet' => $fireSheet, 'fireStrip' => $fireStrip, 'totalSheet' => $totalSheet, 'totalStrip' => $totalStrip];
            }

            $pdo->prepare('UPDATE raw_stock_exits SET evrak_no=?, tarih=?, kategori_id=?, aciklama=?, notlar=? WHERE id=?')
                ->execute([$evrakNo, $tarih, $kategoriId, $aciklama, strOrNull($input['notlar'] ?? null), $id]);

            $itemStmt = $pdo->prepare('INSERT INTO raw_stock_exit_items (exit_id, lot_id, sheet_cikis, strip_cikis, fire_sheet, fire_strip, parametre_ad) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $decStmt = $pdo->prepare('UPDATE raw_stock_lots SET mevcut_strip = mevcut_strip - ?, mevcut_sheet = GREATEST(0, mevcut_sheet - ?) WHERE id = ?');
            foreach ($lots as $l) {
                $itemStmt->execute([$id, $l['lot']['id'], $l['sheetMiktar'], $l['stripCikis'], $l['fireSheet'], $l['fireStrip'], $l['paramKey']]);
                $decStmt->execute([$l['totalStrip'], $l['totalSheet'], $l['lot']['id']]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['error' => $e->getMessage() ?: 'Çıkış güncellenemedi']);
            exit;
        }

        $stmt = $pdo->prepare('SELECT * FROM raw_stock_exits WHERE id = ?');
        $stmt->execute([$id]);
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
            $items = $pdo->prepare('SELECT lot_id, sheet_cikis, strip_cikis, fire_sheet, fire_strip FROM raw_stock_exit_items WHERE exit_id = ?');
            $items->execute([$id]);
            $incStmt = $pdo->prepare('UPDATE raw_stock_lots SET mevcut_strip = mevcut_strip + ?, mevcut_sheet = mevcut_sheet + ? WHERE id = ?');
            foreach ($items->fetchAll() as $item) {
                if ($item['lot_id']) {
                    $incStmt->execute([(float)$item['strip_cikis'] + (float)$item['fire_strip'], (float)$item['sheet_cikis'] + (float)$item['fire_sheet'], $item['lot_id']]);
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
