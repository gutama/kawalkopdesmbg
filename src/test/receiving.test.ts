import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from './helpers/db';
import { seedDatabase } from '@/db/seed';
import type { AppDatabase } from '@/db/client';
import {
  canTransitionDeliveryStatus,
  completeDeliveryVerification,
  compressAndStorePodPhoto,
  evaluateItemInspection,
  listKitchenDeliveries,
  lookupDeliveryByQrToken,
  validateInspectionChecklist,
} from '@/lib/receiving';

describe('SPPG Delivery Receiving, State Transitions & Inspection Validation', () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    seedDatabase(db);
  });

  describe('canTransitionDeliveryStatus', () => {
    it('allows valid forward lifecycle transitions and blocks terminal reversals', () => {
      expect(canTransitionDeliveryStatus('DRAFT', 'DISPATCHED')).toBe(true);
      expect(canTransitionDeliveryStatus('DISPATCHED', 'VERIFIED')).toBe(true);
      expect(canTransitionDeliveryStatus('DISPATCHED', 'REJECTED')).toBe(true);

      expect(canTransitionDeliveryStatus('DRAFT', 'VERIFIED')).toBe(false);
      expect(canTransitionDeliveryStatus('VERIFIED', 'DISPATCHED')).toBe(false);
      expect(canTransitionDeliveryStatus('VERIFIED', 'REJECTED')).toBe(false);
      expect(canTransitionDeliveryStatus('REJECTED', 'VERIFIED')).toBe(false);
    });
  });

  describe('evaluateItemInspection', () => {
    it('identifies exact match, shortage, and surplus quantities accurately', () => {
      const exact = evaluateItemInspection(200, 200);
      expect(exact.status).toBe('MATCH');
      expect(exact.hasDiscrepancy).toBe(false);
      expect(exact.deviation).toBe(0);
      expect(exact.label).toContain('Sesuai');

      const shortage = evaluateItemInspection(200, 185);
      expect(shortage.status).toBe('SHORTAGE');
      expect(shortage.hasDiscrepancy).toBe(true);
      expect(shortage.deviation).toBe(-15);
      expect(shortage.label).toContain('Kurang');

      const surplus = evaluateItemInspection(200, 205);
      expect(surplus.status).toBe('SURPLUS');
      expect(surplus.hasDiscrepancy).toBe(true);
      expect(surplus.deviation).toBe(5);
      expect(surplus.label).toContain('Lebih');
    });
  });

  describe('validateInspectionChecklist', () => {
    it('succeeds when all items are checked and quantities are valid', () => {
      const result = validateInspectionChecklist([
        {
          itemId: 1,
          commodityName: 'Beras Medium',
          unit: 'kg',
          dispatchedQuantity: 200,
          receivedQuantity: 200,
          checked: true,
        },
        {
          itemId: 2,
          commodityName: 'Daging Ayam Ras',
          unit: 'kg',
          dispatchedQuantity: 80,
          receivedQuantity: 78,
          checked: true,
        },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.hasAnyDiscrepancy).toBe(true);
        expect(result.generatedNote).toContain('Daging Ayam Ras: diterima 78 kg dari 80 kg');
      }
    });

    it('fails when any item is unchecked or has negative received quantity', () => {
      const unchecked = validateInspectionChecklist([
        {
          itemId: 1,
          commodityName: 'Beras Medium',
          unit: 'kg',
          dispatchedQuantity: 200,
          receivedQuantity: 200,
          checked: false,
        },
      ]);
      expect(unchecked.success).toBe(false);

      const negative = validateInspectionChecklist([
        {
          itemId: 1,
          commodityName: 'Beras Medium',
          unit: 'kg',
          dispatchedQuantity: 200,
          receivedQuantity: -5,
          checked: true,
        },
      ]);
      expect(negative.success).toBe(false);
    });
  });

  describe('lookupDeliveryByQrToken & listKitchenDeliveries', () => {
    it('loads a DISPATCHED delivery by raw QR token or verification URL', async () => {
      const token = 'mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e';
      const lookup = await lookupDeliveryByQrToken(
        db,
        `https://kawalkopdes.id/sppg?token=${token}`,
      );

      expect(lookup.success).toBe(true);
      if (lookup.success) {
        expect(lookup.delivery.qrToken).toBe(token);
        expect(lookup.delivery.status).toBe('DISPATCHED');
        expect(lookup.delivery.items.length).toBe(2);
      }
    });

    it('returns a friendly error when QR token is empty or unknown', async () => {
      const empty = await lookupDeliveryByQrToken(db, '   ');
      expect(empty.success).toBe(false);

      const unknown = await lookupDeliveryByQrToken(db, 'mbg_tidak_dikenal_123');
      expect(unknown.success).toBe(false);
      if (!unknown.success) {
        expect(unknown.error).toMatch(/tidak ditemukan/i);
      }
    });

    it('lists deliveries for the SPPG kitchen with DISPATCHED items prioritized', async () => {
      const deliveries = await listKitchenDeliveries(db, 1);
      expect(deliveries.length).toBeGreaterThanOrEqual(2);
      expect(deliveries.some((d) => d.status === 'DISPATCHED')).toBe(true);
    });
  });

  describe('compressAndStorePodPhoto & completeDeliveryVerification', () => {
    it('normalizes and stores PoD photo evidence with low-bandwidth metadata', () => {
      const stored = compressAndStorePodPhoto(
        3,
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
      );
      expect(stored.photoPath).toMatch(/^\/uploads\/pod\/pod-delivery-3-/);
      expect(stored.compressedSizeKb).toBeGreaterThan(0);
    });

    it('transitions a DISPATCHED delivery to VERIFIED and writes an immutable PoD receipt', async () => {
      const lookup = await lookupDeliveryByQrToken(
        db,
        'mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e',
      );
      expect(lookup.success).toBe(true);
      if (!lookup.success) return;

      const delivery = lookup.delivery;
      const result = await completeDeliveryVerification(db, {
        role: 'SPPG_STAFF',
        deliveryId: delivery.id,
        receiverName: 'Ibu Siti Aminah (Kepala Dapur SPPG Subang)',
        signOffNote: 'Beras dan ayam segar diterima sesuai standar gizi MBG.',
        photoData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
        inspectionItems: delivery.items.map((item) => ({
          itemId: item.id,
          commodityName: item.commodityName,
          unit: item.unit,
          dispatchedQuantity: item.quantity,
          receivedQuantity: item.quantity,
          checked: true,
        })),
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.delivery.status).toBe('VERIFIED');
        expect(result.delivery.receiverName).toContain('Ibu Siti Aminah');
        expect(result.delivery.photoPath).toMatch(/^\/uploads\/pod\/pod-delivery-/);
        expect(result.delivery.signOffNote).toContain('Beras dan ayam segar');
      }

      // Attempting to verify an already-VERIFIED delivery must be rejected
      const duplicateAttempt = await completeDeliveryVerification(db, {
        role: 'SPPG_STAFF',
        deliveryId: delivery.id,
        receiverName: 'Ibu Siti Aminah',
        photoData: '/uploads/pod/test.jpg',
        inspectionItems: delivery.items.map((item) => ({
          itemId: item.id,
          commodityName: item.commodityName,
          unit: item.unit,
          dispatchedQuantity: item.quantity,
          receivedQuantity: item.quantity,
          checked: true,
        })),
      });
      expect(duplicateAttempt.success).toBe(false);
    });

    it('rejects verification when role is unauthorized or photo/receiverName is missing', async () => {
      const unauthorized = await completeDeliveryVerification(db, {
        role: 'PUBLIC_OBSERVER',
        deliveryId: 3,
        receiverName: 'Ibu Siti Aminah',
        photoData: '/uploads/pod/test.jpg',
        inspectionItems: [],
      });
      expect(unauthorized.success).toBe(false);

      const missingPhoto = await completeDeliveryVerification(db, {
        role: 'SPPG_STAFF',
        deliveryId: 3,
        receiverName: 'Ibu Siti Aminah',
        photoData: '   ',
        inspectionItems: [
          {
            itemId: 7,
            commodityName: 'Beras Medium',
            unit: 'kg',
            dispatchedQuantity: 200,
            receivedQuantity: 200,
            checked: true,
          },
        ],
      });
      expect(missingPhoto.success).toBe(false);
    });
  });
});
