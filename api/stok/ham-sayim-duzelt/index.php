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

function nextEvrak(PDO $pdo, string $table, string $prefix): string {
    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(evrak_no, ?) AS UNSIGNED)) AS mx FROM $table WHERE evrak_no LIKE CONCAT(?, '-%')");
    $stmt->execute([strlen($prefix) + 2, $prefix]);
    $mx = (int)($stmt->fetch()['mx'] ?? 0);
    return $prefix . '-' . str_pad((string)($mx + 1), 5, '0', STR_PAD_LEFT);
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$countId = strOrNull($input['countId'] ?? null);
$notlar = strOrNull($input['notlar'] ?? null);

if (!$countId) {
    http_response_code(400);
    echo json_encode(['error' => 'countId zorunludur']);
    exit;
}

$countStmt = $pdo->prepare('SELECT * FROM raw_stock_counts WHERE id = ?');
$countStmt->execute([$countId]);
$count = $countStmt->fetch();
if (!$count) {
    http_response_code(404);
    echo json_encode(['error' => 'Sayım kaydı bulunamadı']);
    exit;
}

$itemStmt = $pdo->prepare('SELECT i.*, l.lot_no, l.cutoff, l.ek_ozellik AS lot_ek_ozellik, l.kategori_id AS lot_kategori_id, l.skt_tarih AS lot_skt_tarih FROM raw_stock_count_items i LEFT JOIN raw_stock_lots l ON l.id = i.lot_id WHERE i.count_id = ? AND i.duzeltme_evrak_no IS NULL AND i.sayilan_miktar <> i.sistem_miktar ORDER BY i.id ASC');
$itemStmt->execute([$countId]);
$items = $itemStmt->fetchAll();

if (!$items) {
    http_response_code(400);
    echo json_encode(['error' => 'Düzeltilecek fark bulunamadı']);
    exit;
}

foreach ($items as $it) {
    if (!$it['lot_id'] || !$it['lot_no']) {
        http_response_code(400);
        echo json_encode(['error' => ($it['parametre_ad'] ?? 'Bir kalem') . ' için kaynak LOT artık mevcut değil, bu kalem otomatik düzeltilemez.']);
        exit;
    }
}

$aciklamaBase = 'Stok Sayım Düzeltmesi (' . $count['evrak_no'] . ')';
$notlarFull = $notlar ? ($aciklamaBase . ' — ' . $notlar) : $aciklamaBase;
$tarih = date('Y-m-d');

$fazlalar = array_values(array_filter($items, fn($it) => (float)$it['sayilan_miktar'] > (float)$it['sistem_miktar']));
$eksikler = array_values(array_filter($items, fn($it) => (float)$it['sayilan_miktar'] < (float)$it['sistem_miktar']));

$pdo->beginTransaction();
try {
    $duzeltmeMap = []; // count_item.id => evrak_no

    // ── Fazlalar: mevcut Giriş mekanizmasıyla, aynı LOT No ile yeni bir kayıt ──
    if ($fazlalar) {
        $girisEvrakNo = nextEvrak($pdo, 'raw_stock_entries', 'SD');
        $girisId = 'hs' . (string)(int)round(microtime(true) * 1000) . 'g';
        $stmt = $pdo->prepare('INSERT INTO raw_stock_entries (id, evrak_no, tarih, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$girisId, $girisEvrakNo, $tarih, $notlarFull, $user['id']]);

        $lotStmt = $pdo->prepare('INSERT INTO raw_stock_lots (id, giris_id, evrak_no, lot_no, tarih, parametre_ad, cutoff, ek_ozellik, kategori_id, sheet_giren, strip_giren, mevcut_strip, skt_tarih, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($fazlalar as $i => $it) {
            $fark = (int)((float)$it['sayilan_miktar'] - (float)$it['sistem_miktar']);
            $sps = stokSPS($pdo, (string)$it['lot_kategori_id']);
            $sheetEs = $sps > 0 ? intdiv($fark, $sps) : 0;
            $newLotId = 'hl' . (string)(int)round(microtime(true) * 1000) . 'd' . $i;
            $lotStmt->execute([
                $newLotId, $girisId, $girisEvrakNo,
                $it['lot_no'], $tarih, $it['parametre_ad'], $it['cutoff'], $it['lot_ek_ozellik'] ?? 'Standart', $it['lot_kategori_id'],
                $sheetEs, $fark, $fark, $it['lot_skt_tarih'], $user['id'],
            ]);
            $duzeltmeMap[$it['id']] = $girisEvrakNo;
        }
    }

    // ── Eksikler: mevcut Çıkış mekanizmasıyla; çıkış belgesi kategori bazlı olduğu için kategoriye göre gruplanır ──
    if ($eksikler) {
        $gruplar = [];
        foreach ($eksikler as $it) {
            $gruplar[(string)$it['lot_kategori_id']][] = $it;
        }
        foreach ($gruplar as $kategoriId => $grupItems) {
            $cikisEvrakNo = nextEvrak($pdo, 'raw_stock_exits', 'SD');
            $cikisId = 'hs' . (string)(int)round(microtime(true) * 1000) . 'c' . $kategoriId;
            $stmt = $pdo->prepare('INSERT INTO raw_stock_exits (id, evrak_no, tarih, kategori_id, aciklama, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$cikisId, $cikisEvrakNo, $tarih, $kategoriId !== '' ? $kategoriId : null, 'Stok Sayım Eksiği', $notlarFull, $user['id']]);

            $itemStmt2 = $pdo->prepare('INSERT INTO raw_stock_exit_items (exit_id, lot_id, strip_cikis, parametre_ad) VALUES (?, ?, ?, ?)');
            $decStmt = $pdo->prepare('UPDATE raw_stock_lots SET mevcut_strip = mevcut_strip - ? WHERE id = ? AND mevcut_strip >= ?');
            foreach ($grupItems as $it) {
                $fark = (int)((float)$it['sistem_miktar'] - (float)$it['sayilan_miktar']);
                $itemStmt2->execute([$cikisId, $it['lot_id'], $fark, $it['parametre_ad']]);
                $decStmt->execute([$fark, $it['lot_id'], $fark]);
                if ($decStmt->rowCount() === 0) {
                    throw new RuntimeException(($it['parametre_ad'] ?? 'Bir kalem') . ' (' . $it['lot_no'] . '): mevcut stok, sayım eksiğinden az olduğu için düzeltilemedi.');
                }
                $duzeltmeMap[$it['id']] = $cikisEvrakNo;
            }
        }
    }

    $flagStmt = $pdo->prepare('UPDATE raw_stock_count_items SET duzeltme_evrak_no = ? WHERE id = ?');
    foreach ($duzeltmeMap as $itemId => $evrakNo) {
        $flagStmt->execute([$evrakNo, $itemId]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage() ?: 'Düzeltme uygulanamadı']);
    exit;
}

echo json_encode([
    'ok' => true,
    'duzeltilenKalem' => count($duzeltmeMap),
    'evrakNolar' => array_values(array_unique(array_values($duzeltmeMap))),
]);
