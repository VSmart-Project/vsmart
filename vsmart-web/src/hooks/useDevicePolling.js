import { useEffect, useRef } from 'react';

const POLL_INTERVAL = 10000; // 10 seconds

export const useDevicePolling = (fetchDevicePositions, isActive = false) => {
  const fetchRef = useRef(fetchDevicePositions);

  useEffect(() => {
    fetchRef.current = fetchDevicePositions;
  }, [fetchDevicePositions]);

  useEffect(() => {
    if (!isActive) return;

    // Initial fetch
    fetchRef.current?.();

    // Start polling
    const interval = setInterval(() => {
      fetchRef.current?.();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [isActive]);
};
