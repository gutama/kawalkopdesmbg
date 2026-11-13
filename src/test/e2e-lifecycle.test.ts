// @vitest-environment node
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { proofOfDelivery } from '@/db/schema';
import { seedDatabase } from '@/db/seed';
import { createDeliveryDispatch } from '@/lib/dispatch';
import { recordFarmerProcurement } from '@/lib/procurement-service';
import {
  completeDeliveryVerification,
  lookupDeliveryByQrToken,
} from '@/lib/receiving';
import { getPublicTransparencySnapshot } from '@/lib/transparency';
import { createTestDatabase } from './helpers/db';

describe('End-to-End Kopdes-MBG Lifecycle: Procurement -> QR Dispatch -> SPPG PoD -> Public Dashboard', () => {
  it('completes the full multi-role workflow and reflects verified deliveries on the public dashboard', async () => {
    const db = createTestDatabase();
    seedDatabase(db);

    const baselinePublic = getPublicTransparencySnapshot(db);
    expect(baselinePublic.kpis.totalDeliveriesCount).toBe(3);
    expect(baselinePublic.kpis.verifiedDeliveriesCount).toBe(2);
    expect(baselinePublic.kpis.totalFundsChanneledIdr).toBe(22793000);

    // 1. Koperasi Admin records a local farmer commodity procurement
    const procurementResult = recordFarmerProcurement(db, {
      role: 'KOPERASI_ADMIN',
      cooperativeId: 1,
      farmerId: 1,
      commodityId: 1, // Beras Medium (benchmark Rp 13.500/kg)
      quantity: 100,
      unitPrice: 13500,
    });
    expect(procurementResult.success).toBe(true);

    // 2. Koperasi Admin creates a new Delivery Dispatch Order with a QR Delivery Pass
    const dispatchResult = await createDeliveryDispatch(db, {
      role: 'KOPERASI_ADMIN',
      cooperativeId: 1,
      kitchenId: 1,
      scheduledDate: '2026-10-18',
      items: [
        {
          commodityId: 1, // Beras Medium
          farmerId: 1,
          quantity: 150,
          unitPrice: 13500, // 2,025,000
        },
        {
          commodityId: 2, // Telur Ayam Ras
          farmerId: 2,
          quantity: 50,
          unitPrice: 28000, // 1,400,000
        },
      ],
    });
    expect(dispatchResult.success).toBe(true);
    if (!dispatchResult.success) return;

    const createdPass = dispatchResult.dispatch;
    expect(createdPass.status).toBe('DISPATCHED');
    expect(createdPass.totalValue).toBe(3425000);
    expect(createdPass.qrCodeDataUrl).toContain('data:image/png;base64,');

    // 3. Public Transparency Dashboard immediately shows the new DISPATCHED delivery in transit
    const afterDispatchPublic = getPublicTransparencySnapshot(db);
    expect(afterDispatchPublic.kpis.totalDeliveriesCount).toBe(4);
    expect(afterDispatchPublic.kpis.inTransitFundsIdr).toBe(5580000 + 3425000);
    expect(afterDispatchPublic.kpis.totalFundsChanneledIdr).toBe(22793000 + 3425000);

    // 4. SPPG Kitchen Staff scans the QR token to load the incoming delivery
    const lookupResult = await lookupDeliveryByQrToken(db, createdPass.qrToken);
    expect(lookupResult.success).toBe(true);
    if (!lookupResult.success) return;
    expect(lookupResult.delivery.id).toBe(createdPass.id);

    // 5. SPPG Kitchen Staff inspects items, attaches compressed PoD photo, and signs off
    const verifyResult = await completeDeliveryVerification(db, {
      role: 'SPPG_STAFF',
      deliveryId: createdPass.id,
      receiverName: 'Ibu Siti Aminah (Kepala Dapur SPPG Subang)',
      signOffNote: 'Seluruh beras dan telur diterima segar, timbangan pas.',
      photoData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBx==',
      inspectionItems: createdPass.items.map((item) => ({
        itemId: item.id,
        commodityName: item.commodityName,
        unit: item.unit,
        dispatchedQuantity: item.quantity,
        receivedQuantity: item.quantity,
        checked: true,
      })),
    });
    expect(verifyResult.success).toBe(true);
    if (!verifyResult.success) return;
    expect(verifyResult.delivery.status).toBe('VERIFIED');
    expect(verifyResult.delivery.photoPath).toContain('/uploads/pod/');

    // 6. Verify immutability trigger on proof_of_delivery prevents tampering
    expect(() =>
      db
        .update(proofOfDelivery)
        .set({ receiverName: 'Tampered Receiver' })
        .where(eq(proofOfDelivery.deliveryId, createdPass.id))
        .run(),
    ).toThrow(/immutable/i);

    // 7. Public Transparency Dashboard reflects the newly VERIFIED delivery and PoD receipt
    const finalPublic = getPublicTransparencySnapshot(db);
    expect(finalPublic.kpis.totalDeliveriesCount).toBe(4);
    expect(finalPublic.kpis.verifiedDeliveriesCount).toBe(3);
    expect(finalPublic.kpis.verifiedFundsChanneledIdr).toBe(17213000 + 3425000);
    expect(finalPublic.kpis.inTransitFundsIdr).toBe(5580000);

    const verifiedPublicRecord = finalPublic.deliveries.find(
      (d) => d.id === createdPass.id,
    );
    expect(verifiedPublicRecord).toBeDefined();
    expect(verifiedPublicRecord?.status).toBe('VERIFIED');
    expect(verifiedPublicRecord?.proofOfDelivery?.receiverName).toContain(
      'Ibu Siti Aminah',
    );

    db.$client.close();
  });
});
