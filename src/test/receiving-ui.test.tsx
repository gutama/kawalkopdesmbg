import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from './helpers/db';
import { seedDatabase } from '@/db/seed';
import type { AppDatabase } from '@/db/client';
import {
  completeDeliveryVerification,
  listKitchenDeliveries,
  lookupDeliveryByQrToken,
} from '@/lib/receiving';
import { SppgReceivingWorkspace } from '@/components/sppg-receiving-workspace';
import { SessionProvider } from '@/components/session-provider';

describe('SPPG Mobile Receiving, QR Scanner & Item Inspection UI', () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    seedDatabase(db);
  });

  it('prompts non-SPPG_STAFF users to switch to Petugas Dapur SPPG role', async () => {
    const initialDeliveries = await listKitchenDeliveries(db, 1);

    render(
      <SessionProvider initialRole="PUBLIC_OBSERVER">
        <SppgReceivingWorkspace
          initialDeliveries={initialDeliveries}
          onLookupToken={async (raw) => lookupDeliveryByQrToken(db, raw)}
        />
      </SessionProvider>,
    );

    expect(
      screen.getByText(/Aktifkan Peran Petugas Dapur SPPG untuk Verifikasi Penerimaan/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Beralih ke Peran Petugas Dapur SPPG/i }),
    );

    expect(
      screen.getByRole('heading', { name: /Pindai QR Surat Jalan & Periksa Pasokan/i }),
    ).toBeInTheDocument();
  });

  it('supports manual QR token lookup, camera fallback, and item inspection checklist', async () => {
    const initialDeliveries = await listKitchenDeliveries(db, 1);

    render(
      <SessionProvider initialRole="SPPG_STAFF">
        <SppgReceivingWorkspace
          initialDeliveries={initialDeliveries}
          onLookupToken={async (raw) => lookupDeliveryByQrToken(db, raw)}
        />
      </SessionProvider>,
    );

    // Toggle camera scanner in test environment and verify graceful fallback message
    fireEvent.click(screen.getByRole('button', { name: /Buka Kamera Pemindai QR/i }));
    await waitFor(() => {
      expect(screen.getByText(/Gunakan kolom input token manual/i)).toBeInTheDocument();
    });

    // Enter the dispatched Subang QR token manually and load delivery
    const tokenInput = screen.getByLabelText(/Kode Token QR Surat Jalan/i);
    fireEvent.change(tokenInput, {
      target: { value: 'mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cari Surat Jalan/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Cari Surat Jalan/i }),
      ).not.toBeDisabled();
    });

    // Verify both line items (Beras Medium 200 kg & Daging Ayam Ras 80 kg) appear
    expect(screen.getByText('Beras Medium')).toBeInTheDocument();
    expect(screen.getByText('Daging Ayam Ras')).toBeInTheDocument();

    // Adjust received quantity for Daging Ayam Ras to 78 kg to trigger a shortage badge
    const receivedInputs = screen.getAllByLabelText(/Jumlah Diterima/i);
    fireEvent.change(receivedInputs[1], { target: { value: '78' } });

    expect(screen.getByText(/Selisih Kurang \(-2 kg\)/i)).toBeInTheDocument();

    // Check both inspection checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    for (const checkbox of checkboxes) {
      if (!(checkbox as HTMLInputElement).checked) {
        fireEvent.click(checkbox);
      }
    }

    expect(
      screen.getByText(/2 dari 2 komoditas telah diperiksa/i),
    ).toBeInTheDocument();

    // Test lookup failure alert with an unknown token
    fireEvent.change(tokenInput, {
      target: { value: 'mbg_token_salah_999' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cari Surat Jalan/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/tidak ditemukan/i);
    });

    // Test selecting a verified delivery from the quick queue
    const verifiedQueueBtn = screen.getByRole('button', {
      name: /mbg_sbg_20261014_verified/i,
    });
    fireEvent.click(verifiedQueueBtn);
    expect(screen.getByText('Sayur Bayam Segar')).toBeInTheDocument();
  });

  it('captures PoD photo, signs off receipt, and transitions delivery to VERIFIED with immutable receipt', async () => {
    const initialDeliveries = await listKitchenDeliveries(db, 1);

    render(
      <SessionProvider initialRole="SPPG_STAFF">
        <SppgReceivingWorkspace
          initialDeliveries={initialDeliveries}
          onLookupToken={async (raw) => lookupDeliveryByQrToken(db, raw)}
          onVerifyDelivery={async (req) => completeDeliveryVerification(db, req)}
        />
      </SessionProvider>,
    );

    // Check all line items in the inspection checklist
    const itemCheckboxes = screen.getAllByRole('checkbox', {
      name: /^Periksa /i,
    });
    for (const checkbox of itemCheckboxes) {
      fireEvent.click(checkbox);
    }

    // Attach simulated compressed PoD photo
    fireEvent.click(
      screen.getByRole('button', { name: /Lampirkan Foto Bukti Komoditas/i }),
    );
    expect(
      screen.getByText(/Foto Bukti Terima siap diunggah \(Terkompresi/i),
    ).toBeInTheDocument();

    // Fill receiver name & sign-off note and confirm digital signature checkbox
    const receiverInput = screen.getByLabelText(/Nama & Jabatan Petugas Penerima/i);
    fireEvent.change(receiverInput, {
      target: { value: 'Ibu Siti Aminah (Kepala Dapur SPPG Subang)' },
    });

    const noteInput = screen.getByLabelText(/Catatan Penerimaan & Kualitas Pangan/i);
    fireEvent.change(noteInput, {
      target: { value: 'Seluruh bahan pangan tiba segar dan sesuai timbangan.' },
    });

    const signatureCheckbox = screen.getByRole('checkbox', {
      name: /Saya menyatakan komoditas telah diperiksa secara fisik/i,
    });
    fireEvent.click(signatureCheckbox);

    // Submit PoD verification
    fireEvent.click(
      screen.getByRole('button', {
        name: /Sahkan Bukti Terima \(PoD\) & Verifikasi Pengiriman/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Berita Acara Serah Terima Digital Terverifikasi/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Seluruh bahan pangan tiba segar dan sesuai timbangan/i),
    ).toBeInTheDocument();
  });
});
