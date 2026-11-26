<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

// Tedarik (satın alma) listeleri. Liste yalnızca "Taslak" durumundayken
// düzenlenebilir; "Tedarikçiye İletildi" ve sonrasında içerik kilitlenir.
const TEDARIK_DURUMLARI = ['Taslak', 'Tedarikçiye İletildi', 'Kısmi Mal Kabul', 'Mal Kabul Tamamlandı', 'İptal'];
const TEDARIK_KAYNAKLAR = ['ham', 'bitmis'];

function tdFail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function tdRequireWrite(array $user): void {
    if ($user['rol'] === 'izleyici') tdFail(403, 'Bu işlem için yetkiniz yok');
}

function tdNum($v): float {
    return round((float)str_replace(',', '.', (string)($v ?? 0)), 3);
}

function tdKabulVar(PDO $pdo, string $orderId): bool {
    $s = $pdo->prepare('SELECT COUNT(*) FROM stock_purchase_order_items WHERE order_id = ? AND kabul_edilen > 0');
    $s->execute([$orderId]);
    return (int)$s->fetchColumn() > 0;
}

function tdKalemResponse(array $row): array {
    return [
        'id'          => (int)$row['id'],
        'kaynak'      => $row['kaynak'],
        'kategoriId'  => $row['kategori_id'],
        'anahtar'     => $row['anahtar'],
        'tamAd'       => $row['tam_ad'],
        'kisaltma'    => $row['kisaltma'],
        'cutoff'      => $row['cutoff'],
        'marka'       => $row['marka'],
        'model'       => $row['model'],
        'sinif'       => $row['sinif'],
        'mevcut'      => $row['mevcut'] !== null ? (float)$row['mevcut'] : null,
        'hedef'       => $row['hedef'] !== null ? (float)$row['hedef'] : null,
        'miktar'      => (float)$row['miktar'],
        'birim'       => $row['birim'],
        'manuel'      => (bool)$row['manuel'],
        'kabulEdilen' => (float)$row['kabul_edilen'],
    ];
}

function tdResponse(array $row, array $kalemler): array {
    return [
        'id'                 => $row['id'],
        'evrakNo'            => $row['evrak_no'],
        'tarih'              => $row['tarih'],
        'tedarikci'          => $row['tedarikci'],
        'notlar'             => $row['notlar'],
        'durum'              => $row['durum'],
        'hedefler'           => $row['hedefler'] ? json_decode($row['hedefler'], true) : null,
        'kalemler'           => $kalemler,
        'olusturanKullanici' => $row['olusturan_kullanici'],
        'olusturmaTarihi'    => $row['created_at'],
    ];
}

function tdGetir(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare('SELECT * FROM stock_purchase_orders WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $k = $pdo->prepare('SELECT * FROM stock_purchase_order_items WHERE order_id = ? ORDER BY sira ASC, id ASC');
    $k->execute([$id]);
    return tdResponse($row, array_map('tdKalemResponse', $k->fetchAll()));
}

function tdSonrakiEvrak(PDO $pdo): string {
    $prefix = 'TD';
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['stok']);
    $row = $stmt->fetch();
    if ($row) {
        $data = json_decode($row['data'], true) ?? [];
        if (!empty($data['tedarikPrefix'])) $prefix = (string)$data['tedarikPrefix'];
    }
    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(evrak_no, ?) AS UNSIGNED)) AS mx FROM stock_purchase_orders WHERE evrak_no LIKE CONCAT(?, '-%')");
    $stmt->execute([strlen($prefix) + 2, $prefix]);
    $mx = (int)($stmt->fetch()['mx'] ?? 0);
    return $prefix . '-' . str_pad((string)($mx + 1), 5, '0', STR_PAD_LEFT);
}

// Gelen kalemleri doğrular; miktarı 0 olanlar listeye girmez.
function tdKalemleriHazirla(array $kalemler): array {
    $out = [];
    foreach ($kalemler as $i => $k) {
        if (!is_array($k)) continue;
        $miktar = tdNum($k['miktar'] ?? 0);
        if ($miktar <= 0) continue;
        $kaynak = (string)($k['kaynak'] ?? '');
        if (!in_array($kaynak, TEDARIK_KAYNAKLAR, true)) tdFail(400, ($i + 1) . '. kalemde tür geçersiz');
        $tamAd = strOrNull($k['tamAd'] ?? null);
        if ($tamAd === null) tdFail(400, ($i + 1) . '. kalemde ürün / parametre adı zorunludur');
        $sinif = strtoupper((string)($k['sinif'] ?? ''));
        $out[] = [
            'kaynak'     => $kaynak,
            'kategoriId' => strOrNull($k['kategoriId'] ?? null),
            'anahtar'    => strOrNull($k['anahtar'] ?? null),
            'tamAd'      => mb_substr($tamAd, 0, 255),
            'kisaltma'   => ($v = strOrNull($k['kisaltma'] ?? null)) !== null ? mb_substr($v, 0, 255) : null,
            'cutoff'     => ($v = strOrNull($k['cutoff'] ?? null)) !== null ? mb_substr($v, 0, 500) : null,
            'marka'      => strOrNull($k['marka'] ?? null),
            'model'      => strOrNull($k['model'] ?? null),
            'sinif'      => in_array($sinif, ['A', 'B', 'C'], true) ? $sinif : null,
            'mevcut'     => isset($k['mevcut']) && $k['mevcut'] !== '' && $k['mevcut'] !== null ? tdNum($k['mevcut']) : null,
            'hedef'      => isset($k['hedef']) && $k['hedef'] !== '' && $k['hedef'] !== null ? tdNum($k['hedef']) : null,
            'miktar'     => $miktar,
            'birim'      => $kaynak === 'ham' ? 'sheet' : 'adet',
            'manuel'     => !empty($k['manuel']) ? 1 : 0,
        ];
    }
    if (!$out) tdFail(400, 'Listede miktarı girilmiş en az bir kalem olmalı');
    return $out;
}

function tdKalemleriYaz(PDO $pdo, string $orderId, array $kalemler): void {
    $pdo->prepare('DELETE FROM stock_purchase_order_items WHERE order_id = ?')->execute([$orderId]);
    $stmt = $pdo->prepare('INSERT INTO stock_purchase_order_items (order_id, sira, kaynak, kategori_id, anahtar, tam_ad, kisaltma, cutoff, marka, model, sinif, mevcut, hedef, miktar, birim, manuel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($kalemler as $i => $k) {
        $stmt->execute([$orderId, $i, $k['kaynak'], $k['kategoriId'], $k['anahtar'], $k['tamAd'], $k['kisaltma'], $k['cutoff'], $k['marka'], $k['model'], $k['sinif'], $k['mevcut'], $k['hedef'], $k['miktar'], $k['birim'], $k['manuel']]);
    }
}

function tdHedefler($v): ?string {
    if (!is_array($v)) return null;
    $out = [];
    foreach (TEDARIK_KAYNAKLAR as $kaynak) {
        foreach (['A', 'B', 'C'] as $s) {
            $out[$kaynak][$s] = max(0.0, tdNum($v[$kaynak][$s] ?? 0));
        }
    }
    return json_encode($out);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $rows = $pdo->query('SELECT * FROM stock_purchase_orders ORDER BY created_at DESC')->fetchAll();
        $kalemMap = [];
        if ($rows) {
            $ids = array_column($rows, 'id');
            $ph = implode(',', array_fill(0, count($ids), '?'));
            $k = $pdo->prepare("SELECT * FROM stock_purchase_order_items WHERE order_id IN ($ph) ORDER BY sira ASC, id ASC");
            $k->execute($ids);
            foreach ($k->fetchAll() as $r) $kalemMap[$r['order_id']][] = tdKalemResponse($r);
        }
        echo json_encode(['tedarikler' => array_map(fn($r) => tdResponse($r, $kalemMap[$r['id']] ?? []), $rows)]);
        break;

    case 'POST':
        tdRequireWrite($user);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $tarih = strOrNull($input['tarih'] ?? null);
        if (!$tarih) tdFail(400, 'Tarih zorunludur');
        $kalemler = tdKalemleriHazirla((array)($input['kalemler'] ?? []));

        $id = 'td' . (string)(int)round(microtime(true) * 1000);
        $pdo->beginTransaction();
        try {
            $evrakNo = tdSonrakiEvrak($pdo);
            $pdo->prepare('INSERT INTO stock_purchase_orders (id, evrak_no, tarih, tedarikci, notlar, durum, hedefler, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$id, $evrakNo, $tarih, strOrNull($input['tedarikci'] ?? null), strOrNull($input['notlar'] ?? null), 'Taslak', tdHedefler($input['hedefler'] ?? null), $user['id']]);
            tdKalemleriYaz($pdo, $id, $kalemler);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        http_response_code(201);
        echo json_encode(['tedarik' => tdGetir($pdo, $id)]);
        break;

    case 'PUT':
        tdRequireWrite($user);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = strOrNull($input['id'] ?? null);
        if (!$id) tdFail(400, 'id zorunludur');
        $stmt = $pdo->prepare('SELECT * FROM stock_purchase_orders WHERE id = ?');
        $stmt->execute([$id]);
        $mevcut = $stmt->fetch();
        if (!$mevcut) tdFail(404, 'Tedarik listesi bulunamadı');

        // Yalnızca durum değişikliği
        if (array_key_exists('durum', $input) && !array_key_exists('kalemler', $input)) {
            $durum = (string)$input['durum'];
            if (!in_array($durum, TEDARIK_DURUMLARI, true)) tdFail(400, 'Geçersiz durum');
            // Taslak düzenlenince kalemler yeniden yazılır; mal kabulü yapılmış bir liste taslağa dönemez
            if ($durum === 'Taslak' && tdKabulVar($pdo, $id)) tdFail(400, 'Mal kabulü yapılmış bir tedarik listesi taslağa döndürülemez');
            $pdo->prepare('UPDATE stock_purchase_orders SET durum = ? WHERE id = ?')->execute([$durum, $id]);
            echo json_encode(['tedarik' => tdGetir($pdo, $id)]);
            break;
        }

        if ($mevcut['durum'] !== 'Taslak') tdFail(400, 'Yalnızca taslak durumundaki tedarik listeleri düzenlenebilir');
        $tarih = strOrNull($input['tarih'] ?? null);
        if (!$tarih) tdFail(400, 'Tarih zorunludur');
        $kalemler = tdKalemleriHazirla((array)($input['kalemler'] ?? []));

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE stock_purchase_orders SET tarih = ?, tedarikci = ?, notlar = ?, hedefler = ? WHERE id = ?')
                ->execute([$tarih, strOrNull($input['tedarikci'] ?? null), strOrNull($input['notlar'] ?? null), tdHedefler($input['hedefler'] ?? null), $id]);
            tdKalemleriYaz($pdo, $id, $kalemler);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        echo json_encode(['tedarik' => tdGetir($pdo, $id)]);
        break;

    case 'DELETE':
        tdRequireWrite($user);
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') tdFail(400, 'id gerekli');
        $stmt = $pdo->prepare('SELECT durum FROM stock_purchase_orders WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) tdFail(404, 'Tedarik listesi bulunamadı');
        if (!in_array($row['durum'], ['Taslak', 'İptal'], true)) tdFail(400, 'Yalnızca taslak veya iptal edilmiş tedarik listeleri silinebilir');
        if (tdKabulVar($pdo, $id)) tdFail(400, 'Mal kabulü yapılmış bir tedarik listesi silinemez');
        $pdo->prepare('DELETE FROM stock_purchase_orders WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        tdFail(405, 'Method Not Allowed');
}
