<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);
requireAnyPortalAccess($user, ['servis', 'satis']);

function musteriResponse(array $row): array {
    return [
        'id'      => $row['id'],
        'kayitNo' => $row['kayit_no'],
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
        $stmt = $pdo->query('SELECT * FROM customers ORDER BY created_at DESC');
        echo json_encode(['musteriler' => array_map('musteriResponse', $stmt->fetchAll())]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $kurum = trim((string)($input['kurum'] ?? ''));
        if ($kurum === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Kurum adı zorunlu']);
            exit;
        }

        $id = 'm' . (string)(int)round(microtime(true) * 1000);

        $maxRow = $pdo->query("SELECT MAX(CAST(SUBSTRING(kayit_no, 3) AS UNSIGNED)) AS mx FROM customers WHERE kayit_no LIKE 'MK%'")->fetch();
        $kayitNo = 'MK' . str_pad((string)((int)($maxRow['mx'] ?? 0) + 1), 5, '0', STR_PAD_LEFT);

        $stmt = $pdo->prepare('INSERT INTO customers (id, kayit_no, kurum, kisi, tel, email, sehir, adres, notlar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $id, $kayitNo, $kurum,
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

        $check = $pdo->prepare('SELECT id FROM customers WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Müşteri bulunamadı']);
            exit;
        }

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
        $stmt = $pdo->prepare('DELETE FROM customers WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Müşteri bulunamadı']);
            exit;
        }
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
