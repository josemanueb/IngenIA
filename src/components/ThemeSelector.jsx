const THEMES = {
  midnight: {
    label: 'Medianoche',
    bgPrimary: '#0a0a0f',
    bgSecondary: '#111118',
    bgTertiary: '#1a1a24',
    bgHover: '#22222e',
    bgActive: '#2a2a38',
    textPrimary: '#e8e8ef',
    textSecondary: '#8888a0',
    textMuted: '#555566',
    border: '#2a2a38',
    accent: '#6366f1',
    accentHover: '#818cf8',
  },
  ocean: {
    label: 'Océano',
    bgPrimary: '#0b1120',
    bgSecondary: '#111827',
    bgTertiary: '#1e293b',
    bgHover: '#273548',
    bgActive: '#334155',
    textPrimary: '#e2e8f0',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    border: '#334155',
    accent: '#0ea5e9',
    accentHover: '#38bdf8',
  },
  forest: {
    label: 'Bosque',
    bgPrimary: '#0a120a',
    bgSecondary: '#111a11',
    bgTertiary: '#1a2e1a',
    bgHover: '#223b22',
    bgActive: '#2d4a2d',
    textPrimary: '#d4e8d4',
    textSecondary: '#8aad8a',
    textMuted: '#5a7a5a',
    border: '#2d4a2d',
    accent: '#22c55e',
    accentHover: '#4ade80',
  },
  sunset: {
    label: 'Atardecer',
    bgPrimary: '#1a0a0a',
    bgSecondary: '#221111',
    bgTertiary: '#2e1a1a',
    bgHover: '#3b2222',
    bgActive: '#4a2d2d',
    textPrimary: '#f0e2e2',
    textSecondary: '#a88a8a',
    textMuted: '#7a5a5a',
    border: '#4a2d2d',
    accent: '#f97316',
    accentHover: '#fb923c',
  },
  purple: {
    label: 'Púrpura',
    bgPrimary: '#0f0a1a',
    bgSecondary: '#181122',
    bgTertiary: '#241a33',
    bgHover: '#312244',
    bgActive: '#3d2d55',
    textPrimary: '#e8e2f0',
    textSecondary: '#a08ab8',
    textMuted: '#6a5580',
    border: '#3d2d55',
    accent: '#a855f7',
    accentHover: '#c084fc',
  },
  dracula: {
    label: 'Dracula',
    bgPrimary: '#282a36',
    bgSecondary: '#2d2f3d',
    bgTertiary: '#383a4a',
    bgHover: '#44465a',
    bgActive: '#525470',
    textPrimary: '#f8f8f2',
    textSecondary: '#bfbfbf',
    textMuted: '#6272a4',
    border: '#44475a',
    accent: '#bd93f9',
    accentHover: '#d4adff',
  },
}

export default function ThemeSelector({ currentTheme, onThemeChange }) {
  return (
    <div className="theme-selector">
      <h3 className="theme-title">🎨 Tema</h3>
      <div className="theme-grid">
        {Object.entries(THEMES).map(([key, theme]) => (
          <button
            key={key}
            className={`theme-swatch ${currentTheme === key ? 'active' : ''}`}
            onClick={() => onThemeChange(key)}
            title={theme.label}
          >
            <div className="swatch-preview">
              <div className="swatch-bg" style={{ background: theme.bgPrimary }} />
              <div className="swatch-accent" style={{ background: theme.accent }} />
            </div>
            <span className="swatch-label">{theme.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export { THEMES }
