/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Quantum Precision White Palette
        qarctic: '#F5F8FC',      // Main background
        qpure: '#FFFFFF',        // Cards / surfaces
        qblue: {
          DEFAULT: '#2563EB',   // Primary actions (Scientific Blue)
          hover: '#1D4ED8',
          active: '#1E40AF',
          subtle: '#EFF6FF',
          border: '#BFDBFE',
        },
        qteal: {
          DEFAULT: '#0D9488',   // Secondary accents (Quantum Teal)
          hover: '#0F766E',
          subtle: '#F0FDFA',
          border: '#99F6E4',
        },
        qviolet: {
          DEFAULT: '#7C3AED',  // Selective accent (Quantum Violet)
          hover: '#6D28D9',
          subtle: '#F5F3FF',
          border: '#DDD6FE',
        },
        qnavy: {
          DEFAULT: '#172B4D',   // Primary text (Deep Navy)
          muted: '#243B5A',
          subtle: '#334E68',
        },
        qslate: {
          DEFAULT: '#64748B',   // Secondary text (Slate Grey)
          light: '#94A3B8',
          dark: '#475569',
        },
        qborder: {
          DEFAULT: '#DCE5F0',   // Borders / dividers (Soft Blue-Grey)
          subtle: '#EBF1F7',
          strong: '#CBD5E1',
        },
        // Status tokens
        qgreen: {
          DEFAULT: '#16A34A',   // Healthy status (Emerald Green)
          subtle: '#DEFBE6',
          border: '#BBF7D0',
          text: '#0E6027',
        },
        qamber: {
          DEFAULT: '#D97706',   // Warning status (Amber)
          subtle: '#FCF4D6',
          border: '#FDE68A',
          text: '#8E6A00',
        },
        qred: {
          DEFAULT: '#DC2626',   // Critical status (Signal Red)
          subtle: '#FFD7D9',
          border: '#FECACA',
          text: '#750E13',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        xs: '1px',
        sm: '2px',
        md: '3px',
      },
      boxShadow: {
        'carbon-sm': '0 1px 2px 0 rgba(23, 43, 77, 0.05)',
        'carbon-md': '0 2px 4px 0 rgba(23, 43, 77, 0.08)',
        'carbon-lg': '0 4px 12px 0 rgba(23, 43, 77, 0.12)',
        'carbon-none': 'none',
      }
    },
  },
  plugins: [],
}
