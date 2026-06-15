<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

function parametreResponse(array $row): array {
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
        $stmt = $pdo->query('SELECT * FROM stock_parameters ORDER BY id ASC');
        $rows = $stmt->fetchAll();
        echo json_encode(['parametreler' => array_map('parametreResponse', $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $ad = trim((string)($input['ad'] ?? ''));
        if ($ad === '') {
            http_response_code(400);
            echo json_encode(['error' => 'ad zorunlu']);
            exit;
        }

        $stmt = $pdo->prepare('INSERT INTO stock_parameters (ad, kisaltma, aktif) VALUES (?, ?, ?)');
        $stmt->execute([
            $ad,
            trim((string)($input['kisaltma'] ?? '')) ?: null,
            !empty($input['aktif']) ? 1 : 0,
        ]);
        $id = (int)$pdo->lastInsertId();

        $stmt = $pdo->prepare('SELECT * FROM stock_parameters WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['parametre' => parametreResponse($stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (int)($input['id'] ?? 0);
        $ad = trim((string)($input['ad'] ?? ''));
        if ($id <= 0 || $ad === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id ve ad zorunlu']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM stock_parameters WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Parametre bulunamadı']);
            exit;
        }

        $stmt = $pdo->prepare('UPDATE stock_parameters SET ad=?, kisaltma=?, aktif=? WHERE id=?');
        $stmt->execute([
            $ad,
            trim((string)($input['kisaltma'] ?? '')) ?: null,
            array_key_exists('aktif', $input) ? (!empty($input['aktif']) ? 1 : 0) : $existing['aktif'],
            $id,
        ]);

        $stmt = $pdo->prepare('SELECT * FROM stock_parameters WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['parametre' => parametreResponse($stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $pdo->prepare('DELETE FROM stock_parameters WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
