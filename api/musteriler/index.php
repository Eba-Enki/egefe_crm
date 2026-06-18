<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);
requireAnyPortalAccess($user, ['servis', 'satis']);

function normalizePortal($value): ?string {
    $v = strtolower(trim((string)$value));
    return in_array($v, ['servis', 'satis'], true) ? $v : null;
}

function musteriResponse(array $row): array {
    return [
        'id'      => $row['id'],
        'kayitNo' => $row['kayit_no'],
        'portal'  => $row['portal'],
        'kurum'   => $row['kurum'],
        'kisi'    => $row['kisi'],
        'tel'     => $row['tel'],
        'email'   => $row['email'],
        'sehir'   => $row['sehir'],
        'adres'   => $row['adres'],
        'not'     => $row['notlar'],
    ];
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
        $stmt = $pdo->prepare('SELECT * FROM customers WHERE portal = ? ORDER BY created_at DESC');
        $stmt->execute([$portal]);
        echo json_encode(['musteriler' => array_map('musteriResponse', $stmt->fetchAll())]);
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

        $id = 'm' . (string)(int)round(microtime(true) * 1000);

        $maxRow = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(kayit_no, 3) AS UNSIGNED)) AS mx FROM customers WHERE kayit_no LIKE 'MK%' AND portal = ?");
        $maxRow->execute([$portal]);
        $mx = $maxRow->fetch();
        $kayitNo = 'MK' . str_pad((string)((int)($mx['mx'] ?? 0) + 1), 5, '0', STR_PAD_LEFT);

        $stmt = $pdo->prepare('INSERT INTO customers (id, kayit_no, portal, kurum, kisi, tel, email, sehir, adres, notlar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $id, $kayitNo, $portal, $kurum,
            strOrNull($input['kisi'] ?? null),
            strOrNull($input['tel'] ?? null),
            strOrNull($input['email'] ?? null),
            strOrNull($input['sehir'] ?? null),
            strOrNull($input['adres'] ?? null),
            strOrNull($input['not'] ?? null),
        ]);

        $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['musteri' => musteriResponse($stmt->fetch())]);
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

        $check = $pdo->prepare('SELECT id, portal FROM customers WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Müşteri bulunamadı']);
            exit;
        }
        requirePortalAccess($user, $existing['portal']);

        $stmt = $pdo->prepare('UPDATE customers SET kurum=?, kisi=?, tel=?, email=?, sehir=?, adres=?, notlar=? WHERE id=?');
        $stmt->execute([
            $kurum,
            strOrNull($input['kisi'] ?? null),
            strOrNull($input['tel'] ?? null),
            strOrNull($input['email'] ?? null),
            strOrNull($input['sehir'] ?? null),
            strOrNull($input['adres'] ?? null),
            strOrNull($input['not'] ?? null),
            $id,
        ]);

        $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['musteri' => musteriResponse($stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }

        $check = $pdo->prepare('SELECT portal FROM customers WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Müşteri bulunamadı']);
            exit;
        }
        requirePortalAccess($user, $existing['portal']);

        $stmt = $pdo->prepare('DELETE FROM customers WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
