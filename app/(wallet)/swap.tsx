import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Button, Card, CoinIcon, ScreenBackground, ScreenHeader, TextField } from '@/components';
import {
  DEFAULT_SLIPPAGE_BPS,
  SLIPPAGE_OPTIONS,
  executeSwap,
  fetchSwapQuote,
  formatTokenAmount,
  isSwapConfigured,
  needsApproval,
  parseTokenAmount,
  approveExactAmount,
  slippagePercent,
  type SwapQuote,
} from '@/wallet/swap';
import { networkSupportsSwap, tokensForNetwork, type Token } from '@/wallet/tokens';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

type Stage = 'compose' | 'quoted' | 'approving' | 'swapping' | 'done';

/**
 * figma 249:845 ("swap") — from/to cards with the circular flip button between
 * them, extended with the parts a real swap needs: slippage, the token
 * allowance step, and the minimum output the trade actually guarantees.
 */
export default function Swap() {
  const { network, addresses, withPhrase } = useWallet();
  const tokens = tokensForNetwork(network.id);

  const [sellToken, setSellToken] = useState<Token | null>(tokens[0] ?? null);
  const [buyToken, setBuyToken] = useState<Token | null>(tokens[1] ?? null);
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [stage, setStage] = useState<Stage>('compose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [picking, setPicking] = useState<'sell' | 'buy' | null>(null);

  const unsupported = !networkSupportsSwap(network.id);
  const unconfigured = !isSwapConfigured();
  const blocked = unsupported || unconfigured;

  const invalidate = () => {
    setQuote(null);
    setStage('compose');
    setError(null);
  };

  const handleQuote = async () => {
    if (sellToken === null || buyToken === null || addresses === null) return;
    setBusy(true);
    setError(null);
    try {
      const next = await fetchSwapQuote({
        networkId: network.id,
        sellToken,
        buyToken,
        sellAmount: parseTokenAmount(amount, sellToken),
        taker: addresses.evm,
        slippageBps,
      });
      setQuote(next);
      setStage('quoted');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not price that swap.');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (quote === null || quote.allowanceTarget === null) return;
    setBusy(true);
    setStage('approving');
    setError(null);
    try {
      const tx = await withPhrase((phrase) =>
        approveExactAmount({
          networkId: network.id,
          phrase,
          token: quote.sellToken,
          spender: quote.allowanceTarget as string,
          amount: quote.sellAmount,
        }),
      );
      await tx.wait();
      // The allowance has moved, so the quote's view of it is stale. Re-quote
      // rather than swapping on a stale route.
      await handleQuote();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Approval failed.');
      setStage('quoted');
    } finally {
      setBusy(false);
    }
  };

  const handleSwap = async () => {
    if (quote === null) return;
    setBusy(true);
    setStage('swapping');
    setError(null);
    try {
      const tx = await withPhrase((phrase) =>
        executeSwap({ networkId: network.id, phrase, quote }),
      );
      setTxHash(tx.hash);
      setStage('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The swap was not sent.');
      setStage('quoted');
    } finally {
      setBusy(false);
    }
  };

  const minOut = useMemo(
    () => (quote !== null ? formatTokenAmount(quote.minBuyAmount, quote.buyToken) : null),
    [quote],
  );

  if (stage === 'done' && txHash !== null) {
    return (
      <ScreenBackground>
        <ScreenHeader title="Swap sent" showBack={false} />
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={72} color={colors.positive} />
          <Text style={styles.doneTitle}>Swap broadcast</Text>
          <Text style={styles.doneBody}>
            The route is locked to at least {minOut} {quote?.buyToken.symbol}. If the price moves
            past that before it confirms, the trade reverts rather than filling worse.
          </Text>
          <Button
            label="View on explorer"
            variant="ghost"
            onPress={() => Linking.openURL(network.explorerTxUrl(txHash))}
          />
        </View>
        <View style={styles.footer}>
          <Button
            label="Done"
            onPress={() => {
              setTxHash(null);
              setAmount('');
              invalidate();
            }}
          />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScreenHeader title="Swap" showBack={false} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {blocked ? (
            <Card style={styles.notice}>
              <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
              <Text style={styles.noticeText}>
                {unsupported
                  ? `Swapping is not available on ${network.name} — aggregators do not route ` +
                    'testnet liquidity. Switch to Ethereum in Settings to swap.'
                  : 'Swapping needs a 0x API key. Set EXPO_PUBLIC_0X_API_KEY and restart. ' +
                    'Until then this screen stays disabled rather than offering a button ' +
                    'that cannot work.'}
              </Text>
            </Card>
          ) : null}

          <TokenCard
            direction="From"
            token={sellToken}
            editable={!blocked}
            amount={amount}
            onAmountChange={(text) => {
              setAmount(text);
              invalidate();
            }}
            onPick={() => setPicking('sell')}
          />

          <View style={styles.flipRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap direction"
              disabled={blocked}
              onPress={() => {
                setSellToken(buyToken);
                setBuyToken(sellToken);
                invalidate();
              }}
            >
              <LinearGradient
                colors={colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.flip}
              >
                <Ionicons name="swap-vertical" size={20} color={colors.text} />
              </LinearGradient>
            </Pressable>
          </View>

          <TokenCard
            direction="To"
            token={buyToken}
            editable={false}
            amount={
              quote !== null ? formatTokenAmount(quote.buyAmount, quote.buyToken) : ''
            }
            onPick={() => setPicking('buy')}
          />

          <View style={styles.slippage}>
            <Text style={styles.slippageLabel}>Max slippage</Text>
            <View style={styles.slippageOptions}>
              {SLIPPAGE_OPTIONS.map((bps) => (
                <Pressable
                  key={bps}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: bps === slippageBps }}
                  disabled={blocked}
                  onPress={() => {
                    setSlippageBps(bps);
                    invalidate();
                  }}
                  style={[styles.chip, bps === slippageBps && styles.chipActive]}
                >
                  <Text style={styles.chipText}>{bps / 100}%</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {quote !== null ? (
            <Card style={styles.quote}>
              <QuoteRow
                label="Rate"
                value={`1 ${quote.sellToken.symbol} ≈ ${quote.rate.toLocaleString('en-US', {
                  maximumFractionDigits: 6,
                })} ${quote.buyToken.symbol}`}
              />
              <QuoteRow
                label="Minimum received"
                value={`${minOut} ${quote.buyToken.symbol}`}
              />
              <QuoteRow
                label="Worst case"
                value={`−${slippagePercent(quote).toFixed(2)}% vs quote`}
              />
              <Text style={styles.quoteNote}>
                Only the minimum is guaranteed. Anything better is the route doing well, not a
                promise.
              </Text>
            </Card>
          ) : null}

          {error !== null ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.busyText}>
              {stage === 'approving'
                ? 'Waiting for the approval to confirm…'
                : stage === 'swapping'
                  ? 'Sending the swap…'
                  : 'Pricing…'}
            </Text>
          </View>
        ) : quote !== null && needsApproval(quote) ? (
          <Button
            label={`Approve ${quote.sellToken.symbol}`}
            onPress={handleApprove}
          />
        ) : quote !== null ? (
          <Button label="Swap" onPress={handleSwap} />
        ) : (
          <Button
            label="Get quote"
            disabled={blocked || amount.trim() === '' || sellToken === null || buyToken === null}
            onPress={handleQuote}
          />
        )}
      </View>

      <TokenPicker
        visible={picking !== null}
        tokens={tokens}
        onClose={() => setPicking(null)}
        onSelect={(token) => {
          if (picking === 'sell') setSellToken(token);
          else setBuyToken(token);
          setPicking(null);
          invalidate();
        }}
      />
    </ScreenBackground>
  );
}

function TokenCard({
  direction,
  token,
  amount,
  editable,
  onAmountChange,
  onPick,
}: {
  direction: string;
  token: Token | null;
  amount: string;
  editable: boolean;
  onAmountChange?: (text: string) => void;
  onPick: () => void;
}) {
  return (
    <Card style={styles.swapCard}>
      <Text style={styles.direction}>{direction}</Text>
      <View style={styles.swapRow}>
        {editable ? (
          <TextField
            value={amount}
            onChangeText={onAmountChange}
            placeholder="0.0"
            keyboardType="decimal-pad"
            style={styles.amountInput}
          />
        ) : (
          <Text style={styles.amount}>{amount === '' ? '0.0' : amount}</Text>
        )}

        <Pressable accessibilityRole="button" onPress={onPick} style={styles.selector}>
          <CoinIcon symbol={token?.symbol ?? '?'} size={28} />
          <Text style={styles.selectorLabel}>{token?.symbol ?? 'Select'}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.text} />
        </Pressable>
      </View>
    </Card>
  );
}

function TokenPicker({
  visible,
  tokens,
  onClose,
  onSelect,
}: {
  visible: boolean;
  tokens: Token[];
  onClose: () => void;
  onSelect: (token: Token) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Select a token</Text>
          {tokens.length === 0 ? (
            <Text style={styles.noticeText}>No swappable tokens on this network.</Text>
          ) : (
            tokens.map((token) => (
              <Pressable
                key={token.address}
                accessibilityRole="button"
                onPress={() => onSelect(token)}
                style={({ pressed }) => [styles.tokenRow, pressed && styles.tokenRowPressed]}
              >
                <CoinIcon symbol={token.symbol} size={32} />
                <View style={styles.tokenText}>
                  <Text style={styles.selectorLabel}>{token.symbol}</Text>
                  <Text style={styles.tokenName}>{token.name}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.quoteRow}>
      <Text style={styles.quoteLabel}>{label}</Text>
      <Text style={styles.quoteValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: spacing.md, paddingBottom: spacing.xxl },
  swapCard: { gap: spacing.md, padding: spacing.xl },
  direction: { ...typography.bodySmall, color: colors.textMuted },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  amount: { ...typography.headline, color: colors.text, opacity: 0.55 },
  amountInput: { ...typography.headline, minWidth: 120 },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePressed,
  },
  selectorLabel: { ...typography.bodySmall, color: colors.text },
  flipRow: { alignItems: 'center', marginVertical: -spacing.xs },
  flip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slippage: { gap: spacing.sm, marginTop: spacing.sm },
  slippageLabel: { ...typography.bodySmall, color: colors.textMuted },
  slippageOptions: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.gradient[0], backgroundColor: colors.surfacePressed },
  chipText: { ...typography.bodySmall, color: colors.text },
  quote: { gap: spacing.md, padding: spacing.lg },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  quoteLabel: { ...typography.bodySmall, color: colors.textMuted },
  quoteValue: { ...typography.bodySmall, color: colors.text, flexShrink: 1, textAlign: 'right' },
  quoteNote: { ...typography.caption, color: colors.warning },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  noticeText: { ...typography.bodySmall, flex: 1, color: colors.textMuted },
  error: { ...typography.bodySmall, color: colors.negative },
  footer: { paddingVertical: spacing.xl },
  busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  busyText: { ...typography.bodySmall, color: colors.textMuted },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  doneTitle: { ...typography.headline, color: colors.text, textAlign: 'center' },
  doneBody: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    gap: spacing.md,
    padding: spacing.xl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.backgroundElevated,
  },
  sheetTitle: { ...typography.title, color: colors.text },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  tokenRowPressed: { backgroundColor: colors.surfacePressed },
  tokenText: { gap: 2 },
  tokenName: { ...typography.caption, color: colors.textMuted },
});
