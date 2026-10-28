<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);

require __DIR__ . '/../../includes/teklif.php';

function normalizePortal($value): ?string {
    $value = (string)($value ?? '');
    return in_array($value, ['servis', 'satis', 'ihracat'], true) ? $value : null;
}

function teklifResponse(PDO $pdo, array $row, ?array $satirlar = null, ?array $durumGecmisi = null): array {
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
        'kdvOran'            => (int)($row['kdv_oran'] ?? 0),
        'teslimat'           => $row['teslimat'],
        'incoterm'           => $row['incoterm'] ?? null,
        'teslimYeri'         => $row['teslim_yeri'] ?? null,
        'bankaHesabi'        => !empty($row['banka_hesabi']) ? json_decode($row['banka_hesabi'], true) : null,
        'sorumlu'            => $row['sorumlu'],
        'durum'              => $row['durum'],
        'redNedeni'          => $row['red_nedeni'],
        'parentId'           => $row['parent_id'],
        'revizyonNo'         => (int)($row['revizyon_no'] ?? 0),
        'satirlar'           => $satirlar ?? fetchSatirlar($pdo, $row['id']),
        'olusturanKullanici' => $row['olusturan_kullanici'],
        'olusturanAd'        => $row['olusturan_ad'] ?? null,
        'olusturanEmail'     => $row['olusturan_email'] ?? null,
        'olusturanTelefon'   => $row['olusturan_telefon'] ?? null,
        'olusturmaTarihi'    => $row['created_at'],
        'durumGecmisi'       => $durumGecmisi ?? fetchStatusHistory($pdo, 'teklif', $row['id']),
        'yaklasikMaliyet'    => !empty($row['ym_id']) ? ['id' => $row['ym_id'], 'numara' => $row['ym_numara']] : null,
    ];
}

// Yurtdışı teklif alanları [incoterm, teslim_yeri, banka_hesabi]; diğer portallarda NULL
function ihracatAlanlari(array $input, string $portal): array {
    if ($portal !== 'ihracat') return [null, null, null];
    $incoterm = in_array($input['incoterm'] ?? '', INCOTERMS, true) ? $input['incoterm'] : null;
    $banka = $input['bankaHesabi'] ?? null;
    $bankaJson = null;
    if (is_array($banka) && trim((string)($banka['iban'] ?? '')) !== '') {
        $temiz = [];
        foreach (['bankaAdi', 'sube', 'hesapSahibi', 'iban', 'swift', 'paraBirimi'] as $k) {
            $temiz[$k] = trim((string)($banka[$k] ?? ''));
        }
        $bankaJson = json_encode($temiz, JSON_UNESCAPED_UNICODE);
    }
    return [$incoterm, strOrNull($input['teslimYeri'] ?? null), $bankaJson];
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $portal = normalizePortal($_GET['portal'] ?? '');
        if (!$portal) {
            http_response_code(400);
            echo json_encode(['error' => 'portal parametresi (servis, satis veya ihracat) zorunlu']);
            exit;
        }
        requirePortalAccess($user, $portal);

        $stmt = $pdo->prepare(TEKLIF_SELECT . ' WHERE q.portal = ? ORDER BY q.created_at DESC');
        $stmt->execute([$portal]);
        $rows = $stmt->fetchAll();

        $satirlarMap = [];
        $durumMap = [];
        if ($rows) {
            $ids = array_column($rows, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $satirStmt = $pdo->prepare("SELECT * FROM quote_line_items WHERE quote_id IN ($placeholders) ORDER BY sira ASC, id ASC");
            $satirStmt->execute($ids);
            foreach ($satirStmt->fetchAll() as $s) {
                $satirlarMap[$s['quote_id']][] = mapSatirRow($s);
            }
            $durumMap = fetchStatusHistoryMap($pdo, 'teklif', $ids);
        }

        echo json_encode(['teklifler' => array_map(
            fn(array $r) => teklifResponse($pdo, $r, $satirlarMap[$r['id']] ?? [], $durumMap[$r['id']] ?? []),
            $rows
        )]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $portal = normalizePortal($input['portal'] ?? '');
        $kurum = trim((string)($input['kurum'] ?? ''));
        if (!$portal || $kurum === '') {
            http_response_code(400);
            echo json_encode(['error' => 'portal (servis/satis/ihracat) ve kurum adı zorunlu']);
            exit;
        }
        requirePortalAccess($user, $portal);

        $id = 't' . (string)(int)round(microtime(true) * 1000);
        $parentId = strOrNull($input['parentId'] ?? null);
        $revizyonNo = (int)($input['revizyonNo'] ?? 0);
        // Revizyon ise gelen teklifNo kullan, değilse otomatik üret
        $teklifNo = ($parentId !== null && !empty($input['teklifNo']))
            ? trim((string)$input['teklifNo'])
            : nextTeklifNo($pdo, $portal);
        $satirlar = satirlarFromInput($input, $portal);
        $kdvOran = ($portal !== 'ihracat' && in_array((int)($input['kdvOran'] ?? 0), [0, 10, 20], true)) ? (int)($input['kdvOran'] ?? 0) : 0;
        [$incoterm, $teslimYeri, $bankaJson] = ihracatAlanlari($input, $portal);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO quotes (id, portal, teklif_no, parent_id, revizyon_no, musteri_id, servis_id, kayit_no, seri_no, kurum, ilgili_kisi, telefon, email, teklif_tarihi, gecerlilik_tarihi, notlar, para_birimi, odeme_kosulu, vade, kdv_oran, teslimat, incoterm, teslim_yeri, banka_hesabi, sorumlu, durum, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $id, $portal, $teklifNo, $parentId, $revizyonNo,
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
                $kdvOran,
                strOrNull($input['teslimat'] ?? null),
                $incoterm,
                $teslimYeri,
                $bankaJson,
                strOrNull($input['sorumlu'] ?? null) ?? $user['ad'],
                'Taslak',
                $user['id'],
            ]);
            replaceSatirlar($pdo, $id, $satirlar);
            logStatusHistory($pdo, 'teklif', $id, 'Taslak', $user['id']);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare(TEKLIF_SELECT . ' WHERE q.id = ?');
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

        $satirlar = satirlarFromInput($input, $existing['portal']);
        $kdvOran = ($existing['portal'] !== 'ihracat' && in_array((int)($input['kdvOran'] ?? 0), [0, 10, 20], true)) ? (int)($input['kdvOran'] ?? 0) : 0;
        [$incoterm, $teslimYeri, $bankaJson] = ihracatAlanlari($input, $existing['portal']);
        $yeniDurum = enumOrDefault($input['durum'] ?? $existing['durum'], DURUM_DEGERLERI, $existing['durum']);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('UPDATE quotes SET musteri_id=?, servis_id=?, kayit_no=?, seri_no=?, kurum=?, ilgili_kisi=?, telefon=?, email=?, teklif_tarihi=?, gecerlilik_tarihi=?, notlar=?, para_birimi=?, odeme_kosulu=?, vade=?, kdv_oran=?, teslimat=?, incoterm=?, teslim_yeri=?, banka_hesabi=?, sorumlu=?, durum=?, red_nedeni=? WHERE id=?');
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
                $kdvOran,
                strOrNull($input['teslimat'] ?? null),
                $incoterm,
                $teslimYeri,
                $bankaJson,
                strOrNull($input['sorumlu'] ?? $existing['sorumlu']),
                $yeniDurum,
                strOrNull($input['redNedeni'] ?? $existing['red_nedeni']),
                $id,
            ]);
            replaceSatirlar($pdo, $id, $satirlar);
            if ($yeniDurum !== $existing['durum']) {
                logStatusHistory($pdo, 'teklif', $id, $yeniDurum, $user['id']);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare(TEKLIF_SELECT . ' WHERE q.id = ?');
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
