<?php
declare(strict_types=1);

// Teklif kalemleri ve numaralandırma — api/teklifler ve api/yaklasik-maliyet ortak kullanır.

// Satış: Taslak→İletildi→Siparişe Dönüştü|Reddedildi  /  Servis: +Kabul Edildi+Kapandı
const DURUM_DEGERLERI = ['Taslak','İletildi','Kabul Edildi','Siparişe Dönüştü','Reddedildi','Kapandı','Revize Edildi'];
const BIRIM_DEGERLERI = ['Adet','Saat','Gün','Parça'];
// Yurtdışı Satış Portalı birimleri (PDF İngilizce olduğu için doğrudan İngilizce saklanır)
const IHRACAT_BIRIMLERI = ['Pcs','Set','Box','Pack','Roll','Meter','Kg','Hour','Day','Lot'];
const INCOTERMS = ['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP'];
const PARA_BIRIMLERI = ['TRY','USD','EUR','GBP'];

// Teklif satırı + oluşturan kullanıcı + bağlı yaklaşık maliyet (bir teklife en fazla bir belge bağlanır)
const TEKLIF_SELECT = 'SELECT q.*, u.ad AS olusturan_ad, u.email AS olusturan_email, u.telefon AS olusturan_telefon, ce.id AS ym_id, ce.numara AS ym_numara FROM quotes q LEFT JOIN users u ON u.id = q.olusturan_kullanici LEFT JOIN cost_estimates ce ON ce.teklif_id = q.id';

// Serbest metin birimi (adet, pcs, kutu...) yurtdışı teklif birim listesine çevirir; tanınmayan birim Pcs olur
function ihracatBirim($value): string {
    $k = mb_strtolower(trim((string)($value ?? '')), 'UTF-8');
    $k = str_replace(['ı', '.'], ['i', ''], $k);
    $esleme = [
        'adet' => 'Pcs', 'ad' => 'Pcs', 'pcs' => 'Pcs', 'pc' => 'Pcs', 'piece' => 'Pcs', 'pieces' => 'Pcs', 'ea' => 'Pcs', 'each' => 'Pcs', 'unit' => 'Pcs', 'units' => 'Pcs', 'parça' => 'Pcs', 'parca' => 'Pcs',
        'set' => 'Set', 'takim' => 'Set', 'takım' => 'Set', 'kit' => 'Set',
        'kutu' => 'Box', 'box' => 'Box', 'boxes' => 'Box',
        'paket' => 'Pack', 'pack' => 'Pack', 'pkg' => 'Pack', 'package' => 'Pack',
        'rulo' => 'Roll', 'roll' => 'Roll', 'rolls' => 'Roll',
        'metre' => 'Meter', 'm' => 'Meter', 'mt' => 'Meter', 'meter' => 'Meter', 'meters' => 'Meter',
        'kg' => 'Kg', 'kilo' => 'Kg', 'kilogram' => 'Kg',
        'saat' => 'Hour', 'hour' => 'Hour', 'hours' => 'Hour', 'hr' => 'Hour', 'h' => 'Hour',
        'gün' => 'Day', 'gun' => 'Day', 'day' => 'Day', 'days' => 'Day',
        'lot' => 'Lot', 'lots' => 'Lot',
    ];
    return $esleme[$k] ?? 'Pcs';
}

function satirlarFromInput(array $input, string $portal): array {
    $isIhracat = $portal === 'ihracat';
    $out = [];
    foreach (($input['satirlar'] ?? []) as $i => $s) {
        $out[] = [
            'sira'               => $i,
            'urunKodu'           => $isIhracat ? strOrNull($s['urunKodu'] ?? null) : null,
            'aciklama'           => strOrNull($s['aciklama'] ?? null),
            'marka'              => $isIhracat ? strOrNull($s['marka'] ?? null) : null,
            'model'              => $isIhracat ? strOrNull($s['model'] ?? null) : null,
            'kategori'           => $isIhracat ? strOrNull($s['kategori'] ?? null) : null,
            'miktar'             => (float)($s['miktar'] ?? 0),
            'birim'              => $isIhracat
                ? enumOrDefault($s['birim'] ?? null, IHRACAT_BIRIMLERI, 'Pcs')
                : enumOrDefault($s['birim'] ?? null, BIRIM_DEGERLERI, 'Adet'),
            'birimFiyat'         => (float)($s['birimFiyat'] ?? 0),
            'seciliParametreler' => $s['seciliParametreler'] ?? [],
            'ymSatirId'          => $isIhracat ? strOrNull($s['ymSatirId'] ?? null) : null,
        ];
    }
    return $out;
}

function mapSatirRow(array $row): array {
    return [
        'urunKodu'           => $row['urun_kodu'] ?? null,
        'aciklama'           => $row['aciklama'],
        'marka'              => $row['marka'] ?? null,
        'model'              => $row['model'] ?? null,
        'kategori'           => $row['kategori'] ?? null,
        'miktar'             => (float)$row['miktar'],
        'birim'              => $row['birim'],
        'birimFiyat'         => (float)$row['birim_fiyat'],
        'seciliParametreler' => $row['secili_parametreler'] ? json_decode($row['secili_parametreler'], true) : [],
        'ymSatirId'          => $row['ym_satir_id'] ?? null,
    ];
}

function fetchSatirlar(PDO $pdo, string $quoteId): array {
    $stmt = $pdo->prepare('SELECT * FROM quote_line_items WHERE quote_id = ? ORDER BY sira ASC, id ASC');
    $stmt->execute([$quoteId]);
    return array_map('mapSatirRow', $stmt->fetchAll());
}

function replaceSatirlar(PDO $pdo, string $quoteId, array $satirlar): void {
    $pdo->prepare('DELETE FROM quote_line_items WHERE quote_id = ?')->execute([$quoteId]);
    $stmt = $pdo->prepare('INSERT INTO quote_line_items (quote_id, sira, urun_kodu, aciklama, marka, model, kategori, miktar, birim, birim_fiyat, secili_parametreler, ym_satir_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($satirlar as $s) {
        $stmt->execute([
            $quoteId, $s['sira'], $s['urunKodu'], $s['aciklama'], $s['marka'], $s['model'], $s['kategori'], $s['miktar'], $s['birim'], $s['birimFiyat'],
            json_encode($s['seciliParametreler'], JSON_UNESCAPED_UNICODE),
            $s['ymSatirId'],
        ]);
    }
}

function nextTeklifNo(PDO $pdo, string $portal): string {
    $prefix = 'TKL';
    $digits = 5;

    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute([$portal]);
    $row = $stmt->fetch();
    if ($row) {
        $data = json_decode($row['data'], true) ?? [];
        if (!empty($data['teklifPrefix'])) $prefix = (string)$data['teklifPrefix'];
        if (!empty($data['teklifDigits'])) $digits = (int)$data['teklifDigits'];
    }

    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(teklif_no, ?) AS UNSIGNED)) AS mx FROM quotes WHERE teklif_no LIKE CONCAT(?, '%')");
    $stmt->execute([strlen($prefix) + 1, $prefix]);
    $mx = (int)($stmt->fetch()['mx'] ?? 0);

    return $prefix . str_pad((string)($mx + 1), $digits, '0', STR_PAD_LEFT);
}
