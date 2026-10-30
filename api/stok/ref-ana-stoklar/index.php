<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';
require __DIR__ . '/../../../includes/referans.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

const REF_ANA_KOD_PREFIX = 'AS-';

// Girdi → doğrulanmış alanlar (array). Hata varsa mesaj (string) döner.
function refAnaAlanlar(array $in) {
    $standartAdi = strOrNull($in['standartAdi'] ?? null);
    if ($standartAdi === null) return 'Standart adı zorunludur';
    $konsantrasyon = refNumOrNull($in['konsantrasyon'] ?? null);
    if ($konsantrasyon !== null && $konsantrasyon <= 0) return 'Konsantrasyon sıfırdan büyük olmalı';
    $grup = strOrNull($in['grup'] ?? null);
    return [
        'grup'           => $grup === null ? null : mb_strtoupper($grup, 'UTF-8'),
        'standart_adi'   => $standartAdi,
        'katalog_no'     => strOrNull($in['katalogNo'] ?? null),
        'lot_no'         => strOrNull($in['lotNo'] ?? null),
        'uretici'        => strOrNull($in['uretici'] ?? null),
        'konsantrasyon'  => $konsantrasyon,
        'cozucu'         => strOrNull($in['cozucu'] ?? null),
        'acilis_tarihi'  => refDateOrNull($in['acilisTarihi'] ?? null),
        'skt'            => refDateOrNull($in['skt'] ?? null),
        'konum_tipi'     => strOrNull($in['konumTipi'] ?? null),
        'konum_pozisyon' => strOrNull($in['konumPozisyon'] ?? null),
        'dogrulanmadi'   => !empty($in['dogrulanmadi']) ? 1 : 0,
        'notlar'         => strOrNull($in['notlar'] ?? null),
    ];
}

function refAnaEkle(PDO $pdo, array $in, array $user, int $kodNo, string $girisAciklama): string {
    $alan = refAnaAlanlar($in);
    if (is_string($alan)) throw new InvalidArgumentException($alan);
    $ilkHacim = refNumOrNull($in['ilkHacim'] ?? null) ?? 0.0;
    if ($ilkHacim < 0) throw new InvalidArgumentException('Hacim negatif olamaz');

    $durum = ($in['durum'] ?? '') === 'Açık Ambalaj' ? 'Açık Ambalaj' : 'Kapalı Ambalaj';
    if ($ilkHacim == 0.0) $durum = 'Tükendi';
    if ($durum === 'Kapalı Ambalaj') $alan['acilis_tarihi'] = null;

    $id = refId('ra');
    $stmt = $pdo->prepare('INSERT INTO ref_ana_stoklar (id, kod, grup, standart_adi, katalog_no, lot_no, uretici, konsantrasyon, cozucu, ilk_hacim, kalan_hacim, durum, acilis_tarihi, skt, konum_tipi, konum_pozisyon, dogrulanmadi, notlar, olusturan_kullanici) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $id, refKod(REF_ANA_KOD_PREFIX, $kodNo),
        $alan['grup'], $alan['standart_adi'], $alan['katalog_no'], $alan['lot_no'], $alan['uretici'],
        $alan['konsantrasyon'], $alan['cozucu'], $ilkHacim, $ilkHacim, $durum,
        $alan['acilis_tarihi'], $alan['skt'], $alan['konum_tipi'], $alan['konum_pozisyon'],
        $alan['dogrulanmadi'], $alan['notlar'], $user['id'],
    ]);
    refHareketYaz($pdo, 'ana', $id, 'Giriş', $ilkHacim, $ilkHacim, refBugun(), $girisAciklama, $user['id']);
    return $id;
}

function refAnaGetir(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare('SELECT * FROM ref_ana_stoklar WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $id = (string)($_GET['id'] ?? '');
        if ($id !== '') {
            $row = refAnaGetir($pdo, $id);
            if (!$row) refFail(404, 'Kayıt bulunamadı');
            echo json_encode(['stok' => refAnaResponse($row) + ['hareketler' => refHareketleriGetir($pdo, 'ana', $id)]]);
            break;
        }
        $stmt = $pdo->query('SELECT * FROM ref_ana_stoklar ORDER BY grup ASC, standart_adi ASC, konsantrasyon DESC');
        echo json_encode(['stoklar' => array_map('refAnaResponse', $stmt->fetchAll())]);
        break;

    case 'POST':
        refRequireWrite($user);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $toplu = isset($input['kayitlar']) && is_array($input['kayitlar']);
        $kayitlar = $toplu ? $input['kayitlar'] : [$input];
        if (!$kayitlar) refFail(400, 'Aktarılacak kayıt yok');

        $pdo->beginTransaction();
        try {
            $kodNo = refSonrakiKodNo($pdo, 'ref_ana_stoklar', REF_ANA_KOD_PREFIX);
            $ids = [];
            foreach ($kayitlar as $i => $k) {
                try {
                    $ids[] = refAnaEkle($pdo, (array)$k, $user, $kodNo++, $toplu ? 'Excel aktarımı' : 'İlk kayıt');
                } catch (InvalidArgumentException $e) {
                    $pdo->rollBack();
                    refFail(400, ($toplu ? ($i + 1) . '. satır: ' : '') . $e->getMessage());
                }
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        http_response_code(201);
        if ($toplu) {
            echo json_encode(['eklenen' => count($ids)]);
        } else {
            echo json_encode(['stok' => refAnaResponse(refAnaGetir($pdo, $ids[0]))]);
        }
        break;

    case 'PUT':
        refRequireWrite($user);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = (string)($input['id'] ?? '');
        $existing = $id !== '' ? refAnaGetir($pdo, $id) : null;
        if (!$existing) refFail(404, 'Kayıt bulunamadı');
        $alan = refAnaAlanlar($input);
        if (is_string($alan)) refFail(400, $alan);
        if ($existing['durum'] === 'Kapalı Ambalaj') $alan['acilis_tarihi'] = null;

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('UPDATE ref_ana_stoklar SET grup=?, standart_adi=?, katalog_no=?, lot_no=?, uretici=?, konsantrasyon=?, cozucu=?, acilis_tarihi=?, skt=?, konum_tipi=?, konum_pozisyon=?, dogrulanmadi=?, notlar=? WHERE id=?');
            $stmt->execute([
                $alan['grup'], $alan['standart_adi'], $alan['katalog_no'], $alan['lot_no'], $alan['uretici'],
                $alan['konsantrasyon'], $alan['cozucu'], $alan['acilis_tarihi'], $alan['skt'],
                $alan['konum_tipi'], $alan['konum_pozisyon'], $alan['dogrulanmadi'], $alan['notlar'], $id,
            ]);

            // İlk hacim, stok henüz hiç tüketilmemişse düzeltilebilir (yanlış giriş için)
            $yeniIlk = refNumOrNull($input['ilkHacim'] ?? null);
            if ($yeniIlk !== null && $yeniIlk >= 0 && abs($yeniIlk - (float)$existing['ilk_hacim']) > 0.0005) {
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM ref_hareketler WHERE stok_tipi = 'ana' AND stok_id = ? AND tip NOT IN ('Giriş','Açılış')");
                $stmt->execute([$id]);
                if ((int)$stmt->fetchColumn() > 0) {
                    $pdo->rollBack();
                    refFail(400, 'Kullanım görmüş stokta ilk hacim değiştirilemez; sayım düzeltmesi yapın');
                }
                $yeniDurum = $existing['durum'];
                if ($yeniIlk == 0.0) $yeniDurum = 'Tükendi';
                elseif ($yeniDurum === 'Tükendi') $yeniDurum = $existing['acilis_tarihi'] ? 'Açık Ambalaj' : 'Kapalı Ambalaj';
                $pdo->prepare('UPDATE ref_ana_stoklar SET ilk_hacim = ?, kalan_hacim = ?, durum = ? WHERE id = ?')
                    ->execute([$yeniIlk, $yeniIlk, $yeniDurum, $id]);
                $pdo->prepare("UPDATE ref_hareketler SET miktar = ?, kalan_sonra = ? WHERE stok_tipi = 'ana' AND stok_id = ? AND tip = 'Giriş'")
                    ->execute([$yeniIlk, $yeniIlk, $id]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
        echo json_encode(['stok' => refAnaResponse(refAnaGetir($pdo, $id))]);
        break;

    case 'DELETE':
        refRequireWrite($user);
        $id = (string)($_GET['id'] ?? '');
        if ($id === '' || !refAnaGetir($pdo, $id)) refFail(404, 'Kayıt bulunamadı');
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM ref_hareketler WHERE stok_tipi = 'ana' AND stok_id = ? AND tip NOT IN ('Giriş','Açılış')");
        $stmt->execute([$id]);
        if ((int)$stmt->fetchColumn() > 0) {
            refFail(400, 'Hareket görmüş stok silinemez. Kullanılmayacaksa "İmha" işlemi yapın.');
        }
        $pdo->beginTransaction();
        $pdo->prepare("DELETE FROM ref_hareketler WHERE stok_tipi = 'ana' AND stok_id = ?")->execute([$id]);
        $pdo->prepare('DELETE FROM ref_ana_stoklar WHERE id = ?')->execute([$id]);
        $pdo->commit();
        echo json_encode(['ok' => true]);
        break;

    default:
        refFail(405, 'Method Not Allowed');
}
