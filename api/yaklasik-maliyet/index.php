<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';
require __DIR__ . '/../../includes/teklif.php';

// Yaklaşık Maliyet (Yurtdışı Satış Portalı): teklif öncesi fiyat araştırması.
// Durum saklanmaz; bağlı teklifin durumundan hesaplanır: taslak / aktarildi / kilitli.

$user = requireAuth($pdo);
requirePortalAccess($user, 'ihracat');

class HttpHata extends Exception {}

const YM_SELECT = 'SELECT ce.*, q.teklif_no, q.durum AS teklif_durum, u.ad AS olusturan_ad FROM cost_estimates ce LEFT JOIN quotes q ON q.id = ce.teklif_id LEFT JOIN users u ON u.id = ce.olusturan_kullanici';

function uuid4(): string {
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

// DECIMAL → arayüz metni ("100.0000" → "100"); NULL → '' (boş ile 0 ayrı kalır)
function decStr($v): string {
    if ($v === null) return '';
    $s = (string)$v;
    if (strpos($s, '.') !== false) $s = rtrim(rtrim($s, '0'), '.');
    return $s === '-0' ? '0' : $s;
}

// Arayüz metni → DECIMAL; boş ya da geçersiz → NULL
function sayiOrNull($v, int $ondalik): ?string {
    $s = str_replace(',', '.', trim((string)($v ?? '')));
    if ($s === '' || !is_numeric($s)) return null;
    return number_format(round((float)$s, $ondalik), $ondalik, '.', '');
}

function ymDurum(array $row): string {
    if (empty($row['teklif_id']) || $row['teklif_durum'] === null) return 'taslak';
    return $row['teklif_durum'] === 'Taslak' ? 'aktarildi' : 'kilitli';
}

function ymKalemRow(array $r): array {
    return [
        'id'       => $r['satir_id'],
        'kategori' => $r['kategori'] ?? '',
        'aciklama' => $r['aciklama'] ?? '',
        'marka'    => $r['marka'] ?? '',
        'model'    => $r['model'] ?? '',
        'birim'    => $r['birim'] ?? '',
        'adet'     => decStr($r['adet']),
        'alis'     => decStr($r['alis']),
        'navlun'   => decStr($r['navlun']),
        'gumruk'   => decStr($r['gumruk']),
        'kar'      => decStr($r['kar']),
        'kaynak'   => $r['kaynak'] ?? '',
    ];
}

function ymResponse(array $row, array $kalemler): array {
    $musteri = !empty($row['musteri']) ? json_decode($row['musteri'], true) : null;
    $oranlar = !empty($row['oranlar']) ? json_decode($row['oranlar'], true) : null;
    return [
        'id'               => $row['id'],
        'numara'           => $row['numara'],
        'tarih'            => $row['tarih'],
        'paraBirimi'       => $row['para_birimi'],
        'musteriId'        => $row['musteri_id'],
        'musteri'          => array_merge(['firma' => '', 'kisi' => '', 'email' => '', 'tel' => '', 'adres' => ''], $musteri ?: []),
        'oranlar'          => array_merge(['frt' => '', 'cus' => '', 'mar' => ''], $oranlar ?: []),
        'notlar'           => $row['notlar'] ?? '',
        'teklif'           => (!empty($row['teklif_id']) && $row['teklif_durum'] !== null)
            ? ['id' => $row['teklif_id'], 'teklifNo' => $row['teklif_no'], 'durum' => $row['teklif_durum']]
            : null,
        'durum'            => ymDurum($row),
        'kalemler'         => $kalemler,
        'olusturanAd'      => $row['olusturan_ad'] ?? null,
        'olusturmaTarihi'  => $row['created_at'],
    ];
}

function ymGetir(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare(YM_SELECT . ' WHERE ce.id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $k = $pdo->prepare('SELECT * FROM cost_estimate_items WHERE estimate_id = ? ORDER BY sira ASC, id ASC');
    $k->execute([$id]);
    return ymResponse($row, array_map('ymKalemRow', $k->fetchAll()));
}

function ymAyarlar(PDO $pdo): array {
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['ihracat']);
    $row = $stmt->fetch();
    $data = $row ? (json_decode($row['data'], true) ?? []) : [];
    $prefix = trim((string)($data['ymPrefix'] ?? '')) ?: 'YM';
    return [$prefix, max(1, (int)($data['ymBaslangic'] ?? 1))];
}

// Sonraki no = önek + 4 haneli sayı; sayı = max(başlangıç, aynı önekli en yüksek numara + 1)
function nextYmNo(PDO $pdo): string {
    [$prefix, $baslangic] = ymAyarlar($pdo);
    $stmt = $pdo->prepare("SELECT numara FROM cost_estimates WHERE numara LIKE CONCAT(?, '%')");
    $stmt->execute([$prefix]);
    $mx = 0;
    foreach ($stmt->fetchAll() as $r) {
        $rest = substr($r['numara'], strlen($prefix));
        if ($rest !== '' && ctype_digit($rest)) $mx = max($mx, (int)$rest);
    }
    return $prefix . str_pad((string)max($baslangic, $mx + 1), 4, '0', STR_PAD_LEFT);
}

// Yeni belgede numara boşsa ya da otomatik önekle başlıyorsa kayıt anında sıradaki numara atanır
function otomatikNumaraMi(PDO $pdo, string $numara): bool {
    [$prefix] = ymAyarlar($pdo);
    return $numara === '' || stripos($numara, $prefix) === 0;
}

function numaraKullaniliyor(PDO $pdo, string $numara, ?string $haricId): bool {
    $stmt = $pdo->prepare('SELECT id FROM cost_estimates WHERE numara = ? AND id <> ?');
    $stmt->execute([$numara, $haricId ?? '']);
    return (bool)$stmt->fetch();
}

function musteriIdGecerli(PDO $pdo, $id): ?string {
    $id = strOrNull($id);
    if ($id === null) return null;
    $stmt = $pdo->prepare("SELECT id FROM customers WHERE id = ? AND portal = 'ihracat'");
    $stmt->execute([$id]);
    return $stmt->fetch() ? $id : null;
}

// Ürün adı ve alış fiyatı ikisi de boş satırlar atılır; ürün adı trim edilir
function kalemlerFromInput(array $input): array {
    $out = [];
    foreach (($input['kalemler'] ?? []) as $k) {
        if (!is_array($k)) continue;
        $aciklama = trim((string)($k['aciklama'] ?? ''));
        $alis = sayiOrNull($k['alis'] ?? null, 4);
        if ($aciklama === '' && $alis === null) continue;
        $out[] = [
            'satirId'  => strOrNull($k['id'] ?? null) ?? uuid4(),
            'kategori' => strOrNull($k['kategori'] ?? null),
            'aciklama' => $aciklama,
            'marka'    => strOrNull($k['marka'] ?? null),
            'model'    => strOrNull($k['model'] ?? null),
            'birim'    => strOrNull($k['birim'] ?? null),
            'adet'     => sayiOrNull($k['adet'] ?? null, 3),
            'alis'     => $alis,
            'navlun'   => sayiOrNull($k['navlun'] ?? null, 4),
            'gumruk'   => sayiOrNull($k['gumruk'] ?? null, 4),
            'kar'      => sayiOrNull($k['kar'] ?? null, 4),
            'kaynak'   => strOrNull($k['kaynak'] ?? null),
        ];
    }
    return $out;
}

function kalemleriYaz(PDO $pdo, string $ceId, array $kalemler): void {
    $pdo->prepare('DELETE FROM cost_estimate_items WHERE estimate_id = ?')->execute([$ceId]);
    $stmt = $pdo->prepare('INSERT INTO cost_estimate_items (estimate_id, satir_id, sira, kategori, aciklama, marka, model, birim, adet, alis, navlun, gumruk, kar, kaynak) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($kalemler as $i => $k) {
        $stmt->execute([$ceId, $k['satirId'], $i, $k['kategori'], $k['aciklama'], $k['marka'], $k['model'], $k['birim'], $k['adet'], $k['alis'], $k['navlun'], $k['gumruk'], $k['kar'], $k['kaynak']]);
    }
}

function belgeAlanlari(PDO $pdo, array $input): array {
    $m = is_array($input['musteri'] ?? null) ? $input['musteri'] : [];
    $o = is_array($input['oranlar'] ?? null) ? $input['oranlar'] : [];
    $musteri = [];
    foreach (['firma', 'kisi', 'email', 'tel', 'adres'] as $k) $musteri[$k] = trim((string)($m[$k] ?? ''));
    $oranlar = [];
    foreach (['frt', 'cus', 'mar'] as $k) $oranlar[$k] = sayiOrNull($o[$k] ?? null, 4) === null ? '' : decStr(sayiOrNull($o[$k], 4));
    return [
        'tarih'      => strOrNull($input['tarih'] ?? null),
        'paraBirimi' => in_array($input['paraBirimi'] ?? '', PARA_BIRIMLERI, true) ? $input['paraBirimi'] : 'USD',
        'musteriId'  => musteriIdGecerli($pdo, $input['musteriId'] ?? null),
        'musteri'    => json_encode($musteri, JSON_UNESCAPED_UNICODE),
        'oranlar'    => json_encode($oranlar, JSON_UNESCAPED_UNICODE),
        'notlar'     => strOrNull($input['notlar'] ?? null),
    ];
}

// Yaklaşık maliyeti taslak teklife aktarır: teklife yalnızca teklif birim fiyatı gider.
// Yeniden aktarımda kalemler ym_satir_id ile eşleşir; teklifte girilen ürün kodu korunur, eşleşmeyen eski kalemler düşer.
function teklifeAktar(PDO $pdo, array $user, string $ceId): array {
    $stmt = $pdo->prepare('SELECT * FROM cost_estimates WHERE id = ? FOR UPDATE');
    $stmt->execute([$ceId]);
    $ce = $stmt->fetch();
    $k = $pdo->prepare('SELECT * FROM cost_estimate_items WHERE estimate_id = ? ORDER BY sira ASC, id ASC');
    $k->execute([$ceId]);
    $kalemler = array_values(array_filter($k->fetchAll(), fn($r) => trim((string)$r['aciklama']) !== ''));
    if (!$kalemler) throw new HttpHata('Ürün adı olan en az bir kalem ekleyin', 400);

    $teklif = null;
    if (!empty($ce['teklif_id'])) {
        $q = $pdo->prepare('SELECT * FROM quotes WHERE id = ? FOR UPDATE');
        $q->execute([$ce['teklif_id']]);
        $teklif = $q->fetch() ?: null;
    }
    if ($teklif && $teklif['durum'] !== 'Taslak') throw new HttpHata('Teklif gönderilmiş — buradan artık değiştirilemez', 409);

    $eskiKodlar = [];
    if ($teklif) {
        $e = $pdo->prepare('SELECT ym_satir_id, urun_kodu FROM quote_line_items WHERE quote_id = ? AND ym_satir_id IS NOT NULL');
        $e->execute([$teklif['id']]);
        foreach ($e->fetchAll() as $r) $eskiKodlar[$r['ym_satir_id']] = $r['urun_kodu'];
    }

    $satirlar = [];
    foreach ($kalemler as $i => $r) {
        $c  = (float)($r['alis'] ?? 0);
        $fr = (float)($r['navlun'] ?? 0) / 100;
        $cu = (float)($r['gumruk'] ?? 0) / 100;
        $ma = (float)($r['kar'] ?? 0) / 100;
        $satirlar[] = [
            'sira'               => $i,
            'urunKodu'           => $eskiKodlar[$r['satir_id']] ?? null,
            'aciklama'           => trim((string)$r['aciklama']),
            'marka'              => $r['marka'],
            'model'              => $r['model'],
            'kategori'           => $r['kategori'],
            'miktar'             => (float)($r['adet'] ?? 0),
            'birim'              => ihracatBirim($r['birim']),
            'birimFiyat'         => round($c * (1 + $fr + $cu + $ma), 2),
            'seciliParametreler' => [],
            'ymSatirId'          => $r['satir_id'],
        ];
    }

    $musteri = !empty($ce['musteri']) ? (json_decode($ce['musteri'], true) ?: []) : [];
    $musteriDolu = trim(implode('', array_map('strval', $musteri))) !== '';

    if ($teklif) {
        if ($musteriDolu) {
            $pdo->prepare('UPDATE quotes SET para_birimi = ?, musteri_id = ?, kurum = ?, ilgili_kisi = ?, telefon = ?, email = ? WHERE id = ?')->execute([
                $ce['para_birimi'], $ce['musteri_id'], (string)($musteri['firma'] ?? ''),
                strOrNull($musteri['kisi'] ?? null), strOrNull($musteri['tel'] ?? null), strOrNull($musteri['email'] ?? null), $teklif['id'],
            ]);
        } else {
            $pdo->prepare('UPDATE quotes SET para_birimi = ? WHERE id = ?')->execute([$ce['para_birimi'], $teklif['id']]);
        }
        replaceSatirlar($pdo, $teklif['id'], $satirlar);
        return ['id' => $teklif['id'], 'teklifNo' => $teklif['teklif_no'], 'yeni' => false];
    }

    $teklifId = 't' . (string)(int)round(microtime(true) * 1000);
    $teklifNo = nextTeklifNo($pdo, 'ihracat');
    $bugun = date('Y-m-d');
    $pdo->prepare('INSERT INTO quotes (id, portal, teklif_no, musteri_id, kurum, ilgili_kisi, telefon, email, teklif_tarihi, gecerlilik_tarihi, para_birimi, kdv_oran, sorumlu, durum, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)')->execute([
        $teklifId, 'ihracat', $teklifNo, $ce['musteri_id'], (string)($musteri['firma'] ?? ''),
        strOrNull($musteri['kisi'] ?? null), strOrNull($musteri['tel'] ?? null), strOrNull($musteri['email'] ?? null),
        $bugun, date('Y-m-d', strtotime('+30 days')), $ce['para_birimi'], $user['ad'], 'Taslak', $user['id'],
    ]);
    replaceSatirlar($pdo, $teklifId, $satirlar);
    logStatusHistory($pdo, 'teklif', $teklifId, 'Taslak', $user['id']);
    $pdo->prepare('UPDATE cost_estimates SET teklif_id = ? WHERE id = ?')->execute([$teklifId, $ceId]);
    return ['id' => $teklifId, 'teklifNo' => $teklifNo, 'yeni' => true];
}

function hataVer(int $kod, string $mesaj): void {
    http_response_code($kod);
    echo json_encode(['error' => $mesaj]);
    exit;
}

// Kaydet (+ istenirse teklife aktar) tek işlemde; hata olursa ikisi de geri alınır
function kaydetVeAktar(PDO $pdo, array $user, array $input, ?array $mevcut): void {
    $alan = belgeAlanlari($pdo, $input);
    $kalemler = kalemlerFromInput($input);
    $numara = trim((string)($input['numara'] ?? ''));

    $pdo->beginTransaction();
    try {
        if ($mevcut) {
            $id = $mevcut['id'];
            if ($numara === '') $numara = $mevcut['numara'];
            if (numaraKullaniliyor($pdo, $numara, $id)) throw new HttpHata('Bu numara başka bir yaklaşık maliyette kullanılıyor', 409);
            $pdo->prepare('UPDATE cost_estimates SET numara = ?, tarih = ?, para_birimi = ?, musteri_id = ?, musteri = ?, oranlar = ?, notlar = ? WHERE id = ?')->execute([
                $numara, $alan['tarih'], $alan['paraBirimi'], $alan['musteriId'], $alan['musteri'], $alan['oranlar'], $alan['notlar'], $id,
            ]);
        } else {
            $id = 'ym' . (string)(int)round(microtime(true) * 1000);
            if (otomatikNumaraMi($pdo, $numara)) $numara = nextYmNo($pdo);
            elseif (numaraKullaniliyor($pdo, $numara, null)) throw new HttpHata('Bu numara başka bir yaklaşık maliyette kullanılıyor', 409);
            $pdo->prepare('INSERT INTO cost_estimates (id, numara, tarih, para_birimi, musteri_id, musteri, oranlar, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
                $id, $numara, $alan['tarih'] ?? date('Y-m-d'), $alan['paraBirimi'], $alan['musteriId'], $alan['musteri'], $alan['oranlar'], $alan['notlar'], $user['id'],
            ]);
        }
        kalemleriYaz($pdo, $id, $kalemler);
        $aktarim = !empty($input['aktar']) ? teklifeAktar($pdo, $user, $id) : null;
        $pdo->commit();
    } catch (HttpHata $e) {
        $pdo->rollBack();
        hataVer($e->getCode() ?: 400, $e->getMessage());
    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->getCode() === '23000') hataVer(409, 'Numara çakışması oldu, lütfen tekrar kaydedin');
        throw $e;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    http_response_code($mevcut ? 200 : 201);
    echo json_encode(['maliyet' => ymGetir($pdo, $id), 'teklif' => $aktarim]);
}

function mevcutBelge(PDO $pdo, string $id): array {
    $stmt = $pdo->prepare(YM_SELECT . ' WHERE ce.id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) hataVer(404, 'Yaklaşık maliyet bulunamadı');
    if (ymDurum($row) === 'kilitli') hataVer(409, 'Bağlı teklif gönderildiği için bu yaklaşık maliyet değiştirilemez');
    return $row;
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        $rows = $pdo->query(YM_SELECT . ' ORDER BY ce.created_at DESC')->fetchAll();
        $kalemMap = [];
        foreach ($pdo->query('SELECT * FROM cost_estimate_items ORDER BY sira ASC, id ASC')->fetchAll() as $r) {
            $kalemMap[$r['estimate_id']][] = ymKalemRow($r);
        }
        echo json_encode(['maliyetler' => array_map(fn($r) => ymResponse($r, $kalemMap[$r['id']] ?? []), $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        kaydetVeAktar($pdo, $user, $input, null);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (string)($input['id'] ?? '');
        if ($id === '') hataVer(400, 'id gerekli');
        kaydetVeAktar($pdo, $user, $input, mevcutBelge($pdo, $id));
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') hataVer(400, 'id gerekli');
        mevcutBelge($pdo, $id);
        $pdo->prepare('DELETE FROM cost_estimates WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        hataVer(405, 'Method Not Allowed');
}
