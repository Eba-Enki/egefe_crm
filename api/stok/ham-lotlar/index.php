<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

function lotResponse(array $row): array {
    return [
        'id'          => $row['id'],
        'girisId'     => $row['giris_id'],
        'evrakNo'     => $row['evrak_no'],
        'lotNo'       => $row['lot_no'],
        'tarih'       => $row['tarih'],
        'parametreAd' => $row['parametre_ad'],
        'cutoff'      => $row['cutoff'],
        'ekOzellik'   => $row['ek_ozellik'],
        'kategoriId'  => $row['kategori_id'],
        'sheetGiren'  => (float)$row['sheet_giren'],
        'stripGiren'  => (int)$row['strip_giren'],
        'mevcutStrip' => (int)$row['mevcut_strip'],
        'sktTarih'    => $row['skt_tarih'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $where = [];
        $params = [];

        $kategoriId = (string)($_GET['kategoriId'] ?? '');
        if ($kategoriId !== '') {
            $where[] = 'kategori_id = ?';
            $params[] = $kategoriId;
        }

        $parametreAd = (string)($_GET['parametreAd'] ?? '');
        if ($parametreAd !== '') {
            $where[] = 'parametre_ad = ?';
            $params[] = $parametreAd;
        }

        if (!empty($_GET['onlyAvailable'])) {
            $where[] = 'mevcut_strip > 0';
        }

        $sql = 'SELECT * FROM raw_stock_lots';
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY created_at ASC, id ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['lotlar' => array_map('lotResponse', $stmt->fetchAll())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $stmt = $pdo->prepare('SELECT * FROM raw_stock_lots WHERE id = ?');
        $stmt->execute([$id]);
        $lot = $stmt->fetch();
        if (!$lot) {
            http_response_code(404);
            echo json_encode(['error' => 'LOT bulunamadı']);
            exit;
        }
        if ((int)$lot['mevcut_strip'] !== 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Bu LOT tükenmediği için silinemez.']);
            exit;
        }
        $pdo->prepare('DELETE FROM raw_stock_lots WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
