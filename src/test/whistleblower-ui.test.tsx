import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PublicTransparencyDashboard } from '@/components/public-transparency-dashboard';
import { SessionProvider } from '@/components/session-provider';
import { WhistleblowerPortal } from '@/components/whistleblower-portal';
import {
  DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT,
  type SubmitCommunityReportInput,
  type TriageCommunityReportInput,
} from '@/lib/whistleblower';

describe('WhistleblowerPortal UI & Delivery Card Integration', () => {
  it('renders KPI summary cards and privacy-masked report feed without exposing contact numbers', () => {
    render(
      <SessionProvider initialRole="PUBLIC_OBSERVER">
        <WhistleblowerPortal initialSnapshot={DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT} />
      </SessionProvider>,
    );

    expect(screen.getByTestId('wb-kpi-total')).toHaveTextContent('3');
    expect(screen.getByTestId('wb-kpi-open')).toHaveTextContent('1');
    expect(screen.getByTestId('wb-kpi-in-progress')).toHaveTextContent('1');
    expect(screen.getByTestId('wb-kpi-resolved')).toHaveTextContent('1');

    expect(screen.getByText('Ibu R*** M***')).toBeInTheDocument();
    expect(screen.getByText('Pelapor Anonim')).toBeInTheDocument();
    expect(screen.getByText('Pak S*** R***')).toBeInTheDocument();

    // Public observer must not see triage action buttons
    expect(screen.queryByTestId('triage-btn-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('triage-btn-2')).not.toBeInTheDocument();
  });

  it('filters reports by status, category, cooperative, and search keyword', () => {
    render(
      <SessionProvider initialRole="PUBLIC_OBSERVER">
        <WhistleblowerPortal initialSnapshot={DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT} />
      </SessionProvider>,
    );

    expect(screen.getAllByTestId('wb-report-card')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Laporan Baru' }));
    expect(screen.getAllByTestId('wb-report-card')).toHaveLength(1);
    expect(
      screen.getByText(/Usulan penyesuaian harga acuan daging ayam ras minggu depan/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reset Filter/i }));
    expect(screen.getAllByTestId('wb-report-card')).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Filter Kategori Laporan'), {
      target: { value: 'KUALITAS_PANGAN' },
    });
    expect(screen.getAllByTestId('wb-report-card')).toHaveLength(1);
    expect(
      screen.getByText(/Sebagian ikatan bayam perlu penyortiran ulang/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter Kategori Laporan'), {
      target: { value: 'ALL' },
    });
    fireEvent.change(screen.getByLabelText('Cari Laporan Warga'), {
      target: { value: 'jembatan' },
    });
    expect(screen.getAllByTestId('wb-report-card')).toHaveLength(1);
    expect(
      screen.getByText(/Keterlambatan armada pengangkut akibat perbaikan jembatan desa/i),
    ).toBeInTheDocument();
  });

  it('submits an anonymous or masked community report pre-linked from deliveryId and invokes onSubmitReport', async () => {
    const submittedPayloads: SubmitCommunityReportInput[] = [];
    const onSubmitReport = vi.fn(async (input: SubmitCommunityReportInput) => {
      submittedPayloads.push(input);
      return {
        success: true as const,
        report: {
          ...DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT.reports[0],
          id: 99,
          category: input.category,
          severity: input.severity,
          status: 'BARU' as const,
          statusLabel: 'Laporan Baru',
          reporterRoleLabel: input.reporterRoleLabel,
          reporterDisplayName: input.isAnonymous ? 'Pelapor Anonim' : 'Ibu D*** P***',
          isAnonymous: input.isAnonymous,
          deliveryId: input.deliveryId ?? null,
          title: input.title,
          description: input.description,
          responseNote: null,
          respondedBy: null,
          resolvedAtIso: null,
        },
      };
    });

    render(
      <SessionProvider initialRole="PUBLIC_OBSERVER">
        <WhistleblowerPortal
          initialSnapshot={DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT}
          initialDeliveryId={3}
          onSubmitReport={onSubmitReport}
        />
      </SessionProvider>,
    );

    // Form opens automatically when initialDeliveryId is passed
    expect(screen.getByLabelText('Formulir Pengaduan Warga')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Judul Ringkas Kendala/i), {
      target: { value: 'Suhu boks telur hangat saat tiba di dapur' },
    });
    fireEvent.change(screen.getByLabelText(/Kronologi & Detail Lapangan/i), {
      target: {
        value: 'Mohon penutup boks pengangkut diperiksa agar bahan pangan tetap dingin.',
      },
    });
    fireEvent.change(screen.getByLabelText(/Nomor WhatsApp \/ Kontak Internal/i), {
      target: { value: '081234567890' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Kirim Laporan Aman/i }));

    await waitFor(() => {
      expect(onSubmitReport).toHaveBeenCalledTimes(1);
    });

    expect(submittedPayloads[0].deliveryId).toBe(3);
    expect(submittedPayloads[0].isAnonymous).toBe(true);
    expect(submittedPayloads[0].reporterContact).toBe('081234567890');
    expect(
      screen.getByText(/Laporan warga berhasil dikirim!/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Suhu boks telur hangat saat tiba di dapur'),
    ).toBeInTheDocument();
    expect(screen.queryByText('081234567890')).not.toBeInTheDocument();
  });

  it('reveals role-gated triage modal for KOPERASI_ADMIN and updates report status', async () => {
    const triagedInputs: TriageCommunityReportInput[] = [];
    const onTriageReport = vi.fn(async (input: TriageCommunityReportInput) => {
      triagedInputs.push(input);
      const target = DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT.reports.find(
        (r) => r.id === input.reportId,
      )!;
      return {
        success: true as const,
        report: {
          ...target,
          status: input.newStatus,
          statusLabel:
            input.newStatus === 'SELESAI'
              ? 'Selesai Ditangani'
              : 'Sedang Ditindaklanjuti',
          responseNote: input.responseNote,
          respondedBy: input.respondedBy,
          resolvedAtIso:
            input.newStatus === 'SELESAI' ? new Date().toISOString() : null,
        },
      };
    });

    render(
      <SessionProvider initialRole="KOPERASI_ADMIN">
        <WhistleblowerPortal
          initialSnapshot={DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT}
          onTriageReport={onTriageReport}
        />
      </SessionProvider>,
    );

    const triageBtn = screen.getByTestId('triage-btn-3');
    fireEvent.click(triageBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Perbarui Status Penanganan/i), {
      target: { value: 'SELESAI' },
    });
    fireEvent.change(screen.getByLabelText(/Catatan Penanganan Resmi/i), {
      target: {
        value: 'Harga acuan ayam ras sudah disesuaikan bersama tim pemda minggu ini.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Tindak Lanjut/i }));

    await waitFor(() => {
      expect(onTriageReport).toHaveBeenCalledTimes(1);
    });

    expect(triagedInputs[0].reportId).toBe(3);
    expect(triagedInputs[0].newStatus).toBe('SELESAI');
    expect(
      screen.getByText(/Harga acuan ayam ras sudah disesuaikan bersama tim pemda minggu ini/i),
    ).toBeInTheDocument();
  });

  it('renders Laporkan Kendala quick-action links on every delivery card in PublicTransparencyDashboard', () => {
    render(<PublicTransparencyDashboard />);

    const link1 = screen.getByTestId('report-delivery-link-1');
    const link2 = screen.getByTestId('report-delivery-link-2');
    const link3 = screen.getByTestId('report-delivery-link-3');

    expect(link1).toHaveAttribute('href', '/laporan?deliveryId=1');
    expect(link2).toHaveAttribute('href', '/laporan?deliveryId=2');
    expect(link3).toHaveAttribute('href', '/laporan?deliveryId=3');
  });
});
