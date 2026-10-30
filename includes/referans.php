<?php
declare(strict_types=1);

// Referans standart (ana stok / ara stok / kontrol) API'lerinin ortak yardımcıları.
// Hacimler µL, konsantrasyonlar µg/mL.

const REF_ANA_DURUMLARI = ['Kapalı Ambalaj', 'Açık Ambalaj', 'Tükendi', 'İmha'];

function refRequireWrite(array $user): void {
    if ($user['rol'] === 'izleyici') {
        http_response_code(403);
        echo json_encode(['error' => 'Bu işlem için yetkiniz yok']);
        exit;
    }
}

function refFail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

// Aynı milisaniyede birden fazla kayıt (toplu aktarım) çakışmasın diye rastgele ek
function refId(string $prefix): string {
    return $prefix . (string)(int)round(microtime(true) * 1000) . bin2hex(random_bytes(3));
}

function refNumOrNull($value): ?float {
    if ($value === null || $value === '') return null;
    if (!is_numeric($value)) return null;
    return (float)$value;
}

function refDateOrNull($value): ?string {
    $value = strOrNull($value);
    if ($value === null) return null;
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
}

function refBugun(): string {
    return (new DateTime('now', new DateTimeZone('Europe/Istanbul')))->format('Y-m-d');
}

function refAnaResponse(array $row): array {
    return [
        'id'             => $row['id'],
        'kod'            => $row['kod'],
        'grup'           => $row['grup'],
        'standartAdi'    => $row['standart_adi'],
        'katalogNo'      => $row['katalog_no'],
        'lotNo'          => $row['lot_no'],
        'uretici'        => $row['uretici'],
        'konsantrasyon'  => $row['konsantrasyon'] === null ? null : (float)$row['konsantrasyon'],
        'cozucu'         => $row['cozucu'],
        'ilkHacim'       => (float)$row['ilk_hacim'],
        'kalanHacim'     => (float)$row['kalan_hacim'],
        'durum'          => $row['durum'],
        'acilisTarihi'   => $row['acilis_tarihi'],
        'skt'            => $row['skt'],
        'konumTipi'      => $row['konum_tipi'],
        'konumPozisyon'  => $row['konum_pozisyon'],
        'dogrulanmadi'   => (bool)$row['dogrulanmadi'],
        'notlar'         => $row['notlar'],
        'olusturmaTarihi'=> $row['created_at'],
    ];
}

function refHareketResponse(array $row): array {
    return [
        'id'          => (int)$row['id'],
        'stokTipi'    => $row['stok_tipi'],
        'stokId'      => $row['stok_id'],
        'tip'         => $row['tip'],
        'miktar'      => (float)$row['miktar'],
        'kalanSonra'  => (float)$row['kalan_sonra'],
        'tarih'       => $row['tarih'],
        'aciklama'    => $row['aciklama'],
        'ilgiliId'    => $row['ilgili_id'],
        'kullaniciAd' => $row['kullanici_ad'] ?? null,
        'kayitZamani' => $row['created_at'],
    ];
}

function refHareketYaz(PDO $pdo, string $stokTipi, string $stokId, string $tip, float $miktar, float $kalanSonra, string $tarih, ?string $aciklama, ?string $kullaniciId, ?string $ilgiliId = null): void {
    $stmt = $pdo->prepare('INSERT INTO ref_hareketler (stok_tipi, stok_id, tip, miktar, kalan_sonra, tarih, aciklama, ilgili_id, kullanici_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$stokTipi, $stokId, $tip, $miktar, $kalanSonra, $tarih, $aciklama, $ilgiliId, $kullaniciId]);
}

function refHareketleriGetir(PDO $pdo, string $stokTipi, string $stokId): array {
    $stmt = $pdo->prepare('SELECT h.*, u.ad AS kullanici_ad FROM ref_hareketler h LEFT JOIN users u ON u.id = h.kullanici_id WHERE h.stok_tipi = ? AND h.stok_id = ? ORDER BY h.tarih ASC, h.id ASC');
    $stmt->execute([$stokTipi, $stokId]);
    return array_map('refHareketResponse', $stmt->fetchAll());
}

// AS-0001 biçiminde sıradaki kod numarası
function refSonrakiKodNo(PDO $pdo, string $tablo, string $prefix): int {
    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(kod, ?) AS UNSIGNED)) AS mx FROM $tablo WHERE kod LIKE CONCAT(?, '%')");
    $stmt->execute([strlen($prefix) + 1, $prefix]);
    return (int)($stmt->fetch()['mx'] ?? 0) + 1;
}

function refKod(string $prefix, int $no): string {
    return $prefix . str_pad((string)$no, 4, '0', STR_PAD_LEFT);
}
