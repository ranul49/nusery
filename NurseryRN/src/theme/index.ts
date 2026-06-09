// src/theme/index.ts
// Design tokens — direct port of colors.xml / dimens.xml

export const COLORS = {
  background:      '#0F172A', // Slate 900
  surfaceCard:     '#1E293B', // Slate 800
  surfaceElevated: '#263348', // slightly lighter card
  divider:         '#334155', // Slate 700
  textPrimary:     '#F8FAFC', // Slate 50
  textSecondary:   '#94A3B8', // Slate 400
  textDisabled:    '#64748B', // Slate 500
  brandAccent:     '#2E75B6', // Blue brand
  statusNominal:   '#22C55E', // Green
  statusApproach:  '#F59E0B', // Amber
  statusBreach:    '#EF4444', // Red
  statusError:     '#9E9E9E', // Grey
};

export const FONTS = {
  heading:   { fontFamily: 'System', fontWeight: '700' as const },
  body:      { fontFamily: 'System', fontWeight: '400' as const },
  mono:      { fontFamily: 'monospace' },
  label:     { fontFamily: 'System', fontWeight: '500' as const },
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
