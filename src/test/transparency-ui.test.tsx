import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PublicTransparencyDashboard } from '@/components/public-transparency-dashboard';
import { DEFAULT_PUBLIC_TRANSPARENCY_SNAPSHOT } from '@/lib/transparency';

describe('PublicTransparencyDashboard UI Component', () => {
  it('renders live KPI cards, commodity breakdown table, and verified delivery cards', () => {
    render(<PublicTransparencyDashboard />);

    expect(
      screen.getByRole('heading', {
        name: /Dashboard Transparansi Publik Pasokan Pangan MBG/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('kpi-total-funds')).toHaveTextContent('Rp 22.793.000');
    expect(screen.getByTestId('kpi-total-volume')).toHaveTextContent('1.040 kg');
    expect(screen.getByTestId('kpi-cooperatives-farmers')).toHaveTextContent(
      '2 Koperasi · 4 Petani',
    );
    expect(screen.getByTestId('kpi-verified-deliveries')).toHaveTextContent(
      '2/3 Terverifikasi (67%)',
    );

    // Commodity absorption rows
    expect(screen.getAllByText(/Beras Medium/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Susu Sapi Pasteurisasi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sayur Bayam Segar/i).length).toBeGreaterThan(0);
  });

  it('filters deliveries and KPIs by cooperative, kitchen, status, and search query', () => {
    render(<PublicTransparencyDashboard />);

    // Filter by Banyumas Cooperative (id = 2)
    const coopSelect = screen.getByLabelText(/Filter Koperasi Desa/i);
    fireEvent.change(coopSelect, { target: { value: '2' } });

    expect(screen.getByTestId('kpi-total-funds')).toHaveTextContent('Rp 10.731.000');
    expect(screen.getByTestId('kpi-verified-deliveries')).toHaveTextContent(
      '1/1 Terverifikasi (100%)',
    );

    // Reset filter button restores full dataset
    const resetBtn = screen.getByRole('button', { name: /Reset Filter/i });
    fireEvent.click(resetBtn);
    expect(screen.getByTestId('kpi-total-funds')).toHaveTextContent('Rp 22.793.000');

    // Filter by status tab "Dalam Pengiriman"
    const dispatchedTab = screen.getByRole('button', { name: /Dalam Pengiriman/i });
    fireEvent.click(dispatchedTab);
    expect(screen.getByTestId('kpi-total-funds')).toHaveTextContent('Rp 5.580.000');

    // Search for non-existent keyword to verify empty state
    const searchInput = screen.getByLabelText(/Cari Komoditas, Desa, atau Token QR/i);
    fireEvent.change(searchInput, { target: { value: 'KomoditasTidakAdaXYZ' } });
    expect(
      screen.getByText(/Belum Ada Pengiriman yang Sesuai Filter/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tampilkan Semua Pengiriman/i }));
    expect(screen.getByTestId('kpi-total-funds')).toHaveTextContent('Rp 22.793.000');
  });

  it('opens and closes the immutable Proof-of-Delivery receipt modal and supports refresh', async () => {
    const refreshMock = vi
      .fn()
      .mockResolvedValue(DEFAULT_PUBLIC_TRANSPARENCY_SNAPSHOT);

    render(<PublicTransparencyDashboard onRefreshSnapshot={refreshMock} />);

    // Open PoD modal for a verified delivery
    const viewPodButtons = screen.getAllByRole('button', {
      name: /Lihat Bukti Terima \(PoD\)/i,
    });
    expect(viewPodButtons.length).toBeGreaterThan(0);
    fireEvent.click(viewPodButtons[0]);

    expect(
      screen.getByRole('dialog', {
        name: /Bukti Terima Pengiriman/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Terkunci Permanen di Database/i)).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Tutup Bukti Terima/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Trigger refresh
    const refreshBtn = screen.getByRole('button', { name: /Segarkan Data/i });
    fireEvent.click(refreshBtn);
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
