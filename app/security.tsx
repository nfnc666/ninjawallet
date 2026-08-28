import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';

import { Button, Card, ScreenBackground, ScreenHeader, TextField } from '@/components';
import { unlockWallet, WrongPasscodeError } from '@/wallet/keystore';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 249:3169 ("security") — the gradient backup card over toggle rows.
 *
 * Two of the design's toggles do not survive contact with this build, and
 * pretending otherwise would be worse than changing them:
 *
 * - "Secure with Passcode" is a switch in the design. Here a passcode is not
 *   optional: it is the key that encrypts the phrase, so there is nothing to
 *   turn off. It is shown as a fact, not a control.
 * - "Legacy Address" toggles a Bitcoin address format this build does not
 *   derive. Rather than a dead switch, the row says what it would do.
 *
 * The biometric row is a real toggle, because that one genuinely is optional.
 */
export default function Security() {
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnrolled, setBiometricsEnrolled] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [phrase, setPhrase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [hardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (cancelled) return;
      setBiometricsAvailable(hardware);
      setBiometricsEnrolled(enrolled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reveal = async () => {
    setError(null);
    try {
      const { phrase: recovered } = await unlockWallet(passcode);
      setPhrase(recovered);
      setPasscode('');
    } catch (caught) {
      setError(
        caught instanceof WrongPasscodeError ? 'Wrong passcode.' : 'Could not read the wallet.',
      );
    }
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Security" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setRevealOpen((value) => !value);
            setPhrase(null);
            setError(null);
          }}
        >
          <LinearGradient
            colors={colors.gradientHero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backupCard}
          >
            <View style={styles.backupHead}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.text} />
              <Text style={styles.backupTitle}>Backup</Text>
              <Ionicons
                name={revealOpen ? 'chevron-up' : 'chevron-forward'}
                size={20}
                color={colors.text}
              />
            </View>
            <Text style={styles.backupBody}>
              Your 12-word recovery phrase is the only way back into this wallet. Nobody — not us,
              not anyone — can restore it for you.
            </Text>
          </LinearGradient>
        </Pressable>

        {revealOpen ? (
          <Card style={styles.reveal}>
            {phrase === null ? (
              <>
                <TextField
                  value={passcode}
                  onChangeText={setPasscode}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="Passcode"
                  icon="lock-closed-outline"
                  error={error ?? undefined}
                />
                <Button
                  label="Show phrase"
                  variant="ghost"
                  disabled={passcode.length === 0}
                  onPress={reveal}
                />
              </>
            ) : (
              <>
                <Text style={styles.phrase} selectable>
                  {phrase}
                </Text>
                <Text style={styles.phraseWarning}>
                  Anyone who reads this owns your funds. Close it when you are done.
                </Text>
                <Button label="Hide" variant="ghost" onPress={() => setPhrase(null)} />
              </>
            )}
          </Card>
        ) : null}

        <FactRow
          icon="lock-closed"
          title="Secured with a passcode"
          body="Always on. Your passcode is the key that encrypts the recovery phrase on this device — there is nothing to switch off."
          state="on"
        />

        <ToggleRow
          icon="finger-print"
          title="Require Face ID / fingerprint"
          body={
            !biometricsAvailable
              ? 'This device has no biometric sensor.'
              : !biometricsEnrolled
                ? 'Set up Face ID or a fingerprint in system settings first.'
                : 'Set when the wallet was created. To change it, erase the wallet and restore from your phrase.'
          }
          value={biometricsAvailable && biometricsEnrolled}
          disabled
        />

        <FactRow
          icon="git-branch"
          title="Legacy Bitcoin address"
          body="Not derived by this build. Your Bitcoin address is native SegWit (BIP-84, bc1…), which every current wallet and exchange accepts."
          state="off"
        />

        <Card style={styles.notice}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <Text style={styles.noticeText}>
            The wallet locks itself two minutes after you leave it, and the phrase is dropped from
            memory when it does.
          </Text>
        </Card>

        <Button
          label="Lock now"
          variant="ghost"
          onPress={() => router.replace('/(onboarding)/unlock')}
        />
      </ScrollView>
    </ScreenBackground>
  );
}

function FactRow({
  icon,
  title,
  body,
  state,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  state: 'on' | 'off';
}) {
  return (
    <Card style={styles.row}>
      <View style={styles.rowHead}>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
        <Text style={styles.rowTitle}>{title}</Text>
        <Ionicons
          name={state === 'on' ? 'checkmark-circle' : 'remove-circle-outline'}
          size={20}
          color={state === 'on' ? colors.positive : colors.textMuted}
        />
      </View>
      <Text style={styles.rowBody}>{body}</Text>
    </Card>
  );
}

function ToggleRow({
  icon,
  title,
  body,
  value,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  value: boolean;
  disabled?: boolean;
}) {
  return (
    <Card style={styles.row}>
      <View style={styles.rowHead}>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
        <Text style={styles.rowTitle}>{title}</Text>
        <Switch
          value={value}
          disabled={disabled}
          trackColor={{ true: colors.gradient[0], false: colors.border }}
          thumbColor={colors.text}
        />
      </View>
      <Text style={styles.rowBody}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingBottom: spacing.xxxl },
  backupCard: { gap: spacing.md, padding: spacing.xl, borderRadius: radius.sheet },
  backupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backupTitle: { ...typography.body, color: colors.text, flex: 1 },
  backupBody: { ...typography.bodySmall, color: colors.text, opacity: 0.92 },
  reveal: { gap: spacing.lg, padding: spacing.lg },
  phrase: { ...typography.body, color: colors.text, lineHeight: 26 },
  phraseWarning: { ...typography.caption, color: colors.warning },
  row: { gap: spacing.sm, padding: spacing.lg },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTitle: { ...typography.body, color: colors.text, flex: 1 },
  rowBody: { ...typography.bodySmall, color: colors.textMuted },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  noticeText: { ...typography.bodySmall, flex: 1, color: colors.textMuted },
});
