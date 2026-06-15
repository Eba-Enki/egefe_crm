<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'servis');

const GARANTI_DEGERLERI = ['Evet','Hayır'];

function strOrNull($value): ?string {
    $value = trim((string)($value ?? ''));
    return $value === '' ? null : $value;
}

function fetchKalemler(PDO $pdo, int $protocolId): array {
    $stmt = $pdo->prepare('SELECT * FROM delivery_protocol_items WHERE protocol_id = ? ORDER BY id ASC');
    $stmt->execute([$protocolId]);
    return array_map(function (array $row): array {
        return [
            'servisId'      => $row['servis_id'],
            'kayitNo'       => $row['kayit_no'],
            'kurumAdi'      => $row['kurum_adi'],
            'seriNo'        => $row['seri_no'],
            'garantiDurumu' => $row['garanti_durumu'],
            'aksesuarlar'   => $row['aksesuarlar'],
            'urunAdi'       => $row['urun_adi'],
            'gelisTarihi'   => $row['gelis_tarihi'],
        ];
    }, $stmt->fetchAll());
}

function tutanakResponse(PDO $pdo, array $row): array {
    return [
        'id'        => $row['id'],
        'no'        => $row['protokol_no'],
        'tarih'     => $row['tarih'],
        'olusturan' => $row['olusturan'],
        'kalemler'  => fetchKalemler($pdo, (int)$row['id']),
    ];
}

function nextTutanakNo(PDO $pdo): string {
    $stmt = $pdo->query("SELECT MAX(CAST(SUBSTRING(protokol_no, 3) AS UNSIGNED)) AS mx FROM delivery_protocols WHERE protokol_no LIKE 'TT%'");
    $mx = (int)($stmt->fetch()['mx'] ?? 0);
    return 'TT' . str_pad((string)($mx + 1), 5, '0', STR_PAD_LEFT);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query('SELECT * FROM delivery_protocols ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();
        echo json_encode(['tutanaklar' => array_map(fn(array $r) => tutanakResponse($pdo, $r), $rows)]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $kalemler = $input['kalemler'] ?? [];
        if (!is_array($kalemler) || count($kalemler) === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'En az bir kalem gerekli']);
            exit;
        }

        $protokolNo = nextTutanakNo($pdo);
        $tarih = strOrNull($input['tarih'] ?? null) ?? date('Y-m-d');

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO delivery_protocols (protokol_no, tarih, olusturan) VALUES (?, ?, ?)');
            $stmt->execute([$protokolNo, $tarih, $user['ad']]);
            $protocolId = (int)$pdo->lastInsertId();

            $itemStmt = $pdo->prepare('INSERT INTO delivery_protocol_items (protocol_id, servis_id, kayit_no, kurum_adi, seri_no, garanti_durumu, aksesuarlar, urun_adi, gelis_tarihi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $servisIds = [];
            foreach ($kalemler as $k) {
                $servisId = strOrNull($k['servisId'] ?? null);
                if ($servisId) $servisIds[] = $servisId;
                $garanti = $k['garantiDurumu'] ?? null;
                $itemStmt->execute([
                    $protocolId,
                    $servisId,
                    strOrNull($k['kayitNo'] ?? null),
                    strOrNull($k['kurumAdi'] ?? null),
                    strOrNull($k['seriNo'] ?? null),
                    in_array($garanti, GARANTI_DEGERLERI, true) ? $garanti : null,
                    strOrNull($k['aksesuarlar'] ?? null),
                    strOrNull($k['urunAdi'] ?? null),
                    strOrNull($k['gelisTarihi'] ?? null),
                ]);
            }

            if ($servisIds) {
                $placeholders = implode(',', array_fill(0, count($servisIds), '?'));
                $upd = $pdo->prepare("UPDATE service_records SET durum = 'S.F. Bekleniyor' WHERE durum = 'Yeni Gelen' AND id IN ($placeholders)");
                $upd->execute($servisIds);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM delivery_protocols WHERE id = ?');
        $stmt->execute([$protocolId]);
        http_response_code(201);
        echo json_encode(['tutanak' => tutanakResponse($pdo, $stmt->fetch())]);
        break;

    case 'DELETE':
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }
        $pdo->prepare('DELETE FROM delivery_protocols WHERE id = ? OR protokol_no = ?')->execute([$id, $id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
