<?php
declare(strict_types=1);

// Tedarik mal kabulü ortak yardımcıları: giriş LOT'larının bağlı olduğu tedarik
// kalemlerinden "kabul edilen" miktarı ve tedarik durumunu yeniden hesaplar.

// Gelen tedarik kalem id'sini doğrular; geçersizse null döner.
function tdKalemIdCoz(PDO $pdo, $value, string $kaynak): ?int {
    $id = (int)($value ?? 0);
    if ($id <= 0) return null;
    $stmt = $pdo->prepare('SELECT id FROM stock_purchase_order_items WHERE id = ? AND kaynak = ?');
    $stmt->execute([$id, $kaynak]);
    return $stmt->fetchColumn() ? $id : null;
}

// Verilen giriş belgesinin LOT'larının bağlı olduğu tedarik listeleri.
function tdGirisTedarikleri(PDO $pdo, string $lotTablo, string $girisId): array {
    $stmt = $pdo->prepare("SELECT DISTINCT i.order_id FROM $lotTablo l JOIN stock_purchase_order_items i ON i.id = l.tedarik_kalem_id WHERE l.giris_id = ?");
    $stmt->execute([$girisId]);
    return array_column($stmt->fetchAll(), 'order_id');
}

function tdLotTedarikleri(PDO $pdo, string $lotTablo, string $lotId): array {
    $stmt = $pdo->prepare("SELECT DISTINCT i.order_id FROM $lotTablo l JOIN stock_purchase_order_items i ON i.id = l.tedarik_kalem_id WHERE l.id = ?");
    $stmt->execute([$lotId]);
    return array_column($stmt->fetchAll(), 'order_id');
}

// Tükendiği için tek başına silinen bir LOT'un kabul miktarı korunur (giriş
// belgesinin tamamen silinmesi ise mal kabulünü geri almak demektir, korunmaz).
function tdLotSilinmedenOnce(PDO $pdo, string $lotTablo, string $miktarSutun, string $lotId): array {
    $stmt = $pdo->prepare("SELECT tedarik_kalem_id, $miktarSutun AS m FROM $lotTablo WHERE id = ?");
    $stmt->execute([$lotId]);
    $r = $stmt->fetch();
    if (!$r || $r['tedarik_kalem_id'] === null) return [];
    $pdo->prepare('UPDATE stock_purchase_order_items SET kabul_silinen = kabul_silinen + ? WHERE id = ?')
        ->execute([(float)$r['m'], (int)$r['tedarik_kalem_id']]);
    return tdLotTedarikleri($pdo, $lotTablo, $lotId);
}

// Kabul edilen miktarları LOT'lardan yeniden toplar ve durumu günceller:
// tümü geldiyse "Mal Kabul Tamamlandı", bir kısmı geldiyse "Kısmi Mal Kabul",
// hiçbiri gelmediyse "Tedarikçiye İletildi". Elle kapatılmış (Tamamlandı) bir
// liste, kısmi kabulde açılmaz; Taslak ve İptal durumlarına dokunulmaz.
function tdKabulYenidenHesapla(PDO $pdo, array $orderIds): void {
    foreach (array_unique(array_filter($orderIds)) as $orderId) {
        $pdo->prepare(
            'UPDATE stock_purchase_order_items i SET i.kabul_edilen = i.kabul_silinen
             + COALESCE((SELECT SUM(r.sheet_giren) FROM raw_stock_lots r WHERE r.tedarik_kalem_id = i.id), 0)
             + COALESCE((SELECT SUM(f.miktar) FROM finished_stock_lots f WHERE f.tedarik_kalem_id = i.id), 0)
             WHERE i.order_id = ?'
        )->execute([$orderId]);

        $stmt = $pdo->prepare('SELECT durum FROM stock_purchase_orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $durum = $stmt->fetchColumn();
        if ($durum === false || in_array($durum, ['Taslak', 'İptal'], true)) continue;

        $s = $pdo->prepare('SELECT COUNT(*) AS n, SUM(kabul_edilen > 0) AS gelen, SUM(kabul_edilen + 0.0005 >= miktar) AS tam FROM stock_purchase_order_items WHERE order_id = ?');
        $s->execute([$orderId]);
        $r = $s->fetch();
        $n = (int)$r['n']; $gelen = (int)$r['gelen']; $tam = (int)$r['tam'];

        if ($n > 0 && $tam === $n) $yeni = 'Mal Kabul Tamamlandı';
        elseif ($gelen > 0) $yeni = $durum === 'Mal Kabul Tamamlandı' ? $durum : 'Kısmi Mal Kabul';
        else $yeni = 'Tedarikçiye İletildi';

        if ($yeni !== $durum) {
            $pdo->prepare('UPDATE stock_purchase_orders SET durum = ? WHERE id = ?')->execute([$yeni, $orderId]);
        }
    }
}
