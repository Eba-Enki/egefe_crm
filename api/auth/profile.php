<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$user = requireAuth($pdo);

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$currentPassword = (string)($input['currentPassword'] ?? '');
$newPassword = (string)($input['newPassword'] ?? '');

if ($currentPassword === '' || $newPassword === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Mevcut şifre ve yeni şifre zorunludur']);
    exit;
}
if (strlen($newPassword) < 4) {
    http_response_code(400);
    echo json_encode(['error' => 'Yeni şifre en az 4 karakter olmalıdır']);
    exit;
}

$stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();
if (!$row || !verifyPassword($currentPassword, $row['sifre_hash'], $row['sifre_salt'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Mevcut şifre yanlış']);
    exit;
}

$salt = generateSalt();
$hash = hashPassword($newPassword, $salt);
$pdo->prepare('UPDATE users SET sifre_hash = ?, sifre_salt = ? WHERE id = ?')
    ->execute([$hash, $salt, $user['id']]);

echo json_encode(['ok' => true]);
