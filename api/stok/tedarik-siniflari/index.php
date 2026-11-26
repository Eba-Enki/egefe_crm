<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

// Elle verilen A/B/C sınıfları. Kayıt yoksa sınıf çıkış geçmişinden otomatik
// hesaplanır (istemci tarafında); sinif=null gönderilirse otomatiğe dönülür.

function sinifResponse(array $r): array {
    return ['kaynak' => $r['kaynak'], 'kategoriId' => $r['kategori_id'], 'anahtar' => $r['anahtar'], 'sinif' => $r['sinif']];
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $rows = $pdo->query('SELECT * FROM stock_item_classes')->fetchAll();
        echo json_encode(['siniflar' => array_map('sinifResponse', $rows)]);
        break;

    case 'PUT':
        if ($user['rol'] === 'izleyici') {
            http_response_code(403);
            echo json_encode(['error' => 'Bu işlem için yetkiniz yok']);
            exit;
        }
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $kaynak = (string)($input['kaynak'] ?? '');
        $kategoriId = strOrNull($input['kategoriId'] ?? null);
        $anahtar = strOrNull($input['anahtar'] ?? null);
        if (!in_array($kaynak, ['ham', 'bitmis'], true) || $kategoriId === null || $anahtar === null) {
            http_response_code(400);
            echo json_encode(['error' => 'kaynak, kategoriId ve anahtar zorunludur']);
            exit;
        }
        $anahtar = mb_substr($anahtar, 0, 255);
        $sinif = strtoupper((string)($input['sinif'] ?? ''));
        if (in_array($sinif, ['A', 'B', 'C'], true)) {
            $pdo->prepare('INSERT INTO stock_item_classes (kaynak, kategori_id, anahtar, sinif) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE sinif = VALUES(sinif)')
                ->execute([$kaynak, $kategoriId, $anahtar, $sinif]);
        } else {
            $pdo->prepare('DELETE FROM stock_item_classes WHERE kaynak = ? AND kategori_id = ? AND anahtar = ?')
                ->execute([$kaynak, $kategoriId, $anahtar]);
        }
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
