import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase } from './helpers/db';
import { seedDatabase } from '@/db/seed';
import type { AppDatabase } from '@/db/client';
import {
  createDeliveryDispatch,
  getCooperativeDispatches,
} from '@/lib/dispatch';
import { getCooperativeProcurementWorkspace } from '@/lib/procurement-service';
import { DeliveryPassCard } from '@/components/delivery-pass-card';
import { DispatchOrderBuilder } from '@/components/dispatch-order-builder';
import { SessionProvider } from '@/components/session-provider';

describe('Delivery Dispatch Order Form & Surat Jalan Digital QR Pass UI', () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    seedDatabase(db);
  });

  describe('DeliveryPassCard (Surat Jalan Digital)', () => {
    it('renders digital delivery pass details, QR image, and supports print and token copy', async () => {
      const dispatches = await getCooperativeDispatches(db, 1);
      const pass = dispatches[0];

      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

      render(<DeliveryPassCard pass={pass} />);

      expect(screen.getByText(/Surat Jalan Digital/i)).toBeInTheDocument();
      expect(screen.getByText(pass.cooperativeName)).toBeInTheDocument();
      expect(screen.getByText(pass.kitchenName)).toBeInTheDocument();
      expect(screen.getByText(pass.qrToken)).toBeInTheDocument();

      const qrImg = screen.getByRole('img', {
        name: new RegExp(`Kode QR Surat Jalan ${pass.qrToken}`, 'i'),
      });
      expect(qrImg).toHaveAttribute('src', pass.qrCodeDataUrl);

      fireEvent.click(screen.getByRole('button', { name: /Cetak Surat Jalan/i }));
      expect(printSpy).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Salin Token QR/i }));
      await waitFor(() => {
        expect(screen.getByText(/Token QR Tersalin/i)).toBeInTheDocument();
      });

      printSpy.mockRestore();
    });
  });

  describe('DispatchOrderBuilder Component', () => {
    it('allows KOPERASI_ADMIN to select SPPG kitchen, pick items, and issue a QR delivery pass', async () => {
      const workspace = getCooperativeProcurementWorkspace(db, 1);
      const initialDispatches = await getCooperativeDispatches(db, 1);

      render(
        <SessionProvider initialRole="KOPERASI_ADMIN">
          <DispatchOrderBuilder
            cooperative={workspace.cooperative}
            kitchens={workspace.kitchens}
            farmers={workspace.farmers}
            commodities={workspace.commodities}
            initialDispatches={initialDispatches}
            onCreateDispatch={async (req) => createDeliveryDispatch(db, req)}
          />
        </SessionProvider>,
      );

      // Select SPPG kitchen
      const kitchenSelect = screen.getByLabelText(/Dapur SPPG Tujuan/i);
      fireEvent.change(kitchenSelect, { target: { value: String(workspace.kitchens[0].id) } });

      // Add a second line item using the item picker button
      fireEvent.click(screen.getByRole('button', { name: /Tambah Baris Komoditas/i }));
      expect(screen.getAllByLabelText(/Pilih Komoditas/i)).toHaveLength(2);

      // Update second item commodity, farmer, quantity, and price, then add & remove a 3rd row
      fireEvent.change(screen.getByLabelText(/Pilih Komoditas #2/i), {
        target: { value: String(workspace.commodities[1].id) },
      });
      fireEvent.change(screen.getAllByLabelText(/Petani Pemasok/i)[1], {
        target: { value: String(workspace.farmers[1].id) },
      });
      fireEvent.change(screen.getAllByLabelText(/Kuantitas/i)[1], {
        target: { value: '60' },
      });
      fireEvent.change(screen.getAllByLabelText(/Harga Satuan/i)[1], {
        target: { value: '27800' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Tambah Baris Komoditas/i }));
      expect(screen.getAllByLabelText(/Pilih Komoditas/i)).toHaveLength(3);
      fireEvent.click(screen.getByRole('button', { name: /Hapus baris komoditas 3/i }));
      expect(screen.getAllByLabelText(/Pilih Komoditas/i)).toHaveLength(2);

      // Submit dispatch order creation form
      fireEvent.click(
        screen.getByRole('button', { name: /Terbitkan Surat Jalan Digital/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Surat Jalan Digital berhasil diterbitkan/i),
        ).toBeInTheDocument();
      });

      // Verify newly created QR token is displayed on the active Surat Jalan Digital card
      expect(screen.getAllByText(/mbg_coop1_/i).length).toBeGreaterThanOrEqual(2);
    });
  });
});
