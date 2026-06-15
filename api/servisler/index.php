<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'servis');

const GARANTI_DEGERLERI = ['Evet', 'Hayır'];
const DURUM_DEGERLERI = ['Yeni Gelen', 'S.F. Bekleniyor', 'Onay Bekleniyor', 'Onaylandı', 'Kargoya Verildi', 'Tamamlandı', 'Reddedildi', 'İade Edildi'];

function servisResponse(array $row): array {
    return [
        'id'               => $row['id'],
        'kayitNo'          => $row['kayit_no'],
        'musteriId'        => $row['musteri_id'],
        'kurumAdi'         => $row['kurum_adi'],
        'ilgiliKisi'       => $row['ilgili_kisi'],
        'telefon'          => $row['telefon'],
        'email'            => $row['email'],
        'urunAdi'          => $row['urun_adi'],
        'seriNo'           => $row['seri_no'],
        'aksesuarlar'      => $row['aksesuarlar'] ? json_decode($row['aksesuarlar'], true) : [],
        'aksesyarDiger'    => $row['aksesuar_diger'],
        'gelisTarihi'      => $row['gelis_tarihi'],
        'garantiDurumu'    => $row['garanti_durumu'],
        'durum'            => $row['durum'],
        'kargoTarihi'      => $row['kargo_tarihi'],
        'kargoFirmasi'     => $row['kargo_firmasi'],
        'teslimAlan'       => $row['teslim_alan'],
        'notlar'           => $row['notlar'],
        'olusturanKullanici' => $row['olusturan_kullanici'],
        'olusturmaTarihi'  => $row['created_at'],
    ];
}

function strOrNull($value): ?string {
    $value = trim((string)($value ?? ''));
    return $value === '' ? null : $value;
}

function enumOrDefault($value, array $allowed, string $default): string {
    return in_array($value, $allowed, true) ? $value : $default;
}

function nextServisKayitNo(PDO $pdo): string {
    $prefix = 'KN';
    $digits = 6;

    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['servis']);
    $row = $stmt->fetch();
    if ($row) {
        $data = json_decode($row['data'], true) ?? [];
        if (!empty($data['servisPrefix'])) $prefix = (string)$data['servisPrefix'];
        if (!empty($data['servisDigits'])) $digits = (int)$data['servisDigits'];
    }

    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(kayit_no, ?) AS UNSIGNED)) AS mx FROM service_records WHERE kayit_no LIKE CONCAT(?, '%')");
    $stmt->execute([strlen($prefix) + 1, $prefix]);
    $mx = (int)($stmt->fetch()['mx'] ?? 0);

    return $prefix . str_pad((string)($mx + 1), $digits, '0', STR_PAD_LEFT);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM service_records ORDER BY created_at DESC');
        echo json_encode(['servisler' => array_map('servisResponse', $stmt->fetchAll())]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $kurumAdi = trim((string)($input['kurumAdi'] ?? ''));
        if ($kurumAdi === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Kurum adı zorunlu']);
            exit;
        }

        $id = 's' . (string)(int)round(microtime(true) * 1000);
        $kayitNo = nextServisKayitNo($pdo);

        $stmt = $pdo->prepare('INSERT INTO service_records (id, kayit_no, musteri_id, kurum_adi, ilgili_kisi, telefon, email, urun_adi, seri_no, aksesuarlar, aksesuar_diger, gelis_tarihi, garanti_durumu, durum, kargo_tarihi, kargo_firmasi, teslim_alan, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $id, $kayitNo,
            strOrNull($input['musteriId'] ?? null),
            $kurumAdi,
            strOrNull($input['ilgiliKisi'] ?? null),
            strOrNull($input['telefon'] ?? null),
            strOrNull($input['email'] ?? null),
            strOrNull($input['urunAdi'] ?? null),
            strOrNull($input['seriNo'] ?? null),
            json_encode($input['aksesuarlar'] ?? [], JSON_UNESCAPED_UNICODE),
            strOrNull($input['aksesyarDiger'] ?? null),
            strOrNull($input['gelisTarihi'] ?? null),
            enumOrDefault($input['garantiDurumu'] ?? null, GARANTI_DEGERLERI, 'Hayır'),
            enumOrDefault($input['durum'] ?? null, DURUM_DEGERLERI, 'Yeni Gelen'),
            strOrNull($input['kargoTarihi'] ?? null),
            strOrNull($input['kargoFirmasi'] ?? null),
            strOrNull($input['teslimAlan'] ?? null),
            strOrNull($input['notlar'] ?? null),
            $user['id'],
        ]);

        $stmt = $pdo->prepare('SELECT * FROM service_records WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['servis' => servisResponse($stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (string)($input['id'] ?? '');
        $kurumAdi = trim((string)($input['kurumAdi'] ?? ''));
        if ($id === '' || $kurumAdi === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id ve kurum adı zorunlu']);
            exit;
        }

        $check = $pdo->prepare('SELECT id FROM service_records WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Kayıt bulunamadı']);
            exit;
        }

        $stmt = $pdo->prepare('UPDATE service_records SET musteri_id=?, kurum_adi=?, ilgili_kisi=?, telefon=?, email=?, urun_adi=?, seri_no=?, aksesuarlar=?, aksesuar_diger=?, gelis_tarihi=?, garanti_durumu=?, durum=?, kargo_tarihi=?, kargo_firmasi=?, teslim_alan=?, notlar=? WHERE id=?');
        $stmt->execute([
            strOrNull($input['musteriId'] ?? null),
            $kurumAdi,
            strOrNull($input['ilgiliKisi'] ?? null),
            strOrNull($input['telefon'] ?? null),
            strOrNull($input['email'] ?? null),
            strOrNull($input['urunAdi'] ?? null),
            strOrNull($input['seriNo'] ?? null),
            json_encode($input['aksesuarlar'] ?? [], JSON_UNESCAPED_UNICODE),
            strOrNull($input['aksesyarDiger'] ?? null),
            strOrNull($input['gelisTarihi'] ?? null),
            enumOrDefault($input['garantiDurumu'] ?? null, GARANTI_DEGERLERI, 'Hayır'),
            enumOrDefault($input['durum'] ?? null, DURUM_DEGERLERI, 'Yeni Gelen'),
            strOrNull($input['kargoTarihi'] ?? null),
            strOrNull($input['kargoFirmasi'] ?? null),
            strOrNull($input['teslimAlan'] ?? null),
            strOrNull($input['notlar'] ?? null),
            $id,
        ]);

        $stmt = $pdo->prepare('SELECT * FROM service_records WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['servis' => servisResponse($stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $pdo->prepare('DELETE FROM service_records WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
