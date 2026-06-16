// src/hooks/useSensorPoll.ts
// Replaces the Handler pollRunnable pattern from DashboardActivity.java

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSensorSnapshot } from '../api/client';
import { SensorSnapshot } from '../types';

const POLL_INTERVAL_MS = 5000;

export function useSensorPoll(enabled: boolean = true) {
  const [snapshot, setSnapshot] = useState<SensorSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchOnce = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getSensorSnapshot();
      if (mountedRef.current) {
        setSnapshot(snap);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Fetch failed');
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Immediate fetch then schedule
    fetchOnce();
    intervalRef.current = setInterval(fetchOnce, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchOnce]);

  return { snapshot, isLoading, error, refresh: fetchOnce };
}
