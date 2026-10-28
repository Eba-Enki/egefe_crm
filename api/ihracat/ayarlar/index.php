<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'ihracat');

// Yurtdışı Satış Portalı ayarları — firma bilgileri İngilizce PDF'te kullanılır
$VARSAYILAN = [
    'firma'           => '',
    'tel'             => '',
    'faks'            => '',
    'adres'           => '',
    'email'           => '',
    'web'             => '',
    'vergiDairesi'    => '',
    'vergiNo'         => '',
    'teklifPrefix'    => 'EXP',
    'teklifDigits'    => 5,
    'ymPrefix'        => 'YM',
    'ymBaslangic'     => 1,
    'bankaHesaplari'  => [],
];

const BANKA_PARA_BIRIMLERI = ['TRY', 'USD', 'EUR', 'GBP'];

function ayarlarOku(PDO $pdo, array $varsayilan): array {
    $stmt = $pdo->prepare('SELECT data FROM settings WHERE portal = ?');
    $stmt->execute(['ihracat']);
    $row = $stmt->fetch();
    $data = $row ? (json_decode($row['data'], true) ?? []) : [];
    return array_merge($varsayilan, $data);
}

// IBAN'ı boş olan satırlar elenir; IBAN boşluksuz büyük harfle saklanır
function bankaHesaplariFromInput(array $liste): array {
    $out = [];
    foreach ($liste as $i => $b) {
        if (!is_array($b)) continue;
        $iban = strtoupper(preg_replace('/\s+/', '', (string)($b['iban'] ?? '')));
        if ($iban === '') continue;
        $pb = in_array($b['paraBirimi'] ?? '', BANKA_PARA_BIRIMLERI, true) ? $b['paraBirimi'] : 'USD';
        $out[] = [
            'id'          => trim((string)($b['id'] ?? '')) ?: ('b' . (string)(int)round(microtime(true) * 1000) . $i),
            'paraBirimi'  => $pb,
            'bankaAdi'    => trim((string)($b['bankaAdi'] ?? '')),
            'sube'        => trim((string)($b['sube'] ?? '')),
            'hesapSahibi' => trim((string)($b['hesapSahibi'] ?? '')),
            'iban'        => $iban,
            'swift'       => strtoupper(trim((string)($b['swift'] ?? ''))),
        ];
    }
    return $out;
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        echo json_encode(['ayarlar' => ayarlarOku($pdo, $VARSAYILAN)]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $ayarlar = ayarlarOku($pdo, $VARSAYILAN);

        foreach (['firma','tel','faks','adres','email','web','vergiDairesi','vergiNo','teklifPrefix','ymPrefix'] as $k) {
            if (array_key_exists($k, $input)) {
                $ayarlar[$k] = trim((string)$input[$k]);
            }
        }
        if (array_key_exists('teklifDigits', $input)) {
            $ayarlar['teklifDigits'] = min(9, max(3, (int)$input['teklifDigits']));
        }
        if (array_key_exists('ymBaslangic', $input)) {
            $ayarlar['ymBaslangic'] = max(1, (int)$input['ymBaslangic']);
        }
        if (array_key_exists('bankaHesaplari', $input) && is_array($input['bankaHesaplari'])) {
            $ayarlar['bankaHesaplari'] = bankaHesaplariFromInput($input['bankaHesaplari']);
        }

        $json = json_encode($ayarlar, JSON_UNESCAPED_UNICODE);
        $stmt = $pdo->prepare('INSERT INTO settings (portal, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?');
        $stmt->execute(['ihracat', $json, $json]);

        echo json_encode(['ayarlar' => $ayarlar]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
