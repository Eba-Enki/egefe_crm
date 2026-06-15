<?php
declare(strict_types=1);

// Veritabanında ASCII enum, ön yüzde Türkçe karakterli rol adları kullanılır.
const ROL_DB_TO_APP = [
    'yonetici'  => 'yönetici',
    'kullanici' => 'kullanıcı',
    'izleyici'  => 'izleyici',
];
const ROL_APP_TO_DB = [
    'yönetici'  => 'yonetici',
    'kullanıcı' => 'kullanici',
    'izleyici'  => 'izleyici',
];

function generateSalt(): string {
    return bin2hex(random_bytes(16));
}

function hashPassword(string $password, string $salt): string {
    return hash_pbkdf2('sha256', $password, $salt, 100000, 64, false);
}

function verifyPassword(string $password, string $hash, string $salt): bool {
    return hash_equals($hash, hashPassword($password, $salt));
}

function userPermissions(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare('SELECT portal, erisim, sayfalar FROM user_permissions WHERE user_id = ?');
    $stmt->execute([$userId]);

    $izinler = [
        'servis' => ['erisim' => false, 'sayfalar' => []],
        'satis'  => ['erisim' => false, 'sayfalar' => []],
        'stok'   => ['erisim' => false, 'sayfalar' => []],
    ];
    foreach ($stmt->fetchAll() as $row) {
        $izinler[$row['portal']] = [
            'erisim'   => (bool)$row['erisim'],
            'sayfalar' => $row['sayfalar'] ? json_decode($row['sayfalar'], true) : [],
        ];
    }
    return $izinler;
}

function userResponse(PDO $pdo, array $user): array {
    return [
        'id'       => $user['id'],
        'ad'       => $user['ad'],
        'username' => $user['username'],
        'email'    => $user['email'],
        'rol'      => ROL_DB_TO_APP[$user['rol']] ?? $user['rol'],
        'sonGiris' => $user['son_giris'],
        'izinler'  => userPermissions($pdo, $user['id']),
    ];
}

function currentUser(PDO $pdo): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user) return null;
    return userResponse($pdo, $user);
}

function requireAuth(PDO $pdo): array {
    $user = currentUser($pdo);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Oturum bulunamadı']);
        exit;
    }
    return $user;
}

function requirePortalAccess(array $user, string $portal): void {
    if ($user['rol'] === 'yönetici') return;
    if (empty($user['izinler'][$portal]['erisim'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Bu modüle erişim yetkiniz yok']);
        exit;
    }
}
