import React, { useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Card, ScreenBackground, ScreenHeader } from '@/components';
import { parsePaymentCode, UnreadablePaymentCodeError } from '@/wallet/paymentUri';
import { setScannedPayment } from '@/wallet/scanResult';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 297:511 / 297:610 ("scan qr code") — the corner-bracket viewfinder.
 *
 * The design uses this frame to pair a desktop app, which needs a sync
 * protocol this build does not have. The frame is reused for the thing a
 * wallet genuinely needs a camera for: reading a recipient address, so a
 * 42-character string never has to be typed by hand.
 */
export default function Scan() {
  const { chain } = useLocalSearchParams<{ chain?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  // Guards against the camera firing the same code repeatedly while the
  // navigation away is still in flight.
  const handled = useRef(false);

  const onScanned = ({ data }: { data: string }) => {
    if (handled.current) return;

    try {
      const request = parsePaymentCode(data);

      if (chain !== undefined && request.chain !== chain) {
        setError(
          `That is a ${request.chain === 'evm' ? 'an Ethereum' : 'a Bitcoin'} address, but this ` +
            'transfer needs the other kind.',
        );
        return;
      }

      handled.current = true;
      setScannedPayment(request);
      router.back();
    } catch (caught) {
      setError(
        caught instanceof UnreadablePaymentCodeError
          ? caught.message
          : 'That QR code could not be read.',
      );
    }
  };

  if (permission === null) {
    return (
      <ScreenBackground>
        <ScreenHeader title="Scan QR code" />
      </ScreenBackground>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenBackground>
        <ScreenHeader title="Scan QR code" />
        <View style={styles.permission}>
          <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
          <Text style={styles.headline}>Camera access needed</Text>
          <Text style={styles.body}>
            The camera is used only to read a QR code on this device. Nothing is recorded, stored
            or sent anywhere.
          </Text>
          {permission.canAskAgain ? (
            <Button label="Allow camera" onPress={requestPermission} />
          ) : (
            <Button
              label="Open settings"
              variant="ghost"
              onPress={() => Linking.openSettings()}
            />
          )}
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground padded={false}>
      <View style={styles.header}>
        <ScreenHeader title="Scan QR code" />
      </View>

      <View style={styles.viewfinder}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />

        {/* figma: four corner brackets, no full frame */}
        <View style={styles.brackets} pointerEvents="none">
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.headline}>Point at a payment code</Text>
        <Text style={styles.body}>
          Works with a plain address or a payment link. The address is filled in for you — check it
          matches before you send.
        </Text>

        {error !== null ? (
          <Card style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.negative} />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}
      </View>
    </ScreenBackground>
  );
}

const BRACKET = 44;
const THICKNESS = 4;

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl },
  viewfinder: {
    marginHorizontal: spacing.xl,
    aspectRatio: 1,
    borderRadius: radius.sheet,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
  },
  brackets: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    margin: spacing.lg,
  },
  corner: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
    borderColor: colors.text,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: THICKNESS, borderLeftWidth: THICKNESS },
  topRight: { top: 0, right: 0, borderTopWidth: THICKNESS, borderRightWidth: THICKNESS },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: THICKNESS, borderLeftWidth: THICKNESS },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: THICKNESS, borderRightWidth: THICKNESS },
  footer: { flex: 1, gap: spacing.md, padding: spacing.xl, alignItems: 'center' },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  headline: { ...typography.headline, color: colors.text, textAlign: 'center' },
  body: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
  errorCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, alignSelf: 'stretch' },
  errorText: { ...typography.bodySmall, flex: 1, color: colors.negative },
});
