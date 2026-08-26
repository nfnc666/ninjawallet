import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';

import { Button, Card, CoinIcon, ScreenBackground, ScreenHeader } from '@/components';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 249:2287 ("receive btc") — coin mark, QR, tappable address, share.
 * The address is derived from the seed, so it is the real receiving address
 * for whichever chain the symbol belongs to.
 */
export default function ReceiveScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { network, addresses } = useWallet();
  const [copied, setCopied] = useState(false);

  const address = symbol === 'BTC' ? addresses?.bitcoin : addresses?.evm;

  if (address === undefined || address === null) {
    return (
      <ScreenBackground>
        <ScreenHeader title={`Receive ${symbol}`} />
        <Text style={styles.locked}>Unlock the wallet to see your address.</Text>
      </ScreenBackground>
    );
  }

  const handleCopy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScreenBackground>
      <ScreenHeader title={`Receive ${symbol}`} />

      <View style={styles.body}>
        <CoinIcon symbol={symbol} size={72} />

        <View style={styles.qrFrame}>
          <QRCode value={address} size={200} backgroundColor="#FFFFFF" color="#000000" />
        </View>

        <Text style={styles.label}>Your {symbol} address</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Copy ${symbol} address`}
          onPress={handleCopy}
          style={({ pressed }) => [styles.addressBox, pressed && styles.addressBoxPressed]}
        >
          <Text style={styles.address} selectable>
            {address}
          </Text>
        </Pressable>

        <Text style={styles.hint}>
          {copied ? 'Copied to clipboard' : `Tap the address to copy`}
        </Text>

        {symbol === 'BTC' ? (
          <Card style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              This is a native SegWit (BIP-84) mainnet address derived from your phrase. This build
              does not track a Bitcoin balance yet — check it in a block explorer.
            </Text>
          </Card>
        ) : !network.isMainnet ? (
          <Card style={styles.notice}>
            <Ionicons name="warning-outline" size={20} color={colors.warning} />
            <Text style={styles.noticeText}>
              This address is on {network.name}. Only send test coins here — real {'⁠'}ETH sent
              to it on mainnet is a different balance entirely.
            </Text>
          </Card>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label="Share address"
          leading={<Ionicons name="share-outline" size={18} color={colors.text} />}
          onPress={() => Share.share({ message: address })}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.lg,
  },
  qrFrame: {
    padding: spacing.lg,
    borderRadius: radius.sheet,
    backgroundColor: '#FFFFFF',
  },
  label: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  addressBox: {
    width: '100%',
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  addressBoxPressed: {
    backgroundColor: colors.surfacePressed,
  },
  address: {
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'center',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  noticeText: {
    ...typography.caption,
    flex: 1,
    color: colors.textMuted,
  },
  locked: {
    ...typography.body,
    color: colors.textMuted,
  },
  actions: {
    paddingVertical: spacing.xl,
  },
});
