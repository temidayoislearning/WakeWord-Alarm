/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#211B32',
    tint: '#6C3FCB',
    background: '#F8F6FD',
    foreground: '#211B32',
    card: '#FFFFFF',
    cardForeground: '#211B32',
    primary: '#6C3FCB',
    primaryForeground: '#FFFFFF',
    secondary: '#F0EDF8',
    secondaryForeground: '#302840',
    muted: '#F0EDF8',
    mutedForeground: '#716A7D',
    accent: '#EDE5FF',
    accentForeground: '#50259F',
    destructive: '#C54D42',
    destructiveForeground: '#FFFFFF',
    border: '#E3DEF0',
    input: '#E3DEF0',
    success: '#2C936F',
    clockFace: '#282047',
    clockText: '#FFFFFF',
    clockMuted: '#C9C0E4',
    clockIconBg: '#453668',
    ringBackground: '#18132D',
    ringSurface: '#30274C',
    ringText: '#FFFFFF',
    ringMuted: '#C9C0E4',
    ringOutline: '#594B78',
  },
  dark: {
    text: '#FAF7FF',
    tint: '#C8B4FF',
    background: '#151127',
    foreground: '#FAF7FF',
    card: '#241C3B',
    cardForeground: '#FAF7FF',
    primary: '#C8B4FF',
    primaryForeground: '#211538',
    secondary: '#2F2649',
    secondaryForeground: '#F2ECFF',
    muted: '#2F2649',
    mutedForeground: '#BDB3CF',
    accent: '#3D2F62',
    accentForeground: '#E9DCFF',
    destructive: '#F07064',
    destructiveForeground: '#211538',
    border: '#483B62',
    input: '#483B62',
    success: '#80DEBA',
    clockFace: '#282047',
    clockText: '#FFFFFF',
    clockMuted: '#C9C0E4',
    clockIconBg: '#453668',
    ringBackground: '#151127',
    ringSurface: '#30274C',
    ringText: '#FFFFFF',
    ringMuted: '#C9C0E4',
    ringOutline: '#594B78',
  },
  radius: 8,
};

export default colors;

