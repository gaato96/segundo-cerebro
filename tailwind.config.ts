import type { Config } from "tailwindcss";

/*
 * Paleta del design system (docs/stitch/DESIGN.md): grafito + un solo ámbar.
 * Los nombres viejos (indigo, violet, emerald…) apuntan a las familias nuevas,
 * así toda la app cambia de tema sin tocar cada pantalla, y cada familia se
 * invierte sola en el tema claro "Paper" (variables en globals.css).
 */
const graphite = { 50: "hsl(var(--graphite-50) / <alpha-value>)", 100: "hsl(var(--graphite-100) / <alpha-value>)", 200: "hsl(var(--graphite-200) / <alpha-value>)", 300: "hsl(var(--graphite-300) / <alpha-value>)", 400: "hsl(var(--graphite-400) / <alpha-value>)", 500: "hsl(var(--graphite-500) / <alpha-value>)", 600: "hsl(var(--graphite-600) / <alpha-value>)", 700: "hsl(var(--graphite-700) / <alpha-value>)", 800: "hsl(var(--graphite-800) / <alpha-value>)", 900: "hsl(var(--graphite-900) / <alpha-value>)", 950: "hsl(var(--graphite-950) / <alpha-value>)" }
const sage = { 50: "hsl(var(--sage-50) / <alpha-value>)", 100: "hsl(var(--sage-100) / <alpha-value>)", 200: "hsl(var(--sage-200) / <alpha-value>)", 300: "hsl(var(--sage-300) / <alpha-value>)", 400: "hsl(var(--sage-400) / <alpha-value>)", 500: "hsl(var(--sage-500) / <alpha-value>)", 600: "hsl(var(--sage-600) / <alpha-value>)", 700: "hsl(var(--sage-700) / <alpha-value>)", 800: "hsl(var(--sage-800) / <alpha-value>)", 900: "hsl(var(--sage-900) / <alpha-value>)", 950: "hsl(var(--sage-950) / <alpha-value>)" }
const clay = { 50: "hsl(var(--clay-50) / <alpha-value>)", 100: "hsl(var(--clay-100) / <alpha-value>)", 200: "hsl(var(--clay-200) / <alpha-value>)", 300: "hsl(var(--clay-300) / <alpha-value>)", 400: "hsl(var(--clay-400) / <alpha-value>)", 500: "hsl(var(--clay-500) / <alpha-value>)", 600: "hsl(var(--clay-600) / <alpha-value>)", 700: "hsl(var(--clay-700) / <alpha-value>)", 800: "hsl(var(--clay-800) / <alpha-value>)", 900: "hsl(var(--clay-900) / <alpha-value>)", 950: "hsl(var(--clay-950) / <alpha-value>)" }
const slateblue = { 50: "hsl(var(--slateblue-50) / <alpha-value>)", 100: "hsl(var(--slateblue-100) / <alpha-value>)", 200: "hsl(var(--slateblue-200) / <alpha-value>)", 300: "hsl(var(--slateblue-300) / <alpha-value>)", 400: "hsl(var(--slateblue-400) / <alpha-value>)", 500: "hsl(var(--slateblue-500) / <alpha-value>)", 600: "hsl(var(--slateblue-600) / <alpha-value>)", 700: "hsl(var(--slateblue-700) / <alpha-value>)", 800: "hsl(var(--slateblue-800) / <alpha-value>)", 900: "hsl(var(--slateblue-900) / <alpha-value>)", 950: "hsl(var(--slateblue-950) / <alpha-value>)" }
const lamp = { 50: "hsl(var(--lamp-50) / <alpha-value>)", 100: "hsl(var(--lamp-100) / <alpha-value>)", 200: "hsl(var(--lamp-200) / <alpha-value>)", 300: "hsl(var(--lamp-300) / <alpha-value>)", 400: "hsl(var(--lamp-400) / <alpha-value>)", 500: "hsl(var(--lamp-500) / <alpha-value>)", 600: "hsl(var(--lamp-600) / <alpha-value>)", 700: "hsl(var(--lamp-700) / <alpha-value>)", 800: "hsl(var(--lamp-800) / <alpha-value>)", 900: "hsl(var(--lamp-900) / <alpha-value>)", 950: "hsl(var(--lamp-950) / <alpha-value>)" }

const config: Config = {
    darkMode: ["class"],
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-geist)", "ui-sans-serif", "system-ui"],
                heading: ["var(--font-geist)", "ui-sans-serif", "system-ui"],
                mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
            },
            colors: {
                white: "hsl(var(--white) / <alpha-value>)",
                black: "hsl(var(--black) / <alpha-value>)",
                graphite,
                indigo: graphite,
                violet: graphite,
                purple: graphite,
                pink: graphite,
                fuchsia: graphite,
                sage,
                emerald: sage,
                green: sage,
                teal: sage,
                lime: sage,
                clay,
                red: clay,
                rose: clay,
                slateblue,
                sky: slateblue,
                blue: slateblue,
                cyan: slateblue,
                lamp,
                amber: lamp,
                yellow: lamp,
                orange: lamp,
                ink: {
                    DEFAULT: "hsl(var(--foreground) / <alpha-value>)",
                    muted: "hsl(var(--muted-foreground) / <alpha-value>)",
                    faint: "hsl(var(--faint) / <alpha-value>)",
                },
                surface: {
                    DEFAULT: "hsl(var(--card) / <alpha-value>)",
                    raised: "hsl(var(--raised) / <alpha-value>)",
                },
                hairline: "hsl(var(--hairline))",
                background: "hsl(var(--background) / <alpha-value>)",
                foreground: "hsl(var(--foreground) / <alpha-value>)",
                card: {
                    DEFAULT: "hsl(var(--card) / <alpha-value>)",
                    foreground: "hsl(var(--card-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover) / <alpha-value>)",
                    foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary) / <alpha-value>)",
                    foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
                    foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted) / <alpha-value>)",
                    foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent) / <alpha-value>)",
                    foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
                    foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
                },
                border: "hsl(var(--border) / <alpha-value>)",
                input: "hsl(var(--input) / <alpha-value>)",
                ring: "hsl(var(--ring) / <alpha-value>)",
                priority: {
                    high: "#D9735F",
                    medium: "#E0A54B",
                    low: "#7C9CBF",
                },
                success: "#6FAE8C",
                sidebar: {
                    DEFAULT: "hsl(var(--sidebar-background))",
                    foreground: "hsl(var(--sidebar-foreground))",
                    accent: "hsl(var(--sidebar-accent))",
                    "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
                    border: "hsl(var(--sidebar-border))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in": {
                    from: { opacity: "0", transform: "translateY(6px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "slide-down": {
                    from: { opacity: "0", transform: "translateY(-8px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "slide-up": {
                    from: { opacity: "0", transform: "translateY(8px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                shimmer: {
                    "0%": { backgroundPosition: "-1000px 0" },
                    "100%": { backgroundPosition: "1000px 0" },
                },
                glow: {
                    "0%, 100%": { opacity: "0.6" },
                    "50%": { opacity: "1" },
                },
                breathe: {
                    "0%, 100%": { opacity: "0.55" },
                    "50%": { opacity: "1" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                "slide-down": "slide-down 0.25s ease-out",
                "slide-up": "slide-up 0.25s ease-out",
                shimmer: "shimmer 2s linear infinite",
                glow: "glow 4s ease-in-out infinite",
                breathe: "breathe 4s ease-in-out infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};

export default config;
