'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { WhistleblowerPortal } from '@/components/whistleblower-portal';
import {
  DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT,
  type PublicWhistleblowerSnapshot,
} from '@/lib/whistleblower';
import {
  loadPublicWhistleblowerSnapshotAction,
  submitCommunityReportAction,
  triageCommunityReportAction,
} from './actions';

function LaporanPageContent() {
  const searchParams = useSearchParams();
  const rawDeliveryId = searchParams.get('deliveryId');
  const parsedDeliveryId = rawDeliveryId ? Number(rawDeliveryId) : null;
  const initialDeliveryId =
    parsedDeliveryId !== null &&
    Number.isInteger(parsedDeliveryId) &&
    parsedDeliveryId > 0
      ? parsedDeliveryId
      : null;

  const [snapshot, setSnapshot] = useState<PublicWhistleblowerSnapshot>(
    DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT,
  );

  useEffect(() => {
    let cancelled = false;
    async function syncLiveSnapshot() {
      try {
        const liveData = await loadPublicWhistleblowerSnapshotAction();
        if (!cancelled && liveData) {
          setSnapshot(liveData);
        }
      } catch {
        // Fallback to deterministic default snapshot in client-only test runs
      }
    }
    void syncLiveSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WhistleblowerPortal
      key={`${snapshot.kpis.totalReportsCount}-${snapshot.kpis.resolvedReportsCount}-${initialDeliveryId ?? 'none'}`}
      initialSnapshot={snapshot}
      initialDeliveryId={initialDeliveryId}
      onSubmitReport={submitCommunityReportAction}
      onTriageReport={triageCommunityReportAction}
      onRefreshSnapshot={loadPublicWhistleblowerSnapshotAction}
    />
  );
}

/**
 * Community Whistleblower & Feedback Loop page (`/laporan`).
 */
export default function LaporanPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-600">
            Memuat Portal Pengaduan Warga...
          </div>
        }
      >
        <LaporanPageContent />
      </Suspense>
    </main>
  );
}
