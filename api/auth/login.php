<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$username = trim((string)($input['username'] ?? ''));
$password = (string)($input['password'] ?? '');

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Kullanıcı adı ve şifre gerekli']);
    exit;
}

$stmt = $pdo->prepare('SELECT * FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !verifyPassword($password, $user['sifre_hash'], $user['sifre_salt'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Kullanıcı adı veya şifre hatalı']);
    exit;
}

session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];

$pdo->prepare('UPDATE users SET son_giris = NOW() WHERE id = ?')->execute([$user['id']]);

echo json_encode(['user' => userResponse($pdo, $user)]);
