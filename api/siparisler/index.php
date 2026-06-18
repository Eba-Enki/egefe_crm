<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'satis');

const DURUM_DEGERLERI = ['Hazırlanıyor','Kısmi Teslimat','Teslim Edildi','İptal','Fatura Edildi'];
const BIRIM_DEGERLERI = ['Adet','Saat','Gün','Parça'];
const PARA_BIRIMLERI = ['TRY','USD','EUR','GBP'];



function satirlarFromInput(array $input): array {
    $out = [];
    foreach (($input['satirlar'] ?? []) as $i => $s) {
        $out[] = [
            'sira'               => $i,
            'aciklama'           => strOrNull($s['aciklama'] ?? null),
            'miktar'             => (float)($s['miktar'] ?? 0),
            'gonderilen'         => (float)($s['gonderilen'] ?? 0),
            'faturalanan'        => (float)($s['faturalanan'] ?? 0),
            'birim'              => enumOrDefault($s['birim'] ?? null, BIRIM_DEGERLERI, 'Adet'),
            'birimFiyat'         => (float)($s['birimFiyat'] ?? 0),
            'seciliParametreler' => $s['seciliParametreler'] ?? [],
        ];
    }
    return $out;
}

function mapSatirRow(array $row): array {
    return [
        'aciklama'           => $row['aciklama'],
        'miktar'             => (float)$row['miktar'],
        'gonderilen'         => (float)$row['gonderilen'],
        'faturalanan'        => (float)$row['faturalanan'],
        'birim'              => $row['birim'],
        'birimFiyat'         => (float)$row['birim_fiyat'],
        'seciliParametreler' => $row['secili_parametreler'] ? json_decode($row['secili_parametreler'], true) : [],
    ];
}

function fetchSatirlar(PDO $pdo, string $orderId): array {
    $stmt = $pdo->prepare('SELECT * FROM order_line_items WHERE order_id = ? ORDER BY sira ASC, id ASC');
    $stmt->execute([$orderId]);
    return array_map('mapSatirRow', $stmt->fetchAll());
}

function replaceSatirlar(PDO $pdo, string $orderId, array $satirlar): void {
    $pdo->prepare('DELETE FROM order_line_items WHERE order_id = ?')->execute([$orderId]);
    $stmt = $pdo->prepare('INSERT INTO order_line_items (order_id, sira, aciklama, miktar, gonderilen, faturalanan, birim, birim_fiyat, secili_parametreler) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($satirlar as $s) {
        $stmt->execute([
            $orderId, $s['sira'], $s['aciklama'], $s['miktar'], $s['gonderilen'], $s['faturalanan'], $s['birim'], $s['birimFiyat'],
            json_encode($s['seciliParametreler'], JSON_UNESCAPED_UNICODE),
        ]);
    }
}

// Tüm kalemler hem teslim hem faturalananı tam ise siparişi Fatura Edildi'ye taşır
function checkAutoFaturaEdildi(PDO $pdo, string $orderId): bool {
    $stmt = $pdo->prepare('SELECT COUNT(*) AS eksik FROM order_line_items WHERE order_id = ? AND (gonderilen < miktar OR faturalanan < miktar)');
    $stmt->execute([$orderId]);
    if ((int)$stmt->fetch()['eksik'] === 0) {
        $pdo->prepare("UPDATE orders SET durum = 'Fatura Edildi' WHERE id = ? AND durum != 'Fatura Edildi'")->execute([$orderId]);
        return true;
    }
    return false;
}

function siparisResponse(PDO $pdo, array $row, ?array $satirlar = null): array {
    return [
        'id'                 => $row['id'],
        'siparisNo'          => $row['siparis_no'],
        'teklifId'           => $row['teklif_id'],
        'teklifNo'           => $row['teklif_no'],
        'kurum'              => $row['kurum'],
        'ilgiliKisi'         => $row['ilgili_kisi'],
        'telefon'            => $row['telefon'],
        'email'              => $row['email'],
        'sorumlu'            => $row['sorumlu'],
        'satisTemsilcisi'    => $row['satis_temsilcisi'],
        'paraBirimi'         => $row['para_birimi'],
        'odemeKosulu'        => $row['odeme_kosulu'],
        'vade'               => $row['vade'],
        'teslimat'           => $row['teslimat'],
        'tahminTeslimat'     => $row['tahmini_teslimat'],
        'teklifTarihi'       => $row['teklif_tarihi'],
        'siparisTarihi'      => $row['siparis_tarihi'],
        'notlar'             => $row['notlar'],
        'durum'              => $row['durum'],
        'satirlar'           => $satirlar ?? fetchSatirlar($pdo, $row['id']),
        'olusturanKullanici' => $row['olusturan_kullanici'],
        'olusturmaTarihi'    => $row['created_at'],
    ];
}

function nextSiparisNo(PDO $pdo): string {
    $prefix = 'SIP';
    $digits = 5;

    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['satis']);
    $row = $stmt->fetch();
    if ($row) {
        $data = json_decode($row['data'], true) ?? [];
        if (!empty($data['siparisPrefix'])) $prefix = (string)$data['siparisPrefix'];
        if (!empty($data['siparisDigits'])) $digits = (int)$data['siparisDigits'];
    }

    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(siparis_no, ?) AS UNSIGNED)) AS mx FROM orders WHERE siparis_no LIKE CONCAT(?, '%')");
    $stmt->execute([strlen($prefix) + 1, $prefix]);
    $mx = (int)($stmt->fetch()['mx'] ?? 0);

    return $prefix . str_pad((string)($mx + 1), $digits, '0', STR_PAD_LEFT);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM orders ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();

        $satirlarMap = [];
        if ($rows) {
            $ids = array_column($rows, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $satirStmt = $pdo->prepare("SELECT * FROM order_line_items WHERE order_id IN ($placeholders) ORDER BY sira ASC, id ASC");
            $satirStmt->execute($ids);
            foreach ($satirStmt->fetchAll() as $s) {
                $satirlarMap[$s['order_id']][] = mapSatirRow($s);
            }
        }

        echo json_encode(['siparisler' => array_map(
            fn(array $r) => siparisResponse($pdo, $r, $satirlarMap[$r['id']] ?? []),
            $rows
        )]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $kurum = trim((string)($input['kurum'] ?? ''));
        if ($kurum === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Kurum adı zorunlu']);
            exit;
        }

        $id = 'sp' . (string)(int)round(microtime(true) * 1000);
        $siparisNo = nextSiparisNo($pdo);
        $satirlar = satirlarFromInput($input);
        $teklifId = strOrNull($input['teklifId'] ?? null);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO orders (id, siparis_no, teklif_id, teklif_no, kurum, ilgili_kisi, telefon, email, sorumlu, satis_temsilcisi, para_birimi, odeme_kosulu, vade, teslimat, tahmini_teslimat, teklif_tarihi, siparis_tarihi, notlar, durum, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $id, $siparisNo, $teklifId,
                strOrNull($input['teklifNo'] ?? null),
                $kurum,
                strOrNull($input['ilgiliKisi'] ?? null),
                strOrNull($input['telefon'] ?? null),
                strOrNull($input['email'] ?? null),
                strOrNull($input['sorumlu'] ?? null) ?? $user['ad'],
                strOrNull($input['satisTemsilcisi'] ?? null) ?? strOrNull($input['sorumlu'] ?? null) ?? $user['ad'],
                in_array($input['paraBirimi'] ?? '', PARA_BIRIMLERI, true) ? $input['paraBirimi'] : 'TRY',
                strOrNull($input['odemeKosulu'] ?? null),
                strOrNull($input['vade'] ?? null),
                strOrNull($input['teslimat'] ?? null),
                strOrNull($input['tahminTeslimat'] ?? null),
                strOrNull($input['teklifTarihi'] ?? null),
                strOrNull($input['siparisTarihi'] ?? null),
                strOrNull($input['notlar'] ?? null),
                'Hazırlanıyor',
                $user['id'],
            ]);
            replaceSatirlar($pdo, $id, $satirlar);

            if ($teklifId) {
                $pdo->prepare("UPDATE quotes SET durum = 'Siparişe Dönüştü' WHERE id = ?")->execute([$teklifId]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['siparis' => siparisResponse($pdo, $stmt->fetch())]);
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

        $check = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Sipariş bulunamadı']);
            exit;
        }

        $satirlar = satirlarFromInput($input);
        $durum = enumOrDefault($input['durum'] ?? $existing['durum'], DURUM_DEGERLERI, $existing['durum']);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('UPDATE orders SET teklif_id=?, teklif_no=?, kurum=?, ilgili_kisi=?, telefon=?, email=?, sorumlu=?, satis_temsilcisi=?, para_birimi=?, odeme_kosulu=?, vade=?, teslimat=?, tahmini_teslimat=?, teklif_tarihi=?, siparis_tarihi=?, notlar=?, durum=? WHERE id=?');
            $stmt->execute([
                strOrNull($input['teklifId'] ?? $existing['teklif_id']),
                strOrNull($input['teklifNo'] ?? $existing['teklif_no']),
                $kurum,
                strOrNull($input['ilgiliKisi'] ?? null),
                strOrNull($input['telefon'] ?? null),
                strOrNull($input['email'] ?? null),
                strOrNull($input['sorumlu'] ?? $existing['sorumlu']),
                strOrNull($input['satisTemsilcisi'] ?? $existing['satis_temsilcisi']),
                in_array($input['paraBirimi'] ?? '', PARA_BIRIMLERI, true) ? $input['paraBirimi'] : 'TRY',
                strOrNull($input['odemeKosulu'] ?? null),
                strOrNull($input['vade'] ?? null),
                strOrNull($input['teslimat'] ?? null),
                strOrNull($input['tahminTeslimat'] ?? $existing['tahmini_teslimat']),
                strOrNull($input['teklifTarihi'] ?? null),
                strOrNull($input['siparisTarihi'] ?? null),
                strOrNull($input['notlar'] ?? null),
                $durum,
                $id,
            ]);
            replaceSatirlar($pdo, $id, $satirlar);

            $teklifId = strOrNull($input['teklifId'] ?? $existing['teklif_id']);
            if ($teklifId && $durum === 'İptal' && $existing['durum'] !== 'İptal') {
                $pdo->prepare("UPDATE quotes SET durum = 'Reddedildi' WHERE id = ? AND portal = 'satis'")->execute([$teklifId]);
            }
            // Tüm kalemler teslim+faturalanan tamam ise otomatik Fatura Edildi'ye geç
            if (!in_array($durum, ['İptal','Fatura Edildi'], true)) {
                checkAutoFaturaEdildi($pdo, $id);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['siparis' => siparisResponse($pdo, $stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $stmt = $pdo->prepare('DELETE FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Sipariş bulunamadı']);
            exit;
        }
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
