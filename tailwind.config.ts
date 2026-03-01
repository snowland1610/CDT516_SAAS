import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // 设计基线：Notion + Linear 风格，主色仅作强调，全站统一复用
      colors: {
        primary: {
          DEFAULT: '#4f46e5', // indigo-600
          hover: '#4338ca',    // indigo-700
          light: '#e0e7ff',   // indigo-100，用于浅底强调
        },
      },
      borderRadius: {
        card: '0.5rem',   // 8px，与 rounded-lg 一致，卡片/按钮/输入框统一
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}
export default config
