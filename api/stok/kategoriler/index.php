<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

const TIP_DEGERLERI = ['ham','ticari'];
const GRUP_TIPI_DEGERLERI = ['test_kiti','cihaz','sarf'];


function kategoriResponse(array $row): array {
    return [
        'id'           => $row['id'],
        'tip'          => $row['tip'],
        'parentId'     => $row['parent_id'],
        'grupTipi'     => $row['grup_tipi'],
        'ad'           => $row['ad'],
        'sheetBoyu'    => $row['sheet_boyu'] !== null ? (int)$row['sheet_boyu'] : null,
        'kesimBoleni'  => $row['kesim_boleni'] !== null ? (float)$row['kesim_boleni'] : null,
        'firePct'      => $row['fire_pct'] !== null ? (float)$row['fire_pct'] : null,
    ];
}

// Kategorinin strip/sheet oranı (diğer stok uçlarındaki stokSPS ile aynı formül).
function kategoriSPS($sheetBoyu, $kesimBoleni, $firePct): int {
    if (!$sheetBoyu || !$kesimBoleni || (float)$kesimBoleni == 0.0) return 90;
    return (int)round(((float)$sheetBoyu / (float)$kesimBoleni) * (1 - (float)($firePct ?? 0) / 100));
}

// Kesim parametreleri değişince kategorideki tüm LOT'ların strip değerlerini yeni
// orana göre yeniden hesaplar. Fiziksel gerçek sheet miktarıdır: giriş strip'i
// sheet_giren'den, çıkış/fire strip'leri çıkıştaki sheet'lerden türetilir ve
// mevcut stok giriş − tüm çıkışlar olarak yeniden kurulur (migration 022 ile aynı model).
// Henüz düzeltmesi yapılmamış sayım kalemleri de yeni orana çevrilir.
function kategoriStripYenidenHesapla(PDO $pdo, string $kategoriId, int $eskiSps, int $yeniSps): int {
    $sps = $yeniSps;

    $pdo->prepare('UPDATE raw_stock_lots SET strip_giren = ROUND(sheet_giren * ?) WHERE kategori_id = ?')
        ->execute([$sps, $kategoriId]);

    $pdo->prepare(
        'UPDATE raw_stock_exit_items i JOIN raw_stock_lots l ON l.id = i.lot_id
         SET i.strip_cikis = LEAST(ROUND(i.sheet_cikis * ?), ROUND((i.sheet_cikis + i.fire_sheet) * ?)),
             i.fire_strip  = ROUND((i.sheet_cikis + i.fire_sheet) * ?)
                           - LEAST(ROUND(i.sheet_cikis * ?), ROUND((i.sheet_cikis + i.fire_sheet) * ?))
         WHERE l.kategori_id = ?'
    )->execute([$sps, $sps, $sps, $sps, $sps, $kategoriId]);

    $stmt = $pdo->prepare(
        'UPDATE raw_stock_lots l
         LEFT JOIN (
           SELECT lot_id, SUM(strip_cikis + fire_strip) AS toplam_strip, SUM(sheet_cikis + fire_sheet) AS toplam_sheet
           FROM raw_stock_exit_items WHERE lot_id IS NOT NULL GROUP BY lot_id
         ) x ON x.lot_id = l.id
         SET l.mevcut_strip = GREATEST(0, l.strip_giren - COALESCE(x.toplam_strip, 0)),
             l.mevcut_sheet = GREATEST(0, ROUND(l.sheet_giren - COALESCE(x.toplam_sheet, 0), 3))
         WHERE l.kategori_id = ?'
    );
    $stmt->execute([$kategoriId]);

    // Düzeltmesi bekleyen sayımlar sheet üzerinden eşitlendiği için sheet değerleri
    // aynı kalır; yalnızca ayrıca sayılan strip'in sheet karşılığı ve bilgi amaçlı
    // strip değerleri yeni orana çevrilir.
    $pdo->prepare(
        'UPDATE raw_stock_count_items i JOIN raw_stock_lots l ON l.id = i.lot_id
         SET i.sayilan_toplam_sheet = ROUND(i.sayilan_sheet + i.sayilan_strip / ?, 3),
             i.sayilan_miktar = ROUND(i.sayilan_sheet * ? + i.sayilan_strip),
             i.sistem_miktar  = ROUND(COALESCE(i.sistem_sheet, i.sistem_miktar / ?) * ?)
         WHERE l.kategori_id = ? AND i.duzeltme_evrak_no IS NULL'
    )->execute([max(1, $sps), $sps, max(1, $eskiSps), $sps, $kategoriId]);

    $cnt = $pdo->prepare('SELECT COUNT(*) FROM raw_stock_lots WHERE kategori_id = ?');
    $cnt->execute([$kategoriId]);
    return (int)$cnt->fetchColumn();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $tip = (string)($_GET['tip'] ?? '');
        if ($tip !== '' && in_array($tip, TIP_DEGERLERI, true)) {
            $stmt = $pdo->prepare('SELECT * FROM stock_categories WHERE tip = ? ORDER BY ad ASC');
            $stmt->execute([$tip]);
        } else {
            $stmt = $pdo->query('SELECT * FROM stock_categories ORDER BY tip ASC, ad ASC');
        }
        $rows = $stmt->fetchAll();
        echo json_encode(['kategoriler' => array_map('kategoriResponse', $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $tip = (string)($input['tip'] ?? '');
        $ad = trim((string)($input['ad'] ?? ''));
        if (!in_array($tip, TIP_DEGERLERI, true) || $ad === '') {
            http_response_code(400);
            echo json_encode(['error' => 'tip (ham/ticari) ve ad zorunlu']);
            exit;
        }

        $parentId = null;
        $grupTipi = null;
        if ($tip === 'ticari') {
            $parentId = strOrNull($input['parentId'] ?? null);
            if ($parentId !== null) {
                $pStmt = $pdo->prepare('SELECT * FROM stock_categories WHERE id = ? AND tip = ?');
                $pStmt->execute([$parentId, 'ticari']);
                $parent = $pStmt->fetch();
                if (!$parent) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Üst kategori (ana grup) bulunamadı']);
                    exit;
                }
                if ($parent['parent_id'] !== null) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Alt tip başka bir alt tipin altına eklenemez']);
                    exit;
                }
                $grupTipi = $parent['grup_tipi'];
            } else {
                $grupTipi = (string)($input['grupTipi'] ?? '');
                if (!in_array($grupTipi, GRUP_TIPI_DEGERLERI, true)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'grupTipi (test_kiti/cihaz/sarf) zorunlu']);
                    exit;
                }
            }
        }

        $id = ($tip === 'ham' ? 'kat' : 'tkat') . (string)(int)round(microtime(true) * 1000);

        $stmt = $pdo->prepare('INSERT INTO stock_categories (id, tip, parent_id, grup_tipi, ad, sheet_boyu, kesim_boleni, fire_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $id, $tip, $parentId, $grupTipi, $ad,
            $tip === 'ham' ? (int)($input['sheetBoyu'] ?? 0) : null,
            $tip === 'ham' ? round((float)str_replace(',', '.', (string)($input['kesimBoleni'] ?? 0)), 3) : null,
            $tip === 'ham' ? (float)($input['firePct'] ?? 0) : null,
        ]);

        $stmt = $pdo->prepare('SELECT * FROM stock_categories WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['kategori' => kategoriResponse($stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (string)($input['id'] ?? '');
        $ad = trim((string)($input['ad'] ?? ''));
        if ($id === '' || $ad === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id ve ad zorunlu']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM stock_categories WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Kategori bulunamadı']);
            exit;
        }

        $yeniSb = $existing['tip'] === 'ham' ? (int)($input['sheetBoyu'] ?? $existing['sheet_boyu']) : null;
        $yeniKb = $existing['tip'] === 'ham' ? round((float)str_replace(',', '.', (string)($input['kesimBoleni'] ?? $existing['kesim_boleni'])), 3) : null;
        $yeniFp = $existing['tip'] === 'ham' ? (float)($input['firePct'] ?? $existing['fire_pct']) : null;

        $eskiSps = kategoriSPS($existing['sheet_boyu'], $existing['kesim_boleni'], $existing['fire_pct']);
        $yeniSps = kategoriSPS($yeniSb, $yeniKb, $yeniFp);
        $yenidenHesaplanan = 0;

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('UPDATE stock_categories SET ad=?, sheet_boyu=?, kesim_boleni=?, fire_pct=? WHERE id=?');
            $stmt->execute([$ad, $yeniSb, $yeniKb, $yeniFp, $id]);

            if ($existing['tip'] === 'ham' && $eskiSps !== $yeniSps) {
                $yenidenHesaplanan = kategoriStripYenidenHesapla($pdo, $id, $eskiSps, $yeniSps);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM stock_categories WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode([
            'kategori' => kategoriResponse($stmt->fetch()),
            'yenidenHesaplananLot' => $yenidenHesaplanan,
        ]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $stmt = $pdo->prepare('DELETE FROM stock_categories WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Kategori bulunamadı']);
            exit;
        }
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
