<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $notId = (int)($input['not_id'] ?? 0);
        $metin = strOrNull($input['metin'] ?? null);

        if (!$notId || $metin === null) {
            http_response_code(400);
            echo json_encode(['error' => 'not_id ve metin gerekli']);
            exit;
        }

        $stmt = $pdo->prepare('SELECT id FROM notlar WHERE id = ?');
        $stmt->execute([$notId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Not bulunamadı']);
            exit;
        }

        $stmt2 = $pdo->prepare(
            'INSERT INTO notlar_cevaplar (not_id, yazar_id, yazar_ad, metin) VALUES (?, ?, ?, ?)'
        );
        $stmt2->execute([$notId, $user['id'], $user['ad'], $metin]);
        $id = (int)$pdo->lastInsertId();

        $stmt3 = $pdo->prepare('SELECT * FROM notlar_cevaplar WHERE id = ?');
        $stmt3->execute([$id]);
        $cevap = $stmt3->fetch();

        http_response_code(201);
        echo json_encode(['cevap' => $cevap]);
        break;

    case 'DELETE':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }

        $stmt = $pdo->prepare('SELECT * FROM notlar_cevaplar WHERE id = ?');
        $stmt->execute([$id]);
        $cevap = $stmt->fetch();

        if (!$cevap) {
            http_response_code(404);
            echo json_encode(['error' => 'Cevap bulunamadı']);
            exit;
        }

        if ($cevap['yazar_id'] !== (string)$user['id']) {
            http_response_code(403);
            echo json_encode(['error' => 'Bu cevabı silme yetkiniz yok']);
            exit;
        }

        $pdo->prepare('DELETE FROM notlar_cevaplar WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
