<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

const TIP_DEGERLERI = ['ham','ticari'];


function kategoriResponse(array $row): array {
    return [
        'id'           => $row['id'],
        'tip'          => $row['tip'],
        'ad'           => $row['ad'],
        'sheetBoyu'    => $row['sheet_boyu'] !== null ? (int)$row['sheet_boyu'] : null,
        'kesimBoleni'  => $row['kesim_boleni'] !== null ? (int)$row['kesim_boleni'] : null,
        'firePct'      => $row['fire_pct'] !== null ? (float)$row['fire_pct'] : null,
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $tip = (string)($_GET['tip'] ?? '');
        if ($tip !== '' && in_array($tip, TIP_DEGERLERI, true)) {
            $stmt = $pdo->prepare('SELECT * FROM stock_categories WHERE tip = ? ORDER BY ad ASC');
            $stmt->execute([$tip]);
        } else {
            $stmt = $pdo->query('SELECT * FROM stock_categories ORDER BY tip ASC, ad ASC');
        }
        $rows = $stmt->fetchAll();
        echo json_encode(['kategoriler' => array_map('kategoriResponse', $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $tip = (string)($input['tip'] ?? '');
        $ad = trim((string)($input['ad'] ?? ''));
        if (!in_array($tip, TIP_DEGERLERI, true) || $ad === '') {
            http_response_code(400);
            echo json_encode(['error' => 'tip (ham/ticari) ve ad zorunlu']);
            exit;
        }

        $id = ($tip === 'ham' ? 'kat' : 'tkat') . (string)(int)round(microtime(true) * 1000);

        $stmt = $pdo->prepare('INSERT INTO stock_categories (id, tip, ad, sheet_boyu, kesim_boleni, fire_pct) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $id, $tip, $ad,
            $tip === 'ham' ? (int)($input['sheetBoyu'] ?? 0) : null,
            $tip === 'ham' ? (int)($input['kesimBoleni'] ?? 0) : null,
            $tip === 'ham' ? (float)($input['firePct'] ?? 0) : null,
        ]);

        $stmt = $pdo->prepare('SELECT * FROM stock_categories WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['kategori' => kategoriResponse($stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (string)($input['id'] ?? '');
        $ad = trim((string)($input['ad'] ?? ''));
        if ($id === '' || $ad === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id ve ad zorunlu']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM stock_categories WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Kategori bulunamadı']);
            exit;
        }

        $stmt = $pdo->prepare('UPDATE stock_categories SET ad=?, sheet_boyu=?, kesim_boleni=?, fire_pct=? WHERE id=?');
        $stmt->execute([
            $ad,
            $existing['tip'] === 'ham' ? (int)($input['sheetBoyu'] ?? $existing['sheet_boyu']) : null,
            $existing['tip'] === 'ham' ? (int)($input['kesimBoleni'] ?? $existing['kesim_boleni']) : null,
            $existing['tip'] === 'ham' ? (float)($input['firePct'] ?? $existing['fire_pct']) : null,
            $id,
        ]);

        $stmt = $pdo->prepare('SELECT * FROM stock_categories WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['kategori' => kategoriResponse($stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $stmt = $pdo->prepare('DELETE FROM stock_categories WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Kategori bulunamadı']);
            exit;
        }
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
