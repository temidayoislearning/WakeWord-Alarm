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
    text: '#18221F',
    tint: '#E66B4E',
    background: '#F7F4EE',
    foreground: '#18221F',
    card: '#FFFEFB',
    cardForeground: '#18221F',
    primary: '#E66B4E',
    primaryForeground: '#FFF9F2',
    secondary: '#EEEAE1',
    secondaryForeground: '#26332F',
    muted: '#EEEAE1',
    mutedForeground: '#818781',
    accent: '#F8E5DB',
    accentForeground: '#A64431',
    destructive: '#C54D42',
    destructiveForeground: '#FFFFFF',
    border: '#E8E3D9',
    input: '#E8E3D9',
    success: '#6D967B',
    clockFace: '#192723',
    clockText: '#FFF9F0',
    clockMuted: '#A6B4AC',
    clockIconBg: '#2A3A34',
    ringBackground: '#14211E',
    ringSurface: '#1E302B',
    ringText: '#FFF9F0',
    ringMuted: '#A5B5AC',
    ringOutline: '#3A4E46',
  },
  dark: {
    text: '#F6F1E8',
    tint: '#F1785C',
    background: '#101916',
    foreground: '#F6F1E8',
    card: '#19231F',
    cardForeground: '#F6F1E8',
    primary: '#F1785C',
    primaryForeground: '#1D2520',
    secondary: '#202A25',
    secondaryForeground: '#E8E2D8',
    muted: '#202A25',
    mutedForeground: '#9AA59D',
    accent: '#382923',
    accentForeground: '#FFD0B8',
    destructive: '#F07064',
    destructiveForeground: '#1D2520',
    border: '#2B3730',
    input: '#2B3730',
    success: '#87B795',
    clockFace: '#192723',
    clockText: '#FFF9F0',
    clockMuted: '#A6B4AC',
    clockIconBg: '#2A3A34',
    ringBackground: '#101916',
    ringSurface: '#1E302B',
    ringText: '#FFF9F0',
    ringMuted: '#A5B5AC',
    ringOutline: '#3A4E46',
  },
  radius: 8,
};

export default colors;
