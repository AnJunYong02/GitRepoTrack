import type { Config } from "tailwindcss";

// globals.css의 RGB 채널 변수를 Tailwind 색으로 쓰기 위한 헬퍼 (bg-surface/50 같은 투명도 지원)
const channel = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: channel("surface"),
          raised: channel("surface-raised"),
        },
        ink: channel("ink"),
        muted: channel("muted"),
        accent: channel("accent"),
        // 학생 화면 플랫 디자인
        canvas: channel("canvas"),
        chip: channel("chip"),
        line: channel("line"),
        fg: {
          DEFAULT: channel("fg"),
          2: channel("fg2"),
          3: channel("fg3"),
        },
        brand: {
          DEFAULT: channel("brand"),
          soft: channel("brand-soft"),
        },
        danger: {
          DEFAULT: channel("danger"),
          soft: channel("danger-soft"),
        },
        chart: channel("chart"),
        // 기본 팔레트 violet과 겹치지 않게 별도 이름 사용
        lilac: {
          DEFAULT: channel("violet"),
          ink: channel("violet-ink"),
        },
      },
      fontFamily: {
        display: [
          '"Pretendard Variable"',
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      boxShadow: {
        // 튀어나온 카드: 왼쪽 위 밝은 빛 + 오른쪽 아래 그림자
        neu: "10px 10px 24px rgb(var(--neu-dark) / 0.45), -10px -10px 24px rgb(var(--neu-light) / 0.85)",
        "neu-sm":
          "4px 4px 10px rgb(var(--neu-dark) / 0.4), -4px -4px 10px rgb(var(--neu-light) / 0.85)",
        // 들어간 영역: 숫자 타일·입력창·강조 박스
        "neu-inset":
          "inset 4px 4px 10px rgb(var(--neu-dark) / 0.35), inset -4px -4px 10px rgb(var(--neu-light) / 0.8)",
      },
    },
  },
  plugins: [],
} satisfies Config;
