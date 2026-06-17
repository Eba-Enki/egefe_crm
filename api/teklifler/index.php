<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);

const DURUM_DEGERLERI = ['Taslak','Açık Teklif','Onay Bekleniyor','Onaylandı','Kabul Edildi','Siparişe Aktarıldı','Gönderildi','Reddedildi','İptal Edildi','Tamamlandı'];
const BIRIM_DEGERLERI = ['Adet','Saat','Gün','Parça'];
const PARA_BIRIMLERI = ['TRY','USD','EUR','GBP'];



function normalizePortal($value): ?string {
    $value = (string)($value ?? '');
    return in_array($value, ['servis', 'satis'], true) ? $value : null;
}

function satirlarFromInput(array $input): array {
    $out = [];
    foreach (($input['satirlar'] ?? []) as $i => $s) {
        $out[] = [
            'sira'               => $i,
            'aciklama'           => strOrNull($s['aciklama'] ?? null),
            'miktar'             => (float)($s['miktar'] ?? 0),
            'birim'              => enumOrDefault($s['birim'] ?? null, BIRIM_DEGERLERI, 'Adet'),
            'birimFiyat'         => (float)($s['birimFiyat'] ?? 0),
            'seciliParametreler' => $s['seciliParametreler'] ?? [],
        ];
    }
    return $out;
}

function fetchSatirlar(PDO $pdo, string $quoteId): array {
    $stmt = $pdo->prepare('SELECT * FROM quote_line_items WHERE quote_id = ? ORDER BY sira ASC, id ASC');
    $stmt->execute([$quoteId]);
    return array_map(function (array $row): array {
        return [
            'aciklama'           => $row['aciklama'],
            'miktar'             => (float)$row['miktar'],
            'birim'              => $row['birim'],
            'birimFiyat'         => (float)$row['birim_fiyat'],
            'seciliParametreler' => $row['secili_parametreler'] ? json_decode($row['secili_parametreler'], true) : [],
        ];
    }, $stmt->fetchAll());
}

function replaceSatirlar(PDO $pdo, string $quoteId, array $satirlar): void {
    $pdo->prepare('DELETE FROM quote_line_items WHERE quote_id = ?')->execute([$quoteId]);
    $stmt = $pdo->prepare('INSERT INTO quote_line_items (quote_id, sira, aciklama, miktar, birim, birim_fiyat, secili_parametreler) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($satirlar as $s) {
        $stmt->execute([
            $quoteId, $s['sira'], $s['aciklama'], $s['miktar'], $s['birim'], $s['birimFiyat'],
            json_encode($s['seciliParametreler'], JSON_UNESCAPED_UNICODE),
        ]);
    }
}

function teklifResponse(PDO $pdo, array $row): array {
    return [
        'id'                 => $row['id'],
        'portal'             => $row['portal'],
        'teklifNo'           => $row['teklif_no'],
        'musteriId'          => $row['musteri_id'],
        'servisId'           => $row['servis_id'],
        'kayitNo'            => $row['kayit_no'],
        'seriNo'             => $row['seri_no'],
        'kurum'              => $row['kurum'],
        'ilgiliKisi'         => $row['ilgili_kisi'],
        'telefon'            => $row['telefon'],
        'email'              => $row['email'],
        'teklifTarihi'       => $row['teklif_tarihi'],
        'gecerlilikTarihi'   => $row['gecerlilik_tarihi'],
        'notlar'             => $row['notlar'],
        'paraBirimi'         => $row['para_birimi'],
        'odemeKosulu'        => $row['odeme_kosulu'],
        'vade'               => $row['vade'],
        'teslimat'           => $row['teslimat'],
        'sorumlu'            => $row['sorumlu'],
        'durum'              => $row['durum'],
        'redNedeni'          => $row['red_nedeni'],
        'satirlar'           => fetchSatirlar($pdo, $row['id']),
        'olusturanKullanici' => $row['olusturan_kullanici'],
        'olusturmaTarihi'    => $row['created_at'],
    ];
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

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $portal = normalizePortal($_GET['portal'] ?? '');
        if (!$portal) {
            http_response_code(400);
            echo json_encode(['error' => 'portal parametresi (servis veya satis) zorunlu']);
            exit;
        }
        requirePortalAccess($user, $portal);

        $stmt = $pdo->prepare('SELECT * FROM quotes WHERE portal = ? ORDER BY created_at DESC');
        $stmt->execute([$portal]);
        $rows = $stmt->fetchAll();
        echo json_encode(['teklifler' => array_map(fn(array $r) => teklifResponse($pdo, $r), $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $portal = normalizePortal($input['portal'] ?? '');
        $kurum = trim((string)($input['kurum'] ?? ''));
        if (!$portal || $kurum === '') {
            http_response_code(400);
            echo json_encode(['error' => 'portal (servis/satis) ve kurum adı zorunlu']);
            exit;
        }
        requirePortalAccess($user, $portal);

        $id = 't' . (string)(int)round(microtime(true) * 1000);
        $teklifNo = nextTeklifNo($pdo, $portal);
        $satirlar = satirlarFromInput($input);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO quotes (id, portal, teklif_no, musteri_id, servis_id, kayit_no, seri_no, kurum, ilgili_kisi, telefon, email, teklif_tarihi, gecerlilik_tarihi, notlar, para_birimi, odeme_kosulu, vade, teslimat, sorumlu, durum, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $id, $portal, $teklifNo,
                strOrNull($input['musteriId'] ?? null),
                strOrNull($input['servisId'] ?? null),
                strOrNull($input['kayitNo'] ?? null),
                strOrNull($input['seriNo'] ?? null),
                $kurum,
                strOrNull($input['ilgiliKisi'] ?? null),
                strOrNull($input['telefon'] ?? null),
                strOrNull($input['email'] ?? null),
                strOrNull($input['teklifTarihi'] ?? null),
                strOrNull($input['gecerlilikTarihi'] ?? null),
                strOrNull($input['notlar'] ?? null),
                in_array($input['paraBirimi'] ?? '', PARA_BIRIMLERI, true) ? $input['paraBirimi'] : 'TRY',
                strOrNull($input['odemeKosulu'] ?? null),
                strOrNull($input['vade'] ?? null),
                strOrNull($input['teslimat'] ?? null),
                strOrNull($input['sorumlu'] ?? null) ?? $user['ad'],
                'Taslak',
                $user['id'],
            ]);
            replaceSatirlar($pdo, $id, $satirlar);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM quotes WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['teklif' => teklifResponse($pdo, $stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (string)($input['id'] ?? '');
        $kurum = trim((string)($input['kurum'] ?? ''));
        if ($id === '' || $kurum === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id ve kurum adı zorunlu']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM quotes WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Teklif bulunamadı']);
            exit;
        }
        requirePortalAccess($user, $existing['portal']);

        $satirlar = satirlarFromInput($input);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('UPDATE quotes SET musteri_id=?, servis_id=?, kayit_no=?, seri_no=?, kurum=?, ilgili_kisi=?, telefon=?, email=?, teklif_tarihi=?, gecerlilik_tarihi=?, notlar=?, para_birimi=?, odeme_kosulu=?, vade=?, teslimat=?, sorumlu=?, durum=?, red_nedeni=? WHERE id=?');
            $stmt->execute([
                strOrNull($input['musteriId'] ?? null),
                strOrNull($input['servisId'] ?? null),
                strOrNull($input['kayitNo'] ?? null),
                strOrNull($input['seriNo'] ?? null),
                $kurum,
                strOrNull($input['ilgiliKisi'] ?? null),
                strOrNull($input['telefon'] ?? null),
                strOrNull($input['email'] ?? null),
                strOrNull($input['teklifTarihi'] ?? null),
                strOrNull($input['gecerlilikTarihi'] ?? null),
                strOrNull($input['notlar'] ?? null),
                in_array($input['paraBirimi'] ?? '', PARA_BIRIMLERI, true) ? $input['paraBirimi'] : 'TRY',
                strOrNull($input['odemeKosulu'] ?? null),
                strOrNull($input['vade'] ?? null),
                strOrNull($input['teslimat'] ?? null),
                strOrNull($input['sorumlu'] ?? $existing['sorumlu']),
                enumOrDefault($input['durum'] ?? $existing['durum'], DURUM_DEGERLERI, $existing['durum']),
                strOrNull($input['redNedeni'] ?? $existing['red_nedeni']),
                $id,
            ]);
            replaceSatirlar($pdo, $id, $satirlar);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM quotes WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['teklif' => teklifResponse($pdo, $stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }

        $check = $pdo->prepare('SELECT portal FROM quotes WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Teklif bulunamadı']);
            exit;
        }
        requirePortalAccess($user, $existing['portal']);

        $pdo->prepare('DELETE FROM quotes WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
