# Theme Kit

Theme Kit 是从 Cotris 1.6 抽取出来的纯静态主题系统。它不依赖框架，不需要构建工具，适合 HTML 报告、HTML PPT、后台工具、小型 Web App 和静态小游戏。

## 目录结构

```text
theme-kit/
  theme.js
  page-theme.js
  theme.css
  theme-preview.html
  README.md
```

## 快速接入

把 `theme-kit/` 复制到目标项目，然后在页面中引入：

```html
<link rel="stylesheet" href="./theme-kit/theme.css">
<script type="module" src="./theme-kit/page-theme.js"></script>
```

页面样式使用 CSS 变量：

```css
body {
  color: var(--text);
  background: var(--bg);
}

.card {
  background: var(--panel);
  border: 1px solid var(--line);
}

.primary-action {
  background: var(--accent);
}
```

## 通过 URL 预览主题

```text
index.html?theme=githubDark
index.html?theme=macaron
index.html?theme=solarizedDark
```

`page-theme.js` 会优先读取 URL 参数 `theme`，其次读取 `localStorage`，最后使用默认主题。

## 存储键

默认本地存储键是：

```text
theme-kit-theme
```

如果某个系统想使用自己的存储键，可以在 HTML 上声明：

```html
<html lang="zh-CN" data-theme-storage-key="report-theme">
```

## JS API

```js
import { applyCssTheme, defaultTheme, getTheme, listThemes } from "./theme-kit/theme.js";

const theme = getTheme("githubDark");
applyCssTheme(theme);

console.log(defaultTheme.id);
console.log(listThemes());
```

页面自动主题：

```js
import { applyPageTheme } from "./theme-kit/page-theme.js";

const theme = applyPageTheme({
  storageKey: "report-theme"
});
```

## 下拉选择主题

```html
<select id="themeSelect"></select>
```

```js
import { applyCssTheme, getTheme, listThemes } from "./theme-kit/theme.js";

const select = document.querySelector("#themeSelect");
const storageKey = "report-theme";

listThemes().forEach(theme => {
  const option = document.createElement("option");
  option.value = theme.id;
  option.textContent = theme.name;
  select.append(option);
});

select.addEventListener("change", () => {
  const theme = getTheme(select.value);
  applyCssTheme(theme);
  localStorage.setItem(storageKey, theme.id);
});
```

## 常用变量

| 变量 | 用途 |
|---|---|
| `--bg` | 页面背景 |
| `--panel` | 主卡片 / 面板背景 |
| `--panel-2` | 次级卡片 / 输入区域背景 |
| `--line` | 边框线 |
| `--text` | 主文字 |
| `--muted` | 次级文字 |
| `--accent` | 强调色 / 主按钮 |
| `--danger` | 危险操作 |
| `--gold` | 警告 / 高亮 |
| `--shadow` | 阴影 |
| `--key-bg` | 输入框 / 代码块背景 |
| `--touch-bg` | 次级按钮背景 |
| `--grid-a` | 背景网格线 A |
| `--grid-b` | 背景网格线 B |
| `--glow-a` | 背景光晕 A |
| `--glow-b` | 背景光晕 B |

## 数据分析报告接入建议

```css
.metric-card {
  background: var(--panel);
  border: 1px solid var(--line);
}

.metric-value {
  color: var(--accent);
}

.table th {
  color: var(--muted);
}
```

图表色可以读取主题里的方块色：

```js
import { getTheme } from "./theme-kit/theme.js";

const theme = getTheme(localStorage.getItem("report-theme"));
const chartColors = [
  theme.colors.I,
  theme.colors.O,
  theme.colors.T,
  theme.colors.S,
  theme.colors.Z,
  theme.colors.J,
  theme.colors.L
];
```

## HTML PPT 接入建议

```css
.slide {
  color: var(--text);
  background: var(--bg);
}

.slide-title {
  color: var(--accent);
}

.slide-panel {
  background: var(--panel);
  border: 1px solid var(--line);
}
```

## 后台系统接入建议

```css
.app-shell {
  color: var(--text);
  background: var(--bg);
}

.sidebar,
.toolbar,
.card {
  background: var(--panel);
  border-color: var(--line);
}

.secondary-text {
  color: var(--muted);
}

.primary-action {
  background: var(--accent);
}
```

## 新增主题

在 `theme.js` 的 `themes` 对象中新增：

```js
myTheme: {
  id: "myTheme",
  name: "My Theme",
  description: "主题描述",
  css: {
    "--bg": "#10131f",
    "--panel": "#171c2c",
    "--panel-2": "#20283c",
    "--line": "#344058",
    "--text": "#f2f6ff",
    "--muted": "#a8b3c9",
    "--accent": "#00d4a6",
    "--danger": "#ff5b6e",
    "--gold": "#ffc857",
    "--shadow": "rgba(0, 0, 0, .36)",
    "--key-bg": "#101725",
    "--touch-bg": "#243049",
    "--grid-a": "rgba(255,255,255,.035)",
    "--grid-b": "rgba(255,255,255,.03)",
    "--glow-a": "rgba(0, 212, 166, .22)",
    "--glow-b": "rgba(255, 200, 87, .18)"
  },
  colors: {
    I: "#9cdcfe",
    O: "#dcdcaa",
    T: "#c586c0",
    S: "#4ec9b0",
    Z: "#f44747",
    J: "#569cd6",
    L: "#ce9178"
  },
  tone: "dark"
}
```

如果是浅色主题，把 id 加到 `LIGHT_THEME_IDS`。
