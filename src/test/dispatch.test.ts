import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from './helpers/db';
import { seedDatabase } from '@/db/seed';
import type { AppDatabase } from '@/db/client';
import {
  createDeliveryDispatch,
  extractQrToken,
  generateDispatchQrToken,
  generateQrCodeDataUrl,
  getCooperativeDispatches,
  validateDispatchInput,
} from '@/lib/dispatch';

describe('Delivery Dispatch Validation, QR Token Generation & Service', () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    seedDatabase(db);
  });

  describe('generateDispatchQrToken & extractQrToken', () => {
    it('generates unique, tamper-resistant tokens with cooperative and date metadata', () => {
      const tokenA = generateDispatchQrToken(1, '2026-11-06');
      const tokenB = generateDispatchQrToken(1, '2026-11-06');

      expect(tokenA).toMatch(/^mbg_coop1_20261106_[a-f0-9]{24}$/);
      expect(tokenB).toMatch(/^mbg_coop1_20261106_[a-f0-9]{24}$/);
      expect(tokenA).not.toBe(tokenB);
    });

    it('extracts QR token from raw token string or verification URL', () => {
      const token = 'mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e';
      expect(extractQrToken(token)).toBe(token);
      expect(
        extractQrToken(`https://kawalkopdes.id/sppg?token=${token}`),
      ).toBe(token);
      expect(extractQrToken('   ')).toBeNull();
    });
  });

  describe('generateQrCodeDataUrl', () => {
    it('generates a valid PNG data URL for a delivery QR token', async () => {
      const dataUrl = await generateQrCodeDataUrl(
        'mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e',
      );
      expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(dataUrl.length).toBeGreaterThan(100);
    });
  });

  describe('validateDispatchInput', () => {
    it('validates a complete dispatch order input with line items', () => {
      const result = validateDispatchInput({
        cooperativeId: 1,
        kitchenId: 1,
        scheduledDate: '2026-11-06',
        items: [
          { commodityId: 1, farmerId: 1, quantity: 200, unitPrice: 13500 },
          { commodityId: 2, farmerId: 2, quantity: 80, unitPrice: 28000 },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
        expect(result.data.scheduledDate).toBe('2026-11-06');
      }
    });

    it('rejects missing kitchen, invalid date format, or empty items', () => {
      expect(
        validateDispatchInput({
          cooperativeId: 1,
          kitchenId: 0,
          scheduledDate: '2026-11-06',
          items: [{ commodityId: 1, farmerId: 1, quantity: 100, unitPrice: 13500 }],
        }).success,
      ).toBe(false);

      expect(
        validateDispatchInput({
          cooperativeId: 1,
          kitchenId: 1,
          scheduledDate: '06-11-2026',
          items: [{ commodityId: 1, farmerId: 1, quantity: 100, unitPrice: 13500 }],
        }).success,
      ).toBe(false);

      expect(
        validateDispatchInput({
          cooperativeId: 1,
          kitchenId: 1,
          scheduledDate: '2026-11-06',
          items: [],
        }).success,
      ).toBe(false);
    });
  });

  describe('createDeliveryDispatch & getCooperativeDispatches', () => {
    it('creates a DISPATCHED delivery order with items and generates a QR code pass', async () => {
      const beforeDispatches = await getCooperativeDispatches(db, 1);

      const response = await createDeliveryDispatch(db, {
        role: 'KOPERASI_ADMIN',
        cooperativeId: 1,
        kitchenId: 1,
        scheduledDate: '2026-11-07',
        items: [
          { commodityId: 1, farmerId: 1, quantity: 220, unitPrice: 13500 },
          { commodityId: 4, farmerId: 2, quantity: 150, unitPrice: 3500 },
        ],
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.dispatch.status).toBe('DISPATCHED');
        expect(response.dispatch.kitchenName).toBe('SPPG Dapur Gizi Subang Kota');
        expect(response.dispatch.qrToken).toMatch(/^mbg_coop1_20261107_/);
        expect(response.dispatch.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
        expect(response.dispatch.items).toHaveLength(2);
        expect(response.dispatch.totalValue).toBe(220 * 13500 + 150 * 3500);
      }

      const afterDispatches = await getCooperativeDispatches(db, 1);
      expect(afterDispatches.length).toBe(beforeDispatches.length + 1);
    });

    it('blocks non-KOPERASI_ADMIN roles from creating a delivery dispatch', async () => {
      const response = await createDeliveryDispatch(db, {
        role: 'SPPG_STAFF',
        cooperativeId: 1,
        kitchenId: 1,
        scheduledDate: '2026-11-07',
        items: [{ commodityId: 1, farmerId: 1, quantity: 100, unitPrice: 13500 }],
      });

      expect(response.success).toBe(false);
    });
  });
});
