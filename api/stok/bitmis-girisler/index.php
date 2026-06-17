<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');


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

function girisResponse(PDO $pdo, array $row, ?array $kalemler = null): array {
    if ($kalemler === null) {
        $stmt = $pdo->prepare('SELECT * FROM finished_stock_lots WHERE giris_id = ? ORDER BY id ASC');
        $stmt->execute([$row['id']]);
        $kalemler = array_map('kalemResponse', $stmt->fetchAll());
    }
    return [
        'id'                 => $row['id'],
        'evrakNo'            => $row['evrak_no'],
        'tarih'              => $row['tarih'],
        'notlar'             => $row['notlar'],
        'kalemler'           => $kalemler,
        'olusturanKullanici' => $row['olusturan_kullanici'],
        'olusturmaTarihi'    => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM finished_stock_entries ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();

        $kalemlerMap = [];
        if ($rows) {
            $ids = array_column($rows, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $kalemStmt = $pdo->prepare("SELECT * FROM finished_stock_lots WHERE giris_id IN ($placeholders) ORDER BY id ASC");
            $kalemStmt->execute($ids);
            foreach ($kalemStmt->fetchAll() as $k) {
                $kalemlerMap[$k['giris_id']][] = kalemResponse($k);
            }
        }

        echo json_encode(['girisler' => array_map(
            fn(array $r) => girisResponse($pdo, $r, $kalemlerMap[$r['id']] ?? []),
            $rows
        )]);
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

        $check = $pdo->prepare('SELECT * FROM finished_stock_entries WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Giriş belgesi bulunamadı']);
            exit;
        }

        $existingStmt = $pdo->prepare('SELECT * FROM finished_stock_lots WHERE giris_id = ?');
        $existingStmt->execute([$id]);
        $existingLots = [];
        foreach ($existingStmt->fetchAll() as $row) $existingLots[$row['id']] = $row;

        $updates = [];
        $inserts = [];
        $keptIds = [];
        foreach ($kalemler as $i => $k) {
            $miktar = (float)$k['miktar'];
            $lotId = strOrNull($k['lotId'] ?? null);
            $kalemData = [
                'lotNo' => (string)$k['lotNo'], 'urunAdi' => (string)$k['urunAdi'],
                'kategoriId' => (string)$k['kategoriId'], 'parametreler' => $k['parametreler'] ?? [],
                'miktar' => $miktar, 'sktTarih' => strOrNull($k['sktTarih'] ?? null),
            ];
            if ($lotId !== null && isset($existingLots[$lotId])) {
                $old = $existingLots[$lotId];
                $newMevcut = (float)$old['mevcut_miktar'] + ($miktar - (float)$old['miktar']);
                if ($newMevcut < 0) {
                    http_response_code(400);
                    echo json_encode(['error' => $old['lot_no'] . ' LOT\'unda kullanılmış stok mevcut girişten fazla, miktarı azaltamazsınız.']);
                    exit;
                }
                $kalemData['mevcutMiktar'] = $newMevcut;
                $updates[$lotId] = $kalemData;
                $keptIds[] = $lotId;
            } else {
                $inserts[] = $kalemData;
            }
        }
        $removals = [];
        foreach ($existingLots as $lotId => $old) {
            if (in_array($lotId, $keptIds, true)) continue;
            if ((float)$old['mevcut_miktar'] !== (float)$old['miktar']) {
                http_response_code(400);
                echo json_encode(['error' => $old['lot_no'] . ' LOT\'undan stok kullanıldığı için kaldırılamaz.']);
                exit;
            }
            $removals[] = $lotId;
        }

        $notlar = strOrNull($input['notlar'] ?? null);

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE finished_stock_entries SET evrak_no=?, tarih=?, notlar=? WHERE id=?')
                ->execute([$evrakNo, $tarih, $notlar, $id]);

            $updStmt = $pdo->prepare('UPDATE finished_stock_lots SET evrak_no=?, lot_no=?, tarih=?, urun_adi=?, kategori_id=?, parametreler=?, miktar=?, mevcut_miktar=?, skt_tarih=? WHERE id=?');
            foreach ($updates as $lotId => $u) {
                $updStmt->execute([$evrakNo, $u['lotNo'], $tarih, $u['urunAdi'], $u['kategoriId'], json_encode($u['parametreler'], JSON_UNESCAPED_UNICODE), $u['miktar'], $u['mevcutMiktar'], $u['sktTarih'], $lotId]);
            }

            $insStmt = $pdo->prepare('INSERT INTO finished_stock_lots (id, giris_id, evrak_no, lot_no, tarih, urun_adi, kategori_id, parametreler, miktar, mevcut_miktar, skt_tarih, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            foreach ($inserts as $i => $u) {
                $newLotId = 'bl' . (string)(int)round(microtime(true) * 1000) . $i;
                $insStmt->execute([$newLotId, $id, $evrakNo, $u['lotNo'], $tarih, $u['urunAdi'], $u['kategoriId'], json_encode($u['parametreler'], JSON_UNESCAPED_UNICODE), $u['miktar'], $u['miktar'], $u['sktTarih'], $user['id']]);
            }

            if ($removals) {
                $placeholders = implode(',', array_fill(0, count($removals), '?'));
                $pdo->prepare("DELETE FROM finished_stock_lots WHERE id IN ($placeholders)")->execute($removals);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM finished_stock_entries WHERE id = ?');
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
        $lotStmt = $pdo->prepare('SELECT * FROM finished_stock_lots WHERE giris_id = ?');
        $lotStmt->execute([$id]);
        foreach ($lotStmt->fetchAll() as $lot) {
            if ((float)$lot['mevcut_miktar'] !== (float)$lot['miktar']) {
                http_response_code(400);
                echo json_encode(['error' => $lot['lot_no'] . ' LOT\'undan stok kullanıldığı için bu giriş silinemez.']);
                exit;
            }
        }
        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM finished_stock_lots WHERE giris_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM finished_stock_entries WHERE id = ?')->execute([$id]);
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
