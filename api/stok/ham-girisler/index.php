<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

function strOrNull($value): ?string {
    $value = trim((string)($value ?? ''));
    return $value === '' ? null : $value;
}

function stokSPS(PDO $pdo, string $kategoriId): int {
    $stmt = $pdo->prepare('SELECT sheet_boyu, kesim_boleni, fire_pct FROM stock_categories WHERE id = ?');
    $stmt->execute([$kategoriId]);
    $k = $stmt->fetch();
    if (!$k || !$k['sheet_boyu'] || !$k['kesim_boleni']) return 90;
    return (int)round(((float)$k['sheet_boyu'] / (float)$k['kesim_boleni']) * (1 - (float)($k['fire_pct'] ?? 0) / 100));
}

function kalemResponse(array $row): array {
    return [
        'lotId'       => $row['id'],
        'lotNo'       => $row['lot_no'],
        'parametreAd' => $row['parametre_ad'],
        'cutoff'      => $row['cutoff'],
        'kategoriId'  => $row['kategori_id'],
        'sheetGiren'  => (int)$row['sheet_giren'],
        'stripGiren'  => (int)$row['strip_giren'],
        'sktTarih'    => $row['skt_tarih'],
    ];
}

function girisResponse(PDO $pdo, array $row): array {
    $stmt = $pdo->prepare('SELECT * FROM raw_stock_lots WHERE giris_id = ? ORDER BY id ASC');
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
        $stmt = $pdo->query('SELECT * FROM raw_stock_entries ORDER BY created_at DESC');
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
            if (strOrNull($k['kategoriId'] ?? null) === null || strOrNull($k['parametreAd'] ?? null) === null || strOrNull($k['lotNo'] ?? null) === null) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. kalemde kategori, parametre ve LOT No zorunludur']);
                exit;
            }
            if ((int)($k['sheetMiktar'] ?? 0) < 1) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. kalemde sheet miktarı geçersiz']);
                exit;
            }
        }

        $girisId = 'hg' . (string)(int)round(microtime(true) * 1000);
        $notlar = strOrNull($input['notlar'] ?? null);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO raw_stock_entries (id, evrak_no, tarih, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$girisId, $evrakNo, $tarih, $notlar, $user['id']]);

            $lotStmt = $pdo->prepare('INSERT INTO raw_stock_lots (id, giris_id, evrak_no, lot_no, tarih, parametre_ad, cutoff, kategori_id, sheet_giren, strip_giren, mevcut_strip, skt_tarih, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            foreach ($kalemler as $i => $k) {
                $kategoriId = (string)$k['kategoriId'];
                $sheetGiren = (int)$k['sheetMiktar'];
                $sps = stokSPS($pdo, $kategoriId);
                $stripGiren = $sheetGiren * $sps;
                $lotId = 'hl' . (string)(int)round(microtime(true) * 1000) . $i;
                $lotStmt->execute([
                    $lotId, $girisId, $evrakNo,
                    (string)$k['lotNo'], $tarih, (string)$k['parametreAd'],
                    strOrNull($k['cutoff'] ?? null), $kategoriId,
                    $sheetGiren, $stripGiren, $stripGiren,
                    strOrNull($k['sktTarih'] ?? null), $user['id'],
                ]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM raw_stock_entries WHERE id = ?');
        $stmt->execute([$girisId]);
        http_response_code(201);
        echo json_encode(['giris' => girisResponse($pdo, $stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = strOrNull($input['id'] ?? null);
        $evrakNo = strOrNull($input['evrakNo'] ?? null);
        $tarih = strOrNull($input['tarih'] ?? null);
        $kalemler = $input['kalemler'] ?? [];
        if (!$id || !$evrakNo || !$tarih) {
            http_response_code(400);
            echo json_encode(['error' => 'id, evrakNo ve tarih zorunludur']);
            exit;
        }
        if (!is_array($kalemler) || count($kalemler) === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'En az bir kalem ekleyin']);
            exit;
        }
        foreach ($kalemler as $i => $k) {
            if (strOrNull($k['kategoriId'] ?? null) === null || strOrNull($k['parametreAd'] ?? null) === null || strOrNull($k['lotNo'] ?? null) === null) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. kalemde kategori, parametre ve LOT No zorunludur']);
                exit;
            }
            if ((int)($k['sheetMiktar'] ?? 0) < 1) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. kalemde sheet miktarı geçersiz']);
                exit;
            }
        }

        $check = $pdo->prepare('SELECT * FROM raw_stock_entries WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Giriş belgesi bulunamadı']);
            exit;
        }

        $existingStmt = $pdo->prepare('SELECT * FROM raw_stock_lots WHERE giris_id = ?');
        $existingStmt->execute([$id]);
        $existingLots = [];
        foreach ($existingStmt->fetchAll() as $row) $existingLots[$row['id']] = $row;

        $updates = [];
        $inserts = [];
        $keptIds = [];
        foreach ($kalemler as $i => $k) {
            $kategoriId = (string)$k['kategoriId'];
            $sheetGiren = (int)$k['sheetMiktar'];
            $sps = stokSPS($pdo, $kategoriId);
            $stripGiren = $sheetGiren * $sps;
            $lotId = strOrNull($k['lotId'] ?? null);
            $kalemData = [
                'lotNo' => (string)$k['lotNo'], 'parametreAd' => (string)$k['parametreAd'],
                'cutoff' => strOrNull($k['cutoff'] ?? null), 'kategoriId' => $kategoriId,
                'sheetGiren' => $sheetGiren, 'stripGiren' => $stripGiren,
                'sktTarih' => strOrNull($k['sktTarih'] ?? null),
            ];
            if ($lotId !== null && isset($existingLots[$lotId])) {
                $old = $existingLots[$lotId];
                $newMevcut = (int)$old['mevcut_strip'] + ($stripGiren - (int)$old['strip_giren']);
                if ($newMevcut < 0) {
                    http_response_code(400);
                    echo json_encode(['error' => $old['lot_no'] . ' LOT\'unda kullanılmış stok mevcut girişten fazla, sheet miktarını azaltamazsınız.']);
                    exit;
                }
                $kalemData['mevcutStrip'] = $newMevcut;
                $updates[$lotId] = $kalemData;
                $keptIds[] = $lotId;
            } else {
                $inserts[] = $kalemData;
            }
        }
        $removals = [];
        foreach ($existingLots as $lotId => $old) {
            if (in_array($lotId, $keptIds, true)) continue;
            if ((int)$old['mevcut_strip'] !== (int)$old['strip_giren']) {
                http_response_code(400);
                echo json_encode(['error' => $old['lot_no'] . ' LOT\'undan stok kullanıldığı için kaldırılamaz.']);
                exit;
            }
            $removals[] = $lotId;
        }

        $notlar = strOrNull($input['notlar'] ?? null);

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE raw_stock_entries SET evrak_no=?, tarih=?, notlar=? WHERE id=?')
                ->execute([$evrakNo, $tarih, $notlar, $id]);

            $updStmt = $pdo->prepare('UPDATE raw_stock_lots SET evrak_no=?, lot_no=?, tarih=?, parametre_ad=?, cutoff=?, kategori_id=?, sheet_giren=?, strip_giren=?, mevcut_strip=?, skt_tarih=? WHERE id=?');
            foreach ($updates as $lotId => $u) {
                $updStmt->execute([$evrakNo, $u['lotNo'], $tarih, $u['parametreAd'], $u['cutoff'], $u['kategoriId'], $u['sheetGiren'], $u['stripGiren'], $u['mevcutStrip'], $u['sktTarih'], $lotId]);
            }

            $insStmt = $pdo->prepare('INSERT INTO raw_stock_lots (id, giris_id, evrak_no, lot_no, tarih, parametre_ad, cutoff, kategori_id, sheet_giren, strip_giren, mevcut_strip, skt_tarih, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            foreach ($inserts as $i => $u) {
                $newLotId = 'hl' . (string)(int)round(microtime(true) * 1000) . $i;
                $insStmt->execute([$newLotId, $id, $evrakNo, $u['lotNo'], $tarih, $u['parametreAd'], $u['cutoff'], $u['kategoriId'], $u['sheetGiren'], $u['stripGiren'], $u['stripGiren'], $u['sktTarih'], $user['id']]);
            }

            if ($removals) {
                $placeholders = implode(',', array_fill(0, count($removals), '?'));
                $pdo->prepare("DELETE FROM raw_stock_lots WHERE id IN ($placeholders)")->execute($removals);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM raw_stock_entries WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['giris' => girisResponse($pdo, $stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $lotStmt = $pdo->prepare('SELECT * FROM raw_stock_lots WHERE giris_id = ?');
        $lotStmt->execute([$id]);
        foreach ($lotStmt->fetchAll() as $lot) {
            if ((int)$lot['mevcut_strip'] !== (int)$lot['strip_giren']) {
                http_response_code(400);
                echo json_encode(['error' => $lot['lot_no'] . ' LOT\'undan stok kullanıldığı için bu giriş silinemez.']);
                exit;
            }
        }
        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM raw_stock_lots WHERE giris_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM raw_stock_entries WHERE id = ?')->execute([$id]);
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
