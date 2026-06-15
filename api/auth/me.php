<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = currentUser($pdo);
if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Oturum bulunamadı']);
    exit;
}

echo json_encode(['user' => $user]);
