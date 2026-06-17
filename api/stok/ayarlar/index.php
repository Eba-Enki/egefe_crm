<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

const VARSAYILAN_AYARLAR = [
    'globalEsik'        => 1,
    'hamCikisPrefix'    => 'HC',
    'ticariCikisPrefix' => 'TC',
    'cikisNedenleri'    => ['Müşteri Siparişi','Demo / Numune','E-ticaret','İç Kullanım','İade','Diğer'],
];

function ayarlarOku(PDO $pdo): array {
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['stok']);
    $row = $stmt->fetch();
    $data = $row ? (json_decode($row['data'], true) ?? []) : [];
    return array_merge(VARSAYILAN_AYARLAR, $data);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        echo json_encode(['ayarlar' => ayarlarOku($pdo)]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $ayarlar = ayarlarOku($pdo);

        if (array_key_exists('globalEsik', $input)) {
            $ayarlar['globalEsik'] = max(0.0, (float)$input['globalEsik']);
        }
        if (array_key_exists('hamCikisPrefix', $input)) {
            $ayarlar['hamCikisPrefix'] = trim((string)$input['hamCikisPrefix']) ?: 'HC';
        }
        if (array_key_exists('ticariCikisPrefix', $input)) {
            $ayarlar['ticariCikisPrefix'] = trim((string)$input['ticariCikisPrefix']) ?: 'TC';
        }
        if (array_key_exists('cikisNedenleri', $input) && is_array($input['cikisNedenleri'])) {
            $ayarlar['cikisNedenleri'] = array_values(array_filter(
                array_map(fn($v) => trim((string)$v), $input['cikisNedenleri']),
                fn($v) => $v !== ''
            ));
        }

        $json = json_encode($ayarlar, JSON_UNESCAPED_UNICODE);
        $stmt = $pdo->prepare('INSERT INTO settings (portal, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?');
        $stmt->execute(['stok', $json, $json]);

        echo json_encode(['ayarlar' => $ayarlar]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
