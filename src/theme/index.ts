/**
 * Design tokens taken from the Ninja Wallet Figma file
 * (YNkaMjKBBi046LgXOj3VIJ, section "orange-2.0 Update 8-29-2024").
 *
 * Values marked `figma:` were read verbatim out of the design; the rest are
 * derived so the scale stays consistent across screens the design does not
 * specify.
 */

export const colors = {
  /** Page background — deep aubergine behind every screen. */
  background: '#190E23',
  /** Slightly lifted background used by sheets and the tab bar. */
  backgroundElevated: '#221430',

  /** figma: card / list-row fill, rgba(189,189,189,0.1) */
  surface: 'rgba(189, 189, 189, 0.10)',
  /** Pressed state for a surface. */
  surfacePressed: 'rgba(189, 189, 189, 0.18)',
  /** Hairline border used on inputs and outlined buttons. */
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.40)',

  /** figma: primary text */
  text: '#FFFFFF',
  /** figma: secondary text on list rows */
  textMuted: '#8A8F9E',
  /** Text on top of a light (white) surface. */
  textInverse: '#101010',

  /** figma: positive change indicator */
  positive: '#00C7BE',
  /** figma: negative change indicator */
  negative: '#FF453A',
  warning: '#FFB020',

  /** Brand gradient — violet to orange, used on primary buttons and heroes. */
  gradient: ['#B02FCB', '#F07A24'] as const,
  /** Hero gradient on welcome / balance cards, a touch more magenta. */
  gradientHero: ['#8B2BD9', '#D93C86', '#F0894A'] as const,

  /** Overlay used by the glass button on the welcome screen. */
  glass: 'rgba(255, 255, 255, 0.10)',

  transparent: 'transparent',
} as const;

/**
 * figma: Inter, weights Medium (500) and Bold (700).
 * Line heights and tracking come from the file's M3 text variables.
 */
export const typography = {
  displayLarge: { fontSize: 36, lineHeight: 44, fontWeight: '700' },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  /** figma: Body Medium — 16/20, tracking 0.25 */
  body: { fontSize: 16, lineHeight: 20, letterSpacing: 0.25, fontWeight: '500' },
  bodySmall: { fontSize: 14, lineHeight: 20, letterSpacing: 0.25, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: '500' },
  /** Balances and amounts — tabular so digits do not jump while updating. */
  mono: { fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
} as const;

/** 4pt scale; `md` (10) matches the padding of the Figma coin row. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  /** figma: coin row / card corner radius */
  card: 10,
  input: 12,
  sheet: 24,
  /** figma: buttons are fully rounded (border-radius 100) */
  pill: 100,
} as const;

/** figma: screen body inset is 20px on every core screen. */
export const layout = {
  screenPadding: spacing.xl,
  rowHeight: 62,
  iconSize: 40,
  buttonHeight: 62,
} as const;

export const theme = { colors, typography, spacing, radius, layout } as const;
export type Theme = typeof theme;
