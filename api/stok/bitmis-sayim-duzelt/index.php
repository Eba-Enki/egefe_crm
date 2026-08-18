<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');


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

$countStmt = $pdo->prepare('SELECT * FROM finished_stock_counts WHERE id = ?');
$countStmt->execute([$countId]);
$count = $countStmt->fetch();
if (!$count) {
    http_response_code(404);
    echo json_encode(['error' => 'Sayım kaydı bulunamadı']);
    exit;
}

$itemStmt = $pdo->prepare('SELECT i.*, l.lot_no, l.kategori_id AS lot_kategori_id, l.parametreler AS lot_parametreler, l.skt_tarih AS lot_skt_tarih FROM finished_stock_count_items i LEFT JOIN finished_stock_lots l ON l.id = i.lot_id WHERE i.count_id = ? AND i.duzeltme_evrak_no IS NULL AND i.sayilan_miktar <> i.sistem_miktar ORDER BY i.id ASC');
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
        echo json_encode(['error' => ($it['urun_adi'] ?? 'Bir kalem') . ' için kaynak LOT artık mevcut değil, bu kalem otomatik düzeltilemez.']);
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
        $girisEvrakNo = nextEvrak($pdo, 'finished_stock_entries', 'SD');
        $girisId = 'bs' . (string)(int)round(microtime(true) * 1000) . 'g';
        $stmt = $pdo->prepare('INSERT INTO finished_stock_entries (id, evrak_no, tarih, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$girisId, $girisEvrakNo, $tarih, $notlarFull, $user['id']]);

        $lotStmt = $pdo->prepare('INSERT INTO finished_stock_lots (id, giris_id, evrak_no, lot_no, tarih, urun_adi, kategori_id, parametreler, miktar, mevcut_miktar, skt_tarih, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($fazlalar as $i => $it) {
            $fark = (float)$it['sayilan_miktar'] - (float)$it['sistem_miktar'];
            $newLotId = 'bl' . (string)(int)round(microtime(true) * 1000) . 'd' . $i;
            $lotStmt->execute([
                $newLotId, $girisId, $girisEvrakNo,
                $it['lot_no'], $tarih, $it['urun_adi'], $it['lot_kategori_id'], $it['lot_parametreler'],
                $fark, $fark, $it['lot_skt_tarih'], $user['id'],
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
            $cikisEvrakNo = nextEvrak($pdo, 'finished_stock_exits', 'SD');
            $cikisId = 'bs' . (string)(int)round(microtime(true) * 1000) . 'c' . $kategoriId;
            $stmt = $pdo->prepare('INSERT INTO finished_stock_exits (id, evrak_no, tarih, kategori_id, aciklama, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$cikisId, $cikisEvrakNo, $tarih, $kategoriId !== '' ? $kategoriId : null, 'Stok Sayım Eksiği', $notlarFull, $user['id']]);

            $itemStmt2 = $pdo->prepare('INSERT INTO finished_stock_exit_items (exit_id, lot_id, miktar_cikis) VALUES (?, ?, ?)');
            $decStmt = $pdo->prepare('UPDATE finished_stock_lots SET mevcut_miktar = mevcut_miktar - ? WHERE id = ? AND mevcut_miktar >= ?');
            foreach ($grupItems as $it) {
                $fark = (float)$it['sistem_miktar'] - (float)$it['sayilan_miktar'];
                $itemStmt2->execute([$cikisId, $it['lot_id'], $fark]);
                $decStmt->execute([$fark, $it['lot_id'], $fark]);
                if ($decStmt->rowCount() === 0) {
                    throw new RuntimeException(($it['urun_adi'] ?? 'Bir kalem') . ' (' . $it['lot_no'] . '): mevcut stok, sayım eksiğinden az olduğu için düzeltilemedi.');
                }
                $duzeltmeMap[$it['id']] = $cikisEvrakNo;
            }
        }
    }

    $flagStmt = $pdo->prepare('UPDATE finished_stock_count_items SET duzeltme_evrak_no = ? WHERE id = ?');
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
