// src/hooks/useNetworkStatus.ts
// Wrapper around @react-native-community/netinfo to expose online/offline state

import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
    });
    // Initial fetch
    NetInfo.fetch().then(state => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  return { isOnline };
}
