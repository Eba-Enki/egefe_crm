<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

function lotResponse(array $row): array {
    return [
        'id'           => $row['id'],
        'girisId'      => $row['giris_id'],
        'evrakNo'      => $row['evrak_no'],
        'lotNo'        => $row['lot_no'],
        'tarih'        => $row['tarih'],
        'urunAdi'      => $row['urun_adi'],
        'kategoriId'   => $row['kategori_id'],
        'parametreler' => $row['parametreler'] ? json_decode($row['parametreler'], true) : [],
        'miktar'       => (float)$row['miktar'],
        'mevcutMiktar' => (float)$row['mevcut_miktar'],
        'sktTarih'     => $row['skt_tarih'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$where = [];
$params = [];

$kategoriId = (string)($_GET['kategoriId'] ?? '');
if ($kategoriId !== '') {
    $where[] = 'kategori_id = ?';
    $params[] = $kategoriId;
}

if (!empty($_GET['onlyAvailable'])) {
    $where[] = 'mevcut_miktar > 0';
}

$sql = 'SELECT * FROM finished_stock_lots';
if ($where) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
$sql .= ' ORDER BY created_at ASC, id ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
echo json_encode(['lotlar' => array_map('lotResponse', $stmt->fetchAll())]);
