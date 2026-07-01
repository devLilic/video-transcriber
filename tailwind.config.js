/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          950: '#07090d',
          900: '#0b1018',
          850: '#101722',
          800: '#151f2c',
          750: '#1a2635',
          700: '#223044',
          600: '#304158',
        },
        signal: {
          cyan: '#56d8ff',
          cyanMuted: '#1f8cab',
          amber: '#f5bd55',
          coral: '#ff6b6f',
          green: '#5dd6a0',
          violet: '#9b8cff',
        },
        editorial: {
          text: '#edf5ff',
          muted: '#93a1b6',
          subtle: '#637188',
          line: '#263449',
        },
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        monitor: '0 24px 70px rgba(0, 0, 0, 0.42), inset 0 0 0 1px rgba(86, 216, 255, 0.08)',
        panel: '0 18px 46px rgba(0, 0, 0, 0.28)',
        popup: '0 18px 44px rgba(0, 0, 0, 0.48)',
      },
      borderRadius: {
        studio: '16px',
        monitor: '20px',
        control: '12px',
      },
      keyframes: {
        transcriptIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        progressPulse: {
          '0%, 100%': { opacity: '0.74' },
          '50%': { opacity: '1' },
        },
        recordingSignal: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(86, 216, 255, 0.32)' },
          '50%': { boxShadow: '0 0 0 6px rgba(86, 216, 255, 0)' },
        },
      },
      animation: {
        transcriptIn: 'transcriptIn 180ms ease-out',
        progressPulse: 'progressPulse 900ms ease-in-out infinite',
        recordingSignal: 'recordingSignal 1100ms ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
