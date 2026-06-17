<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);
if ($user['rol'] !== 'yönetici') {
    http_response_code(403);
    echo json_encode(['error' => 'Bu işlem için yönetici yetkisi gerekli']);
    exit;
}

const PORTAL_DEGERLERI = ['servis', 'satis', 'stok'];


function izinlerFromInput(array $input): array {
    $izinler = [];
    $gelen = $input['izinler'] ?? [];
    foreach (PORTAL_DEGERLERI as $p) {
        $portalIzin = $gelen[$p] ?? [];
        $sayfalar = $portalIzin['sayfalar'] ?? [];
        $izinler[$p] = [
            'erisim'   => !empty($portalIzin['erisim']),
            'sayfalar' => is_array($sayfalar) ? array_values(array_map('strval', $sayfalar)) : [],
        ];
    }
    return $izinler;
}

function savePermissions(PDO $pdo, string $userId, array $izinler): void {
    $pdo->prepare('DELETE FROM user_permissions WHERE user_id = ?')->execute([$userId]);
    $stmt = $pdo->prepare('INSERT INTO user_permissions (user_id, portal, erisim, sayfalar) VALUES (?, ?, ?, ?)');
    foreach (PORTAL_DEGERLERI as $p) {
        $stmt->execute([
            $userId, $p,
            !empty($izinler[$p]['erisim']) ? 1 : 0,
            json_encode($izinler[$p]['sayfalar'] ?? [], JSON_UNESCAPED_UNICODE),
        ]);
    }
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM users ORDER BY created_at ASC');
        $rows = $stmt->fetchAll();
        echo json_encode(['kullanicilar' => array_map(fn(array $r) => userResponse($pdo, $r), $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $ad = trim((string)($input['ad'] ?? ''));
        $username = trim((string)($input['username'] ?? ''));
        $password = (string)($input['password'] ?? '');
        $rol = ROL_APP_TO_DB[$input['rol'] ?? ''] ?? 'kullanici';

        if ($ad === '' || $username === '' || $password === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Ad, kullanıcı adı ve şifre zorunludur']);
            exit;
        }
        if (strlen($password) < 4) {
            http_response_code(400);
            echo json_encode(['error' => 'Şifre en az 4 karakter olmalıdır']);
            exit;
        }

        $check = $pdo->prepare('SELECT id FROM users WHERE username = ?');
        $check->execute([$username]);
        if ($check->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Bu kullanıcı adı zaten kullanılıyor']);
            exit;
        }

        $id = 'u' . (string)(int)round(microtime(true) * 1000);
        $salt = generateSalt();
        $hash = hashPassword($password, $salt);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO users (id, ad, username, sifre_hash, sifre_salt, email, rol) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$id, $ad, $username, $hash, $salt, strOrNull($input['email'] ?? null), $rol]);
            savePermissions($pdo, $id, izinlerFromInput($input));
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(201);
        echo json_encode(['kullanici' => userResponse($pdo, $stmt->fetch())]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (string)($input['id'] ?? '');
        $ad = trim((string)($input['ad'] ?? ''));
        $username = trim((string)($input['username'] ?? ''));
        $password = (string)($input['password'] ?? '');

        if ($id === '' || $ad === '' || $username === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id, ad ve kullanıcı adı zorunludur']);
            exit;
        }
        if ($password !== '' && strlen($password) < 4) {
            http_response_code(400);
            echo json_encode(['error' => 'Şifre en az 4 karakter olmalıdır']);
            exit;
        }

        $check = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Kullanıcı bulunamadı']);
            exit;
        }

        $dupe = $pdo->prepare('SELECT id FROM users WHERE username = ? AND id != ?');
        $dupe->execute([$username, $id]);
        if ($dupe->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Bu kullanıcı adı zaten kullanılıyor']);
            exit;
        }

        $rol = ROL_APP_TO_DB[$input['rol'] ?? ''] ?? $existing['rol'];

        $pdo->beginTransaction();
        try {
            if ($password !== '') {
                $salt = generateSalt();
                $hash = hashPassword($password, $salt);
                $stmt = $pdo->prepare('UPDATE users SET ad=?, username=?, email=?, rol=?, sifre_hash=?, sifre_salt=? WHERE id=?');
                $stmt->execute([$ad, $username, strOrNull($input['email'] ?? null), $rol, $hash, $salt, $id]);
            } else {
                $stmt = $pdo->prepare('UPDATE users SET ad=?, username=?, email=?, rol=? WHERE id=?');
                $stmt->execute([$ad, $username, strOrNull($input['email'] ?? null), $rol, $id]);
            }
            savePermissions($pdo, $id, izinlerFromInput($input));
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['kullanici' => userResponse($pdo, $stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        if ($id === $user['id']) {
            http_response_code(400);
            echo json_encode(['error' => 'Kendi hesabınızı silemezsiniz']);
            exit;
        }
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
