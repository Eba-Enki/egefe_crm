<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'satis');

function satisParametreResponse(array $row): array {
    return [
        'id'       => (int)$row['id'],
        'ad'       => $row['ad'],
        'kisaltma' => $row['kisaltma'],
        'aktif'    => (bool)$row['aktif'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM satis_parameters ORDER BY ad ASC, kisaltma ASC');
        $rows = $stmt->fetchAll();
        echo json_encode(['parametreler' => array_map('satisParametreResponse', $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $kisaltma = strtoupper(trim((string)($input['kisaltma'] ?? '')));
        if ($kisaltma === '') {
            http_response_code(400);
            echo json_encode(['error' => 'kisaltma zorunlu']);
            exit;
        }
        $ad = trim((string)($input['ad'] ?? ''));

        $stmt = $pdo->prepare('INSERT INTO satis_parameters (ad, kisaltma, aktif) VALUES (?, ?, 1)');
        $stmt->execute([$ad, $kisaltma]);
        $id = (int)$pdo->lastInsertId();

        $stmt = $pdo->prepare('SELECT * FROM satis_parameters WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['parametre' => satisParametreResponse($stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (int)($input['id'] ?? 0);
        $kisaltma = strtoupper(trim((string)($input['kisaltma'] ?? '')));
        if ($id <= 0 || $kisaltma === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id ve kisaltma zorunlu']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM satis_parameters WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Parametre bulunamadı']);
            exit;
        }

        $ad = trim((string)($input['ad'] ?? ''));
        $aktif = array_key_exists('aktif', $input) ? (!empty($input['aktif']) ? 1 : 0) : (int)$existing['aktif'];

        $stmt = $pdo->prepare('UPDATE satis_parameters SET ad=?, kisaltma=?, aktif=? WHERE id=?');
        $stmt->execute([$ad, $kisaltma, $aktif, $id]);

        $stmt = $pdo->prepare('SELECT * FROM satis_parameters WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['parametre' => satisParametreResponse($stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $stmt = $pdo->prepare('DELETE FROM satis_parameters WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Parametre bulunamadı']);
            exit;
        }
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
