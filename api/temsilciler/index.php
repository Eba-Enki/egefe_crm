<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

// Teklif formundaki "Satış Temsilcisi" listesi — yalnızca ad/e-posta/telefon döner (rol/izin bilgisi yok).
$user = requireAuth($pdo);

require __DIR__ . '/../../includes/teklif.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$portal = (string)($_GET['portal'] ?? '');
if (!in_array($portal, ['servis', 'satis', 'ihracat'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'portal parametresi (servis, satis veya ihracat) zorunlu']);
    exit;
}
requirePortalAccess($user, $portal);

echo json_encode(['temsilciler' => array_map(fn(array $r) => [
    'id'      => $r['id'],
    'ad'      => $r['ad'],
    'email'   => $r['email'],
    'telefon' => $r['telefon'],
], temsilciAdaylari($pdo, $portal))]);
