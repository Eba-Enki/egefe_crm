<?php
declare(strict_types=1);
require __DIR__ . '/../../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'satis');

$VARSAYILAN = [
    'firma'        => '',
    'tel'          => '',
    'faks'         => '',
    'adres'        => '',
    'email'        => '',
    'web'          => '',
    'vergiDairesi' => '',
    'vergiNo'      => '',
    'parametreler' => [],
    'servisPrefix' => 'KN',
    'servisDigits' => 6,
    'teklifPrefix' => 'TKL',
    'teklifDigits' => 5,
    'siparisPrefix'=> 'SIP',
    'siparisDigits'=> 5,
];

function ayarlarOku(PDO $pdo, array $varsayilan): array {
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['satis']);
    $row = $stmt->fetch();
    $data = $row ? (json_decode($row['data'], true) ?? []) : [];
    return array_merge($varsayilan, $data);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        echo json_encode(['ayarlar' => ayarlarOku($pdo, $VARSAYILAN)]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $ayarlar = ayarlarOku($pdo, $VARSAYILAN);

        foreach (['firma','tel','faks','adres','email','web','vergiDairesi','vergiNo','servisPrefix','teklifPrefix','siparisPrefix'] as $k) {
            if (array_key_exists($k, $input)) {
                $ayarlar[$k] = trim((string)$input[$k]);
            }
        }
        foreach (['servisDigits','teklifDigits','siparisDigits'] as $k) {
            if (array_key_exists($k, $input)) {
                $ayarlar[$k] = min(9, max(3, (int)$input[$k]));
            }
        }
        if (array_key_exists('parametreler', $input) && is_array($input['parametreler'])) {
            $ayarlar['parametreler'] = array_values(array_filter(
                array_map(fn($v) => trim((string)$v), $input['parametreler']),
                fn($v) => $v !== ''
            ));
        }

        $json = json_encode($ayarlar, JSON_UNESCAPED_UNICODE);
        $stmt = $pdo->prepare('INSERT INTO settings (portal, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?');
        $stmt->execute(['satis', $json, $json]);

        echo json_encode(['ayarlar' => $ayarlar]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
