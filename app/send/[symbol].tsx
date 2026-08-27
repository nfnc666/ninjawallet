import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isAddress } from 'ethers';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Card, CoinIcon, ScreenBackground, ScreenHeader, TextField } from '@/components';
import { formatCoin, parseCoin, quoteTransfer, sendNativeCoin, type FeeQuote } from '@/wallet/chain';
import { useBalance } from '@/wallet/useBalance';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

type Stage = 'compose' | 'review' | 'sent';

/**
 * figma 249:2327 ("send btc"), reworked into a real transfer flow: compose,
 * review the actual on-chain fee, then sign and broadcast.
 *
 * Bitcoin is receive-only in this build, so a BTC send is refused up front
 * rather than shown as a dead form.
 */
export default function SendScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { network, addresses, withPhrase } = useWallet();
  const balance = useBalance(network, addresses?.evm ?? null);

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<Stage>('compose');
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (symbol !== network.currencySymbol) {
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
      const value = parseCoin(amount, network);
      if (addresses === null) throw new Error('Wallet is locked.');

      const fee = await quoteTransfer({
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
      const value = parseCoin(amount, network);
      const tx = await withPhrase((phrase) =>
        sendNativeCoin({ networkId: network.id, phrase, to: to.trim(), amount: value }),
      );
      setTxHash(tx.hash);
      setStage('sent');
      balance.refresh();
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
            {balance.value !== null ? (
              <Text style={styles.available}>
                {formatCoin(balance.value, network)} {symbol} available
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
              <ReviewRow
                label="Max network fee"
                value={`${formatCoin(quote.maxFee, network)} ${symbol}`}
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
