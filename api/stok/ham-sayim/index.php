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

function kalemResponse(array $row): array {
    return [
        'lotId'           => $row['lot_id'],
        'lotNo'           => $row['lot_no'],
        'parametreAd'     => $row['parametre_ad'],
        'cutoff'          => $row['cutoff'],
        'kategoriId'      => $row['lot_kategori_id'],
        'sistemMiktar'    => (int)$row['sistem_miktar'],
        'sayilanSheet'    => (int)$row['sayilan_sheet'],
        'sayilanStrip'    => (int)$row['sayilan_strip'],
        'sayilanMiktar'   => (int)$row['sayilan_miktar'],
        'duzeltmeEvrakNo' => $row['duzeltme_evrak_no'],
    ];
}

function fetchKalemler(PDO $pdo, string $countId): array {
    $stmt = $pdo->prepare('SELECT i.*, l.lot_no, l.cutoff, l.kategori_id AS lot_kategori_id FROM raw_stock_count_items i LEFT JOIN raw_stock_lots l ON l.id = i.lot_id WHERE i.count_id = ? ORDER BY i.id ASC');
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

function nextHamSayimEvrak(PDO $pdo): string {
    $prefix = 'SY';
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['stok']);
    $row = $stmt->fetch();
    if ($row) {
        $data = json_decode($row['data'], true) ?? [];
        if (!empty($data['hamSayimPrefix'])) $prefix = (string)$data['hamSayimPrefix'];
    }

    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(evrak_no, ?) AS UNSIGNED)) AS mx FROM raw_stock_counts WHERE evrak_no LIKE CONCAT(?, '-%')");
    $stmt->execute([strlen($prefix) + 2, $prefix]);
    $mx = (int)($stmt->fetch()['mx'] ?? 0);

    return $prefix . '-' . str_pad((string)($mx + 1), 5, '0', STR_PAD_LEFT);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM raw_stock_counts ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();

        $kalemlerMap = [];
        if ($rows) {
            $ids = array_column($rows, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $kalemStmt = $pdo->prepare("SELECT i.*, l.lot_no, l.cutoff, l.kategori_id AS lot_kategori_id FROM raw_stock_count_items i LEFT JOIN raw_stock_lots l ON l.id = i.lot_id WHERE i.count_id IN ($placeholders) ORDER BY i.count_id, i.id ASC");
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
            $sayilanSheet = (int)($k['sayilanSheet'] ?? 0);
            $sayilanStrip = (int)($k['sayilanStrip'] ?? 0);
            if ($sayilanSheet < 0 || $sayilanStrip < 0) {
                http_response_code(400);
                echo json_encode(['error' => (($i + 1)) . '. kalemde sayılan miktar geçersiz']);
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
            // Sistem miktarı, sayım kaydedildiği andaki mevcut_strip değerinin anlık görüntüsüdür.
            $items[] = [
                'lot' => $lot,
                'sistemMiktar' => (int)$lot['mevcut_strip'],
                'sayilanSheet' => $sayilanSheet,
                'sayilanStrip' => $sayilanStrip,
                'sayilanMiktar' => $sayilanSheet * $sps + $sayilanStrip,
            ];
        }

        $evrakNo = strOrNull($input['evrakNo'] ?? null) ?? nextHamSayimEvrak($pdo);
        $id = 'hs' . (string)(int)round(microtime(true) * 1000);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO raw_stock_counts (id, evrak_no, tarih, kategori_id, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$id, $evrakNo, $tarih, $kategoriId, $notlar, $user['id']]);

            $itemStmt = $pdo->prepare('INSERT INTO raw_stock_count_items (count_id, lot_id, parametre_ad, sistem_miktar, sayilan_sheet, sayilan_strip, sayilan_miktar) VALUES (?, ?, ?, ?, ?, ?, ?)');
            foreach ($items as $it) {
                $itemStmt->execute([$id, $it['lot']['id'], $it['lot']['parametre_ad'], $it['sistemMiktar'], $it['sayilanSheet'], $it['sayilanStrip'], $it['sayilanMiktar']]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM raw_stock_counts WHERE id = ?');
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

        $check = $pdo->prepare('SELECT * FROM raw_stock_counts WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Sayım kaydı bulunamadı']);
            exit;
        }

        // Bu sayımdan doğan düzeltme giriş/çıkış belgelerini bul (varsa) — sayım
        // silinince onlar da geri alınmalı, aksi halde stok düzeltmesi sayımsız kalır.
        $evrakStmt = $pdo->prepare('SELECT DISTINCT duzeltme_evrak_no FROM raw_stock_count_items WHERE count_id = ? AND duzeltme_evrak_no IS NOT NULL');
        $evrakStmt->execute([$id]);
        $evrakNolar = array_column($evrakStmt->fetchAll(), 'duzeltme_evrak_no');

        $girisIds = [];
        $cikisIds = [];
        foreach ($evrakNolar as $evrakNo) {
            $g = $pdo->prepare('SELECT id FROM raw_stock_entries WHERE evrak_no = ?');
            $g->execute([$evrakNo]);
            $gRow = $g->fetch();
            if ($gRow) { $girisIds[] = $gRow['id']; continue; }
            $c = $pdo->prepare('SELECT id FROM raw_stock_exits WHERE evrak_no = ?');
            $c->execute([$evrakNo]);
            $cRow = $c->fetch();
            if ($cRow) { $cikisIds[] = $cRow['id']; }
        }

        foreach ($girisIds as $girisId) {
            $lotStmt = $pdo->prepare('SELECT * FROM raw_stock_lots WHERE giris_id = ?');
            $lotStmt->execute([$girisId]);
            foreach ($lotStmt->fetchAll() as $lot) {
                if ((int)$lot['mevcut_strip'] !== (int)$lot['strip_giren']) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Bu sayımdan oluşan düzeltme girişindeki ' . $lot['lot_no'] . ' LOT\'undan stok kullanıldığı için sayım silinemez.']);
                    exit;
                }
            }
        }

        $pdo->beginTransaction();
        try {
            foreach ($girisIds as $girisId) {
                $pdo->prepare('DELETE FROM raw_stock_lots WHERE giris_id = ?')->execute([$girisId]);
                $pdo->prepare('DELETE FROM raw_stock_entries WHERE id = ?')->execute([$girisId]);
            }
            foreach ($cikisIds as $cikisId) {
                $items = $pdo->prepare('SELECT lot_id, strip_cikis FROM raw_stock_exit_items WHERE exit_id = ?');
                $items->execute([$cikisId]);
                $incStmt = $pdo->prepare('UPDATE raw_stock_lots SET mevcut_strip = mevcut_strip + ? WHERE id = ?');
                foreach ($items->fetchAll() as $item) {
                    if ($item['lot_id']) $incStmt->execute([$item['strip_cikis'], $item['lot_id']]);
                }
                $pdo->prepare('DELETE FROM raw_stock_exits WHERE id = ?')->execute([$cikisId]);
            }
            $pdo->prepare('DELETE FROM raw_stock_counts WHERE id = ?')->execute([$id]);
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
