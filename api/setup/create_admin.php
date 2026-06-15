<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

// Tek seferlik kurulum: veritabanında hiç kullanıcı yoksa ilk admin'i oluşturur.
// Çalıştırdıktan sonra bu dosyayı silin.

$stmt = $pdo->query('SELECT COUNT(*) AS c FROM users');
if ((int)$stmt->fetch()['c'] > 0) {
    http_response_code(409);
    echo json_encode(['error' => 'Kullanıcılar zaten mevcut, kurulum tekrar çalıştırılamaz']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$ad       = trim((string)($input['ad'] ?? 'Admin'));
$username = trim((string)($input['username'] ?? ''));
$password = (string)($input['password'] ?? '');
$email    = trim((string)($input['email'] ?? ''));

if ($username === '' || strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['error' => 'Kullanıcı adı gerekli, şifre en az 8 karakter olmalı']);
    exit;
}

$salt = generateSalt();
$hash = hashPassword($password, $salt);
$id   = 'gu' . bin2hex(random_bytes(8));

$pdo->beginTransaction();

$pdo->prepare('INSERT INTO users (id, ad, username, sifre_hash, sifre_salt, email, rol) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ->execute([$id, $ad, $username, $hash, $salt, $email, 'yonetici']);

$allPages = [
    'servis' => ['dashboard','servisler','teklifler','tutanaklar','musteriler','urunler','ayarlar'],
    'satis'  => ['dashboard','teklifler','siparisler','faturalar','musteriler','urunler','ayarlar'],
    'stok'   => ['stok-dashboard','ham-stok','ham-girisler','ham-cikislar','stok-parametreler','bitmis-stok','bitmis-girisler','bitmis-cikislar','stok-ayarlar'],
];

$permStmt = $pdo->prepare('INSERT INTO user_permissions (user_id, portal, erisim, sayfalar) VALUES (?, ?, 1, ?)');
foreach ($allPages as $portal => $pages) {
    $permStmt->execute([$id, $portal, json_encode($pages)]);
}

$pdo->commit();

echo json_encode(['ok' => true, 'id' => $id]);
