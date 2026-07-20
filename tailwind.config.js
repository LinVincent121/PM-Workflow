/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#FBFAF7',
          warm: '#F5F0EA',
          cool: '#F2F4F5',
        },
        ink: {
          DEFAULT: '#1C1D1F',
          muted: '#6B6D70',
          faint: '#A8AAAD',
        },
        accent: {
          DEFAULT: '#C0613B',
          light: '#E07B51',
          deep: '#8B3D20',
        },
      },
      fontFamily: {
        display: ['"Newsreader"', '"Noto Serif SC"', 'Georgia', 'serif'],
        body: ['"Geist"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        'title': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'body': ['1rem', { lineHeight: '1.65' }],
        'small': ['0.875rem', { lineHeight: '1.5' }],
        'label': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        card: '10px',
        button: '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
        'card-hover': '0 1px 3px rgba(0,0,0,0.04), 0 16px 40px rgba(0,0,0,0.08)',
        dialog: '0 0 0 1px rgba(0,0,0,0.04), 0 24px 64px rgba(0,0,0,0.12)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
};
