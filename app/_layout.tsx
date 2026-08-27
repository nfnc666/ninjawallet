// Must come first: ethers reaches for crypto.getRandomValues at import time.
import '@/wallet/polyfills';

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WalletProvider } from '@/wallet/WalletContext';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="(onboarding)" options={{ animation: 'none' }} />
          <Stack.Screen name="(wallet)" options={{ animation: 'none' }} />
          <Stack.Screen name="send/[symbol]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="receive/[symbol]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="buy" options={{ presentation: 'modal' }} />
          <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        </Stack>
      </WalletProvider>
    </SafeAreaProvider>
  );
}
