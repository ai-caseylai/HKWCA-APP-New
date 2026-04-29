import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';

type NetworkContextType = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
};

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
});

export function useNetwork() {
  return useContext(NetworkContext);
}

type Props = {
  children: ReactNode;
};

export function NetworkProvider({ children }: Props) {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);

  useEffect(() => {
    // 订阅网络状态变化
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('網絡狀態:', state.isConnected, '可達性:', state.isInternetReachable);
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable);
    });

    // 立即获取当前网络状态
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, isInternetReachable }}>
      {children}
    </NetworkContext.Provider>
  );
}
