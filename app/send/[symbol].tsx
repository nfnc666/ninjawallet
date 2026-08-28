import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isAddress } from 'ethers';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Button, Card, CoinIcon, ScreenBackground, ScreenHeader, TextField } from '@/components';
import {
  formatAmount,
  formatCoin,
  parseAmount,
  quoteTransfer,
  sendNativeCoin,
  unitOf,
  type FeeQuote,
} from '@/wallet/chain';
import { assetsForNetwork } from '@/wallet/assets';
import { quoteTokenTransfer, sendToken } from '@/wallet/erc20';
import { useBalance } from '@/wallet/useBalance';
import { useTokenBalances } from '@/wallet/useTokenBalances';
import { takeScannedPayment } from '@/wallet/scanResult';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

type Stage = 'compose' | 'review' | 'sent';

/**
 * figma 249:2327 ("send btc"), reworked into a real transfer flow: compose,
 * review the actual on-chain fee, then sign and broadcast.
 *
 * Ether and ERC-20s run through the same form; they differ only in which
 * balance funds the amount and which call is signed. The fee is quoted in the
 * native coin either way, because that is what pays for gas.
 *
 * Bitcoin is receive-only in this build, so a BTC send is refused up front
 * rather than shown as a dead form.
 */
export default function SendScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { network, addresses, withPhrase } = useWallet();

  const asset = assetsForNetwork(network).find((candidate) => candidate.symbol === symbol);
  const token = asset?.token;
  const unit = asset?.unit ?? unitOf(network);

  const balance = useBalance(network, addresses?.evm ?? null);
  const tokens = useTokenBalances(network, token !== undefined ? (addresses?.evm ?? null) : null);
  const available = token !== undefined ? (tokens.balances[symbol] ?? null) : balance.value;

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<Stage>('compose');
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picked up when the scanner closes. Reading it here rather than through a
  // router param keeps the address out of the navigation URL.
  useFocusEffect(
    useCallback(() => {
      const scanned = takeScannedPayment();
      if (scanned === null) return;

      setTo(scanned.address);
      setStage('compose');
      setError(null);
      // A payment code may request an amount; honour it, but never silently —
      // it lands in the field the user still has to confirm.
      if (scanned.amount !== null) setAmount(scanned.amount);
      // The setters are stable, so this runs once per focus either way; they
      // are listed because the compiler infers them and refuses to optimise a
      // callback whose declared dependencies do not match.
    }, [setTo, setStage, setError, setAmount]),
  );

  if (symbol !== network.currencySymbol && token === undefined) {
    return (
      <ScreenBackground>
        <ScreenHeader title={`Send ${symbol}`} />
        <Card style={styles.notice}>
          <Ionicons name="information-circle-outline" size={22} color={colors.warning} />
          <Text style={styles.noticeText}>
            This build can derive and receive {symbol}, but it cannot build {symbol} transactions
            yet. Only {network.currencySymbol} can be sent.
          </Text>
        </Card>
      </ScreenBackground>
    );
  }

  const handleReview = async () => {
    setBusy(true);
    setError(null);
    try {
      const value = parseAmount(amount, unit);
      if (addresses === null) throw new Error('Wallet is locked.');

      const fee =
        token !== undefined
          ? await quoteTokenTransfer({
              networkId: network.id,
              token,
              from: addresses.evm,
              to: to.trim(),
              amount: value,
            })
          : await quoteTransfer({
              networkId: network.id,
              from: addresses.evm,
              to: to.trim(),
              amount: value,
            });
      setQuote(fee);
      setStage('review');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not price this transfer.');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    setBusy(true);
    setError(null);
    try {
      const value = parseAmount(amount, unit);
      const tx = await withPhrase((phrase) =>
        token !== undefined
          ? sendToken({ networkId: network.id, phrase, token, to: to.trim(), amount: value })
          : sendNativeCoin({ networkId: network.id, phrase, to: to.trim(), amount: value }),
      );
      setTxHash(tx.hash);
      setStage('sent');
      balance.refresh();
      tokens.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The transaction was not sent.');
      setStage('compose');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'sent' && txHash !== null) {
    return (
      <ScreenBackground>
        <ScreenHeader title="Sent" showBack={false} />
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={72} color={colors.positive} />
          <Text style={styles.doneTitle}>Transaction broadcast</Text>
          <Text style={styles.doneBody}>
            It is now waiting to be included in a block. That usually takes seconds, but the network
            decides — not the app.
          </Text>
          <Button
            label="View on explorer"
            variant="ghost"
            onPress={() => Linking.openURL(network.explorerTxUrl(txHash))}
          />
        </View>
        <View style={styles.actions}>
          <Button label="Done" onPress={() => router.replace('/(wallet)')} />
        </View>
      </ScreenBackground>
    );
  }

  const recipientValid = isAddress(to.trim());
  const canReview = recipientValid && amount.trim() !== '' && !busy;

  return (
    <ScreenBackground>
      <ScreenHeader title={`Send ${symbol}`} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <View style={styles.hero}>
            <CoinIcon symbol={symbol} size={72} />
            {available !== null ? (
              <Text style={styles.available}>
                {formatAmount(available, unit)} {symbol} available
              </Text>
            ) : null}
          </View>

          <TextField
            label="Recipient address"
            icon="wallet-outline"
            value={to}
            onChangeText={(text) => {
              setTo(text);
              setStage('compose');
              setError(null);
            }}
            placeholder="0x…"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            error={
              to.trim() !== '' && !recipientValid ? 'That is not a valid address.' : undefined
            }
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scan a QR code"
                hitSlop={12}
                onPress={() => router.push({ pathname: '/scan', params: { chain: 'evm' } })}
              >
                <Ionicons name="qr-code-outline" size={20} color={colors.text} />
              </Pressable>
            }
          />

          <TextField
            label={`Amount (${symbol})`}
            icon="cash-outline"
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              setStage('compose');
              setError(null);
            }}
            placeholder="0.0"
            keyboardType="decimal-pad"
          />

          {stage === 'review' && quote !== null ? (
            <Card style={styles.review}>
              <Text style={styles.reviewTitle}>Review</Text>
              <ReviewRow label="Amount" value={`${amount} ${symbol}`} />
              <ReviewRow label="Network" value={network.name} />
              {/* Gas is always paid in the native coin, never in the token
                  being sent — labelling it with the token's ticker would
                  misstate what the transfer costs. */}
              <ReviewRow
                label="Max network fee"
                value={`${formatCoin(quote.maxFee, network)} ${network.currencySymbol}`}
              />
              <ReviewRow label="Gas limit" value={quote.gasLimit.toString()} />
              <Text style={styles.reviewNote}>
                Sending is final. There is no way to reverse a confirmed transaction, and an address
                typo sends the coins to a stranger.
              </Text>
            </Card>
          ) : null}

          {error !== null ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.actions}>
        {stage === 'review' ? (
          <Button label={`Send ${amount} ${symbol}`} loading={busy} onPress={handleSend} />
        ) : (
          <Button label="Review" disabled={!canReview} loading={busy} onPress={handleReview} />
        )}
      </View>
    </ScreenBackground>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  body: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
  },
  available: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  review: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  reviewTitle: {
    ...typography.body,
    color: colors.text,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  reviewLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  reviewValue: {
    ...typography.bodySmall,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  reviewNote: {
    ...typography.caption,
    color: colors.warning,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  noticeText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.textMuted,
  },
  error: {
    ...typography.bodySmall,
    color: colors.negative,
  },
  done: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  doneTitle: {
    ...typography.headline,
    color: colors.text,
    textAlign: 'center',
  },
  doneBody: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actions: {
    paddingVertical: spacing.xl,
    borderRadius: radius.card,
  },
});
