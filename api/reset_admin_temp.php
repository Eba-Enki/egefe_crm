<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

// TEK SEFERLİK ARAÇ: yönetici hesabı oluşturur/sıfırlar. Kullandıktan sonra
// bu dosyayı repodan silin ve yeniden deploy edin.
const RESET_TOKEN = '11343761f27ebd65c11cadd2e8d4ef63190fa320f830e27a';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$token    = (string)($input['token'] ?? '');
$username = trim((string)($input['username'] ?? ''));
$password = (string)($input['password'] ?? '');
$ad       = trim((string)($input['ad'] ?? 'Yönetici'));
$email    = trim((string)($input['email'] ?? ''));

if (!hash_equals(RESET_TOKEN, $token)) {
    http_response_code(403);
    echo json_encode(['error' => 'Geçersiz token']);
    exit;
}

if ($username === '' || strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['error' => 'Kullanıcı adı gerekli, şifre en az 8 karakter olmalı']);
    exit;
}

$allPages = [
    'servis' => ['dashboard','servisler','teklifler','tutanaklar','musteriler','urunler','ayarlar'],
    'satis'  => ['dashboard','teklifler','siparisler','faturalar','musteriler','urunler','ayarlar'],
    'stok'   => ['stok-dashboard','ham-stok','ham-girisler','ham-cikislar','stok-parametreler','bitmis-stok','bitmis-girisler','bitmis-cikislar','stok-ayarlar'],
];

$salt = generateSalt();
$hash = hashPassword($password, $salt);

$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
$existing = $stmt->fetch();

$pdo->beginTransaction();

if ($existing) {
    $id = $existing['id'];
    $pdo->prepare('UPDATE users SET ad = ?, sifre_hash = ?, sifre_salt = ?, email = ?, rol = ? WHERE id = ?')
        ->execute([$ad, $hash, $salt, $email, 'yonetici', $id]);
    $pdo->prepare('DELETE FROM user_permissions WHERE user_id = ?')->execute([$id]);
} else {
    $id = 'gu' . bin2hex(random_bytes(8));
    $pdo->prepare('INSERT INTO users (id, ad, username, sifre_hash, sifre_salt, email, rol) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$id, $ad, $username, $hash, $salt, $email, 'yonetici']);
}

$permStmt = $pdo->prepare('INSERT INTO user_permissions (user_id, portal, erisim, sayfalar) VALUES (?, ?, 1, ?)');
foreach ($allPages as $portal => $pages) {
    $permStmt->execute([$id, $portal, json_encode($pages)]);
}

$pdo->commit();

echo json_encode(['ok' => true, 'id' => $id, 'username' => $username]);
