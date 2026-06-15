<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);

function urunResponse(array $row): array {
    return [
        'id'        => $row['id'],
        'portal'    => $row['portal'],
        'urunKodu'  => $row['urun_kodu'],
        'urunAdi'   => $row['urun_adi'],
        'marka'     => $row['marka'],
        'model'     => $row['model'],
        'kategori'  => $row['kategori'],
        'fiyat'     => (float)$row['fiyat'],
        'paraBirimi'=> $row['para_birimi'],
        'aciklama'  => $row['aciklama'],
    ];
}

function strOrNull($value): ?string {
    $value = trim((string)($value ?? ''));
    return $value === '' ? null : $value;
}

function normalizePortal($value): ?string {
    $value = (string)($value ?? '');
    return in_array($value, ['servis', 'satis'], true) ? $value : null;
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

        $stmt = $pdo->prepare('SELECT * FROM products WHERE portal = ? ORDER BY created_at DESC');
        $stmt->execute([$portal]);
        echo json_encode(['urunler' => array_map('urunResponse', $stmt->fetchAll())]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $portal = normalizePortal($input['portal'] ?? '');
        $urunAdi = trim((string)($input['urunAdi'] ?? ''));
        if (!$portal || $urunAdi === '') {
            http_response_code(400);
            echo json_encode(['error' => 'portal (servis/satis) ve ürün adı zorunlu']);
            exit;
        }
        requirePortalAccess($user, $portal);

        $id = 'p' . (string)(int)round(microtime(true) * 1000);

        $stmt = $pdo->prepare('INSERT INTO products (id, portal, urun_kodu, urun_adi, marka, model, kategori, fiyat, para_birimi, aciklama) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $id, $portal,
            strOrNull($input['urunKodu'] ?? null),
            $urunAdi,
            strOrNull($input['marka'] ?? null),
            strOrNull($input['model'] ?? null),
            strOrNull($input['kategori'] ?? null),
            (float)($input['fiyat'] ?? 0),
            in_array($input['paraBirimi'] ?? '', ['TRY','USD','EUR','GBP'], true) ? $input['paraBirimi'] : 'TRY',
            strOrNull($input['aciklama'] ?? null),
        ]);

        $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['urun' => urunResponse($stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (string)($input['id'] ?? '');
        $urunAdi = trim((string)($input['urunAdi'] ?? ''));
        if ($id === '' || $urunAdi === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id ve ürün adı zorunlu']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM products WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Ürün bulunamadı']);
            exit;
        }
        requirePortalAccess($user, $existing['portal']);

        $stmt = $pdo->prepare('UPDATE products SET urun_kodu=?, urun_adi=?, marka=?, model=?, kategori=?, fiyat=?, para_birimi=?, aciklama=? WHERE id=?');
        $stmt->execute([
            strOrNull($input['urunKodu'] ?? null),
            $urunAdi,
            strOrNull($input['marka'] ?? null),
            strOrNull($input['model'] ?? null),
            strOrNull($input['kategori'] ?? null),
            (float)($input['fiyat'] ?? 0),
            in_array($input['paraBirimi'] ?? '', ['TRY','USD','EUR','GBP'], true) ? $input['paraBirimi'] : 'TRY',
            strOrNull($input['aciklama'] ?? null),
            $id,
        ]);

        $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['urun' => urunResponse($stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }

        $check = $pdo->prepare('SELECT portal FROM products WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Ürün bulunamadı']);
            exit;
        }
        requirePortalAccess($user, $existing['portal']);

        $pdo->prepare('DELETE FROM products WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
