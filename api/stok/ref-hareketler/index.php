<?php
declare(strict_types=1);
require __DIR__ . '/../../_bootstrap.php';
require __DIR__ . '/../../../includes/referans.php';

$user = requireAuth($pdo);
requirePortalAccess($user, 'stok');

// Faz 1: yalnızca ana stok hareketleri. Ara stok / kontrol Faz 2'de eklenecek.
const REF_HAREKET_TIPLERI_ANA = ['Açılış', 'Kullanım', 'Sayım Düzeltme', 'İmha'];

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stokTipi = (string)($_GET['stokTipi'] ?? 'ana');
        $stokId = (string)($_GET['stokId'] ?? '');
        if ($stokId === '' || !in_array($stokTipi, ['ana', 'ara', 'kontrol'], true)) refFail(400, 'stokTipi ve stokId gerekli');
        echo json_encode(['hareketler' => refHareketleriGetir($pdo, $stokTipi, $stokId)]);
        break;

    case 'POST':
        refRequireWrite($user);
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $stokTipi = (string)($input['stokTipi'] ?? 'ana');
        $stokId = (string)($input['stokId'] ?? '');
        $tip = (string)($input['tip'] ?? '');
        if ($stokTipi !== 'ana') refFail(400, 'Bu stok tipi henüz desteklenmiyor');
        if (!in_array($tip, REF_HAREKET_TIPLERI_ANA, true)) refFail(400, 'Geçersiz hareket tipi');
        $tarih = refDateOrNull($input['tarih'] ?? null) ?? refBugun();
        $aciklama = strOrNull($input['aciklama'] ?? null);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT * FROM ref_ana_stoklar WHERE id = ? FOR UPDATE');
            $stmt->execute([$stokId]);
            $stok = $stmt->fetch();
            if (!$stok) { $pdo->rollBack(); refFail(404, 'Stok bulunamadı'); }
            if (in_array($stok['durum'], ['İmha'], true)) { $pdo->rollBack(); refFail(400, 'İmha edilmiş stokta işlem yapılamaz'); }

            $kalan = (float)$stok['kalan_hacim'];
            $durum = $stok['durum'];
            $acilis = $stok['acilis_tarihi'];

            // Kapalı ambalajdan tüketim yapılıyorsa önce açılış kaydı düşülür
            $acilisYaz = function () use (&$durum, &$acilis, $pdo, $stokId, &$kalan, $tarih, $user) {
                if ($durum !== 'Kapalı Ambalaj') return;
                $durum = 'Açık Ambalaj';
                $acilis = $tarih;
                refHareketYaz($pdo, 'ana', $stokId, 'Açılış', 0, $kalan, $tarih, null, $user['id']);
            };

            switch ($tip) {
                case 'Açılış':
                    if ($durum !== 'Kapalı Ambalaj') { $pdo->rollBack(); refFail(400, 'Ambalaj zaten açık'); }
                    $durum = 'Açık Ambalaj';
                    $acilis = $tarih;
                    refHareketYaz($pdo, 'ana', $stokId, 'Açılış', 0, $kalan, $tarih, $aciklama, $user['id']);
                    break;

                case 'Kullanım':
                    $miktar = refNumOrNull($input['miktar'] ?? null);
                    if ($miktar === null || $miktar <= 0) { $pdo->rollBack(); refFail(400, 'Kullanılan hacim sıfırdan büyük olmalı'); }
                    if ($miktar > $kalan + 0.0005) { $pdo->rollBack(); refFail(400, 'Kullanılan hacim kalan hacimden (' . rtrim(rtrim(number_format($kalan, 3, '.', ''), '0'), '.') . ' µL) fazla olamaz'); }
                    $acilisYaz();
                    $kalan = max(0.0, round($kalan - $miktar, 3));
                    refHareketYaz($pdo, 'ana', $stokId, 'Kullanım', -$miktar, $kalan, $tarih, $aciklama, $user['id']);
                    break;

                case 'Sayım Düzeltme':
                    $olculen = refNumOrNull($input['olculenHacim'] ?? null);
                    if ($olculen === null || $olculen < 0) { $pdo->rollBack(); refFail(400, 'Ölçülen hacim geçersiz'); }
                    $fark = round($olculen - $kalan, 3);
                    if (abs($fark) < 0.0005) { $pdo->rollBack(); refFail(400, 'Ölçülen hacim kayıttaki ile aynı'); }
                    $kalan = $olculen;
                    refHareketYaz($pdo, 'ana', $stokId, 'Sayım Düzeltme', $fark, $kalan, $tarih, $aciklama, $user['id']);
                    break;

                case 'İmha':
                    $miktar = $kalan;
                    $kalan = 0.0;
                    refHareketYaz($pdo, 'ana', $stokId, 'İmha', -$miktar, 0, $tarih, $aciklama, $user['id']);
                    $durum = 'İmha';
                    break;
            }

            if ($durum !== 'İmha') {
                if ($kalan <= 0.0) $durum = 'Tükendi';
                elseif ($durum === 'Tükendi') $durum = $acilis ? 'Açık Ambalaj' : 'Kapalı Ambalaj';
            }

            $pdo->prepare('UPDATE ref_ana_stoklar SET kalan_hacim = ?, durum = ?, acilis_tarihi = ? WHERE id = ?')
                ->execute([$kalan, $durum, $acilis, $stokId]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        $stmt = $pdo->prepare('SELECT * FROM ref_ana_stoklar WHERE id = ?');
        $stmt->execute([$stokId]);
        echo json_encode(['stok' => refAnaResponse($stmt->fetch()) + ['hareketler' => refHareketleriGetir($pdo, 'ana', $stokId)]]);
        break;

    default:
        refFail(405, 'Method Not Allowed');
}
