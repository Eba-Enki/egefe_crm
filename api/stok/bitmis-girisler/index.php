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
        'marka'        => $row['marka'],
        'model'        => $row['model'],
        'seriNo'       => $row['seri_no'],
        'kategoriId'   => $row['kategori_id'],
        'parametreler' => $row['parametreler'] ? json_decode($row['parametreler'], true) : [],
        'miktar'       => (float)$row['miktar'],
        'sktTarih'     => $row['skt_tarih'],
    ];
}

// Kalem kategorisinin grup_tipi'ne (test_kiti/cihaz/sarf) göre zorunlu alanları doğrular.
function bitmisKalemValidate(PDO $pdo, array $k, int $sira): ?string {
    $kategoriId = strOrNull($k['kategoriId'] ?? null);
    $urunAdi = strOrNull($k['urunAdi'] ?? null);
    if ($kategoriId === null || $urunAdi === null) {
        return $sira . '. kalemde kategori ve ürün adı zorunludur';
    }
    if ((float)($k['miktar'] ?? 0) < 1) {
        return $sira . '. kalemde miktar geçersiz';
    }
    $stmt = $pdo->prepare('SELECT grup_tipi FROM stock_categories WHERE id = ?');
    $stmt->execute([$kategoriId]);
    $grupTipi = $stmt->fetchColumn();

    if ($grupTipi === 'cihaz') {
        if (strOrNull($k['marka'] ?? null) === null || strOrNull($k['model'] ?? null) === null || strOrNull($k['seriNo'] ?? null) === null) {
            return $sira . '. kalemde marka, model ve seri no zorunludur';
        }
    } elseif ($grupTipi === 'sarf') {
        // lot no / SKT opsiyonel, başka zorunlu alan yok
    } elseif ($grupTipi === 'test_kiti') {
        if (strOrNull($k['lotNo'] ?? null) === null || strOrNull($k['sktTarih'] ?? null) === null) {
            return $sira . '. kalemde LOT No ve SKT zorunludur';
        }
    } else {
        // eski (grup_tipi tanımsız) kategoriler: geriye dönük uyumluluk için LOT No zorunlu
        if (strOrNull($k['lotNo'] ?? null) === null) {
            return $sira . '. kalemde LOT No zorunludur';
        }
    }
    return null;
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
            $hata = bitmisKalemValidate($pdo, $k, $i + 1);
            if ($hata !== null) {
                http_response_code(400);
                echo json_encode(['error' => $hata]);
                exit;
            }
        }

        $girisId = 'bg' . (string)(int)round(microtime(true) * 1000);
        $notlar = strOrNull($input['notlar'] ?? null);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO finished_stock_entries (id, evrak_no, tarih, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$girisId, $evrakNo, $tarih, $notlar, $user['id']]);

            $lotStmt = $pdo->prepare('INSERT INTO finished_stock_lots (id, giris_id, evrak_no, lot_no, tarih, urun_adi, marka, model, seri_no, kategori_id, parametreler, miktar, mevcut_miktar, skt_tarih, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            foreach ($kalemler as $i => $k) {
                $miktar = (float)$k['miktar'];
                $lotId = 'bl' . (string)(int)round(microtime(true) * 1000) . $i;
                $lotStmt->execute([
                    $lotId, $girisId, $evrakNo,
                    strOrNull($k['lotNo'] ?? null), $tarih, (string)$k['urunAdi'],
                    strOrNull($k['marka'] ?? null), strOrNull($k['model'] ?? null), strOrNull($k['seriNo'] ?? null),
                    (string)$k['kategoriId'],
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
            $hata = bitmisKalemValidate($pdo, $k, $i + 1);
            if ($hata !== null) {
                http_response_code(400);
                echo json_encode(['error' => $hata]);
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
                'lotNo' => strOrNull($k['lotNo'] ?? null), 'urunAdi' => (string)$k['urunAdi'],
                'marka' => strOrNull($k['marka'] ?? null), 'model' => strOrNull($k['model'] ?? null), 'seriNo' => strOrNull($k['seriNo'] ?? null),
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

            $updStmt = $pdo->prepare('UPDATE finished_stock_lots SET evrak_no=?, lot_no=?, tarih=?, urun_adi=?, marka=?, model=?, seri_no=?, kategori_id=?, parametreler=?, miktar=?, mevcut_miktar=?, skt_tarih=? WHERE id=?');
            foreach ($updates as $lotId => $u) {
                $updStmt->execute([$evrakNo, $u['lotNo'], $tarih, $u['urunAdi'], $u['marka'], $u['model'], $u['seriNo'], $u['kategoriId'], json_encode($u['parametreler'], JSON_UNESCAPED_UNICODE), $u['miktar'], $u['mevcutMiktar'], $u['sktTarih'], $lotId]);
            }

            $insStmt = $pdo->prepare('INSERT INTO finished_stock_lots (id, giris_id, evrak_no, lot_no, tarih, urun_adi, marka, model, seri_no, kategori_id, parametreler, miktar, mevcut_miktar, skt_tarih, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            foreach ($inserts as $i => $u) {
                $newLotId = 'bl' . (string)(int)round(microtime(true) * 1000) . $i;
                $insStmt->execute([$newLotId, $id, $evrakNo, $u['lotNo'], $tarih, $u['urunAdi'], $u['marka'], $u['model'], $u['seriNo'], $u['kategoriId'], json_encode($u['parametreler'], JSON_UNESCAPED_UNICODE), $u['miktar'], $u['miktar'], $u['sktTarih'], $user['id']]);
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
