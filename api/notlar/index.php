<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$user = requireAuth($pdo);

const GECERLI_PORTALLAR = ['servis', 'satis', 'stok'];
const GECERLI_TURLER    = ['kisisel', 'takim'];

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'GET':
        $portal = $_GET['portal'] ?? '';
        $tur    = $_GET['tur']    ?? '';

        if (!in_array($portal, GECERLI_PORTALLAR, true) || !in_array($tur, GECERLI_TURLER, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Geçerli portal ve tur gerekli']);
            exit;
        }

        if ($tur === 'kisisel') {
            $stmt = $pdo->prepare(
                'SELECT * FROM notlar WHERE portal = ? AND tur = ? AND yazar_id = ? ORDER BY created_at DESC'
            );
            $stmt->execute([$portal, $tur, $user['id']]);
        } else {
            $stmt = $pdo->prepare(
                'SELECT * FROM notlar WHERE portal = ? AND tur = ? ORDER BY created_at DESC'
            );
            $stmt->execute([$portal, $tur]);
        }

        $notlar = $stmt->fetchAll();

        if ($notlar) {
            $ids = array_column($notlar, 'id');
            $ph  = implode(',', array_fill(0, count($ids), '?'));
            $cs  = $pdo->prepare(
                "SELECT * FROM notlar_cevaplar WHERE not_id IN ($ph) ORDER BY created_at ASC"
            );
            $cs->execute($ids);
            $cevaplar = $cs->fetchAll();

            $cevapMap = [];
            foreach ($cevaplar as $c) {
                $cevapMap[$c['not_id']][] = $c;
            }
            foreach ($notlar as &$not) {
                $not['cevaplar'] = $cevapMap[$not['id']] ?? [];
            }
            unset($not);
        }

        echo json_encode(['notlar' => $notlar]);
        break;

    case 'POST':
        $input  = json_decode(file_get_contents('php://input'), true) ?? [];
        $portal = strOrNull($input['portal'] ?? null);
        $tur    = strOrNull($input['tur']    ?? null);
        $metin  = strOrNull($input['metin']  ?? null);

        if (!in_array($portal, GECERLI_PORTALLAR, true)
            || !in_array($tur, GECERLI_TURLER, true)
            || $metin === null
        ) {
            http_response_code(400);
            echo json_encode(['error' => 'portal, tur ve metin gerekli']);
            exit;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO notlar (portal, tur, yazar_id, yazar_ad, metin) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$portal, $tur, $user['id'], $user['ad'], $metin]);
        $id = (int)$pdo->lastInsertId();

        $stmt2 = $pdo->prepare('SELECT * FROM notlar WHERE id = ?');
        $stmt2->execute([$id]);
        $not = $stmt2->fetch();
        $not['cevaplar'] = [];

        http_response_code(201);
        echo json_encode(['not' => $not]);
        break;

    case 'DELETE':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id gerekli']);
            exit;
        }

        $stmt = $pdo->prepare('SELECT * FROM notlar WHERE id = ?');
        $stmt->execute([$id]);
        $not = $stmt->fetch();

        if (!$not) {
            http_response_code(404);
            echo json_encode(['error' => 'Not bulunamadı']);
            exit;
        }

        if ($not['yazar_id'] !== (string)$user['id']) {
            http_response_code(403);
            echo json_encode(['error' => 'Bu notu silme yetkiniz yok']);
            exit;
        }

        // Cevaplar ON DELETE CASCADE ile otomatik silinir
        $pdo->prepare('DELETE FROM notlar WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
}
