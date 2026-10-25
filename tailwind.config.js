/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#05050a',
        cyan: '#00f0ff',
        neon: '#00ff88',
        purple: '#b026ff',
        crimson: '#ff0055',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'hud-in': 'hudIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fly-bar': 'flyBar 1.8s ease-in-out infinite',
      },
      keyframes: {
        hudIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        flyBar: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
      },
    },
  },
  plugins: [],
}
