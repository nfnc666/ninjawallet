import React from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, ScreenBackground, ScreenHeader } from '@/components';
import { useNfts } from '@/wallet/useNfts';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 249:2656 ("nft gallery") — a grid of the collectibles this address
 * holds, read from the same keyless explorer API as the transaction history.
 */
export default function NftGallery() {
  const { network, addresses } = useWallet();
  const { items, loading, error, refresh } = useNfts(network, addresses?.evm ?? null);

  return (
    <ScreenBackground>
      <ScreenHeader title="NFT gallery" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.text} />
        }
      >
        {error !== null ? (
          <Card style={styles.notice}>
            <Text style={styles.noticeText}>{error}</Text>
            <Button label="Try again" variant="ghost" onPress={refresh} />
          </Card>
        ) : loading && items.length === 0 ? (
          <ActivityIndicator color={colors.text} style={styles.spinner} />
        ) : items.length === 0 ? (
          <Card style={styles.notice}>
            <Ionicons name="images-outline" size={22} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              No NFTs on {network.name} for this address. Anything sent here will show up.
            </Text>
          </Card>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.collection}`}
                onPress={() =>
                  Linking.openURL(network.explorerAddressUrl(item.id.split(':')[0] as string))
                }
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              >
                {item.imageUrl !== null ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.image}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={[styles.image, styles.imageFallback]}>
                    <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.tileText}>
                  <Text style={styles.tileName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.tileCollection} numberOfLines={1}>
                    {item.collection}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.disclaimer}>
          Names and images come from each contract&apos;s own metadata, which its deployer controls.
          Treat an unexpected NFT as spam: opening links from one is how wallet-drainer scams
          start.
        </Text>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  spinner: { marginTop: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '47.5%',
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  tilePressed: { backgroundColor: colors.surfacePressed },
  image: { width: '100%', aspectRatio: 1, backgroundColor: colors.backgroundElevated },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  tileText: { padding: spacing.md, gap: 2 },
  tileName: { ...typography.bodySmall, color: colors.text },
  tileCollection: { ...typography.caption, color: colors.textMuted },
  notice: { gap: spacing.md, padding: spacing.lg, alignItems: 'flex-start' },
  noticeText: { ...typography.bodySmall, color: colors.textMuted },
  disclaimer: { ...typography.caption, color: colors.textMuted },
});
