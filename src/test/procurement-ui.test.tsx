import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from './helpers/db';
import { seedDatabase } from '@/db/seed';
import type { AppDatabase } from '@/db/client';
import {
  getCooperativeProcurementWorkspace,
  recordFarmerProcurement,
} from '@/lib/procurement-service';
import { FairPriceChecker } from '@/components/fair-price-checker';
import { ProcurementWorkspace } from '@/components/procurement-workspace';
import { SessionProvider } from '@/components/session-provider';

describe('Procurement Service & UI Components', () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    seedDatabase(db);
  });

  describe('Procurement Database Service', () => {
    it('loads cooperative workspace with affiliated farmers, commodities, and procurement items', () => {
      const workspace = getCooperativeProcurementWorkspace(db, 1);

      expect(workspace.cooperative.name).toBe('Koperasi Desa Merah Putih Cibogo');
      expect(workspace.farmers.length).toBeGreaterThanOrEqual(2);
      expect(workspace.farmers.every((f) => f.cooperativeId === 1)).toBe(true);
      expect(workspace.commodities.length).toBe(5);
      expect(workspace.items.length).toBeGreaterThan(0);
      expect(workspace.summary.totalValue).toBeGreaterThan(0);
    });

    it('records a new local farmer commodity procurement item and evaluates fair price', () => {
      const beforeWorkspace = getCooperativeProcurementWorkspace(db, 1);
      const farmer = beforeWorkspace.farmers[0];
      const beras = beforeWorkspace.commodities.find((c) => c.name === 'Beras Medium')!;

      const result = recordFarmerProcurement(db, {
        role: 'KOPERASI_ADMIN',
        cooperativeId: 1,
        farmerId: farmer.id,
        commodityId: beras.id,
        quantity: 120,
        unitPrice: 13500,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.item.quantity).toBe(120);
        expect(result.item.unitPrice).toBe(13500);
        expect(result.item.totalValue).toBe(1620000);
        expect(result.item.evaluation.status).toBe('FAIR');
        expect(result.item.farmerName).toBe(farmer.name);
        expect(result.item.commodityName).toBe('Beras Medium');
      }

      const afterWorkspace = getCooperativeProcurementWorkspace(db, 1);
      expect(afterWorkspace.items.length).toBe(beforeWorkspace.items.length + 1);
    });

    it('rejects recording procurement when user role is not KOPERASI_ADMIN', () => {
      const result = recordFarmerProcurement(db, {
        role: 'PUBLIC_OBSERVER',
        cooperativeId: 1,
        farmerId: 1,
        commodityId: 1,
        quantity: 100,
        unitPrice: 13500,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/koperasi/i);
      }
    });

    it('rejects recording procurement when farmer does not belong to the cooperative', () => {
      const banyumasWorkspace = getCooperativeProcurementWorkspace(db, 2);
      const banyumasFarmer = banyumasWorkspace.farmers[0];

      const result = recordFarmerProcurement(db, {
        role: 'KOPERASI_ADMIN',
        cooperativeId: 1,
        farmerId: banyumasFarmer.id,
        commodityId: 1,
        quantity: 100,
        unitPrice: 13500,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/petani/i);
      }
    });
  });

  describe('FairPriceChecker Component', () => {
    it('renders fair price comparison and total value when price is within benchmark', () => {
      render(
        <FairPriceChecker
          commodityName="Beras Medium"
          unit="kg"
          benchmarkPrice={13500}
          unitPrice={13400}
          quantity={200}
        />,
      );

      expect(screen.getByText(/Harga Wajar/i)).toBeInTheDocument();
      expect(screen.getByText(/Rp 13\.500/)).toBeInTheDocument();
      expect(screen.getByText(/Rp 13\.400/)).toBeInTheDocument();
      expect(screen.getByText(/Rp 2\.680\.000/)).toBeInTheDocument();
    });

    it('warns when purchase price is significantly below regional benchmark', () => {
      render(
        <FairPriceChecker
          commodityName="Telur Ayam Ras"
          unit="kg"
          benchmarkPrice={28000}
          unitPrice={22000}
          quantity={50}
        />,
      );

      expect(screen.getByText(/Di Bawah Acuan/i)).toBeInTheDocument();
      expect(screen.getByText(/Rp 1\.100\.000/)).toBeInTheDocument();
    });

    it('renders above-benchmark warning and handles zero inputs gracefully', () => {
      const { rerender } = render(
        <FairPriceChecker
          commodityName="Sayur Bayam Segar"
          unit="ikat"
          benchmarkPrice={3500}
          unitPrice={4500}
          quantity={100}
        />,
      );

      expect(screen.getByText(/Di Atas Acuan Daerah/i)).toBeInTheDocument();
      expect(screen.getByText(/Rp 450\.000/)).toBeInTheDocument();

      rerender(
        <FairPriceChecker
          commodityName="Sayur Bayam Segar"
          unit="ikat"
          benchmarkPrice={3500}
          unitPrice={0}
          quantity={100}
        />,
      );

      expect(
        screen.getByText(/Masukkan jumlah pasokan dan harga beli koperasi/i),
      ).toBeInTheDocument();
    });
  });

  describe('ProcurementWorkspace Component', () => {
    it('prompts non-KOPERASI_ADMIN users to switch to Pengurus Koperasi role', () => {
      const workspace = getCooperativeProcurementWorkspace(db, 1);

      render(
        <SessionProvider initialRole="PUBLIC_OBSERVER">
          <ProcurementWorkspace initialWorkspace={workspace} />
        </SessionProvider>,
      );

      expect(
        screen.getByText(/Aktifkan Peran Pengurus Koperasi untuk Mencatat Pengadaan/i),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: /Beralih ke Peran Pengurus Koperasi/i }),
      );

      expect(
        screen.getByRole('heading', { name: /Catat Serapan Hasil Petani Lokal/i }),
      ).toBeInTheDocument();
    });

    it('allows KOPERASI_ADMIN to record a new procurement entry and updates the ledger', async () => {
      const workspace = getCooperativeProcurementWorkspace(db, 1);

      render(
        <SessionProvider initialRole="KOPERASI_ADMIN">
          <ProcurementWorkspace
            initialWorkspace={workspace}
            onSubmitProcurement={async (input) => recordFarmerProcurement(db, input)}
          />
        </SessionProvider>,
      );

      const commoditySelect = screen.getByLabelText(/Komoditas Pangan MBG/i);
      const telurCommodity = workspace.commodities.find((c) => c.name === 'Telur Ayam Ras')!;
      fireEvent.change(commoditySelect, { target: { value: String(telurCommodity.id) } });

      // Benchmark price for Telur Ayam Ras (28000) should auto-populate
      const priceInput = screen.getByLabelText(/Harga Beli Koperasi/i) as HTMLInputElement;
      expect(priceInput.value).toBe('28000');

      const quantityInput = screen.getByLabelText(/Jumlah Pasokan/i);
      fireEvent.change(quantityInput, { target: { value: '175' } });
      fireEvent.change(priceInput, { target: { value: '27800' } });

      // Live fair price checker shows calculated line total Rp 4.865.000
      expect(screen.getByText(/Rp 4\.865\.000/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Simpan Catatan Pengadaan/i }));

      await waitFor(() => {
        expect(screen.getByText(/Pengadaan hasil tani berhasil dicatat/i)).toBeInTheDocument();
      });

      expect(screen.getAllByText(/175 kg/i).length).toBeGreaterThanOrEqual(2);
    });
  });
});
