/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // High-Precision Developer Workspace Palette (Graphite & Dark Studio)
        graphite: {
          950: '#080A0E', // Ultra-deep terminal canvas
          900: '#0D1017', // Workspace main canvas
          850: '#131720', // Primary navigation rail & panels
          800: '#1A1F2C', // Contextual inspector & cards
          750: '#212738', // Elevated surfaces, modals, popovers
          700: '#2B3349', // High-contrast structural borders
          600: '#3D4866', // Subtle dividers
          500: '#5C6A8D', // Secondary text
          400: '#8A97B5', // Metadata text
          300: '#B8C2D8', // Body text (high readability)
          200: '#DDE4F0', // Headers & prominent labels
          100: '#F2F6FC', // Brightest foreground text
        },

        // Editorial Marketing Palette (Swiss / Lavender / Fine Linework)
        editorial: {
          canvas: '#F7F4EE',    // Soft linen canvas
          card: '#FFFFFF',      // Crisp paper surface
          lavender: '#F1ECF8',  // Soft lavender tint
          ink: '#0B0D13',       // Ultra-dense near-black
          muted: '#5F687A',     // Editorial body copy
          border: '#E3DDD3',    // Fine hairline rules
          divider: '#EBE5DC',   // Secondary hairline
        },

        // Security Status & Functional Accents
        brand: {
          crimson: '#F43F5E',   // Critical CWE severity (CWE-95)
          coral: '#FF5733',     // Dynamic alert accent
          violet: '#6366F1',    // AST Engine & Primary Action
          purple: '#8B5CF6',    // Rule signatures
          cyan: '#06B6D4',      // Timing-safe crypto verification
          emerald: '#10B981',   // Pass / Remediated
          amber: '#F59E0B',     // Warning / CWE-78
          fuchsia: '#D946EF',   // Experimental editorial
        },

        // Retained compatibility tokens for existing utility mappings
        coral: {
          DEFAULT: '#F43F5E',
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
          700: '#BE123C',
          800: '#9F1239',
          900: '#881337',
        },
        violet: {
          DEFAULT: '#6366F1',
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        warm: {
          50: '#FDFCFA',
          100: '#F7F4EE',
          200: '#EDE8DF',
          300: '#DFD8CC',
          400: '#CDC3B3',
        },
        ink: {
          DEFAULT: '#0B0D13',
          50: '#F8F9FA',
          100: '#E9ECEF',
          200: '#DEE2E6',
          300: '#CED4DA',
          400: '#8A97B5',
          500: '#5C6A8D',
          600: '#495057',
          700: '#343A40',
          800: '#212529',
          900: '#0B0D13',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#FAFAF8',
          border: '#E3DDD3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-2xl': ['clamp(3.5rem, 7vw, 6.5rem)', { lineHeight: '0.92', letterSpacing: '-0.04em', fontWeight: '900' }],
        'display-xl': ['clamp(2.75rem, 5.5vw, 4.75rem)', { lineHeight: '0.94', letterSpacing: '-0.035em', fontWeight: '900' }],
        'display-lg': ['clamp(2rem, 4vw, 3.25rem)', { lineHeight: '0.98', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display-md': ['clamp(1.5rem, 2.8vw, 2.25rem)', { lineHeight: '1.05', letterSpacing: '-0.025em', fontWeight: '800' }],
        'display-sm': ['clamp(1.15rem, 1.8vw, 1.5rem)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      boxShadow: {
        'graphite-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'graphite-md': '0 4px 12px 0 rgba(0, 0, 0, 0.5), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'graphite-lg': '0 12px 32px -4px rgba(0, 0, 0, 0.6), 0 4px 12px 0 rgba(0, 0, 0, 0.4)',
        'editorial': '0 1px 3px rgba(11,13,19,0.03), 0 12px 40px rgba(11,13,19,0.06)',
        'panel': '0 2px 8px rgba(11,13,19,0.04), 0 1px 2px rgba(11,13,19,0.04)',
        'float': '0 16px 48px rgba(0,0,0,0.3)',
        'deep': '0 24px 80px rgba(0,0,0,0.5)',
        'glow-crimson': '0 0 24px -4px rgba(244, 63, 94, 0.4)',
        'glow-violet': '0 0 24px -4px rgba(99, 102, 241, 0.4)',
        'glow-cyan': '0 0 24px -4px rgba(6, 182, 212, 0.4)',
      },
    },
  },
  plugins: [],
};
