# 8+16bit 芯片音乐播放器：第一版开发清单

状态：已确认  
第一版范围：NES NSF / NSFe  
后续范围：Sega Mega Drive VGM / VGZ、YM2612、SN76489

## 1. 产品目标

制作一个完全运行在浏览器本地的芯片音乐播放器。第一版聚焦 NES 音乐，提供可靠播放、子曲目管理、五声道 Mute / Solo、声道级实时可视化，以及可扩展的多主题视觉系统。

第一版的关键差异化能力是：视觉效果必须尽可能由真实芯片声道状态驱动，而非只根据混合音频随机变化。

## 2. MVP 范围

第一版包含：

- [ ] 导入 `.nsf` 和 `.nsfe`
- [ ] 播放、暂停、停止、上一子曲目和下一子曲目
- [ ] NSF 内部子曲目选择
- [ ] 循环播放
- [ ] 显示标题、作者、版权等元数据
- [ ] NES 五声道实时状态与可视化
- [ ] 每声道 Mute / Solo
- [ ] 整体波形与频谱
- [ ] 文件选择与拖放导入
- [ ] 桌面端与移动端响应式布局
- [ ] 多主题切换与持久化

第一版暂不包含：

- VGM / VGZ 与 Mega Drive 播放
- YM2612 与 SN76489 可视化
- MIDI 播放或 NES 风格 MIDI 合成
- 在线曲库与账户系统
- 自动匹配游戏封面
- 音频导出
- Three.js 复杂 3D 场景
- 均衡器、混响等高级音频效果

## 3. 推荐技术栈

- React + TypeScript + Vite
- GME（Game Music Emu）WebAssembly
- AudioWorklet
- Web Audio API / AnalyserNode
- PixiJS 或 Canvas 2D
- Zustand
- Vitest + Playwright
- CSS Custom Properties（设计令牌与主题）

## 4. 建议项目结构

```text
src/
├─ audio/
│  ├─ NsfEngine.ts
│  ├─ audio-worklet.ts
│  ├─ channel-telemetry.ts
│  └─ analyser.ts
├─ visual/
│  ├─ VisualEngine.ts
│  ├─ ChannelScope.ts
│  ├─ Spectrum.ts
│  └─ PixelParticles.ts
├─ components/
│  ├─ FileDropZone.tsx
│  ├─ PlayerControls.tsx
│  ├─ TrackSelector.tsx
│  ├─ ChannelRack.tsx
│  └─ MetadataPanel.tsx
├─ themes/
│  ├─ contracts.ts
│  ├─ nes.ts
│  ├─ md.ts
│  └─ cotris/
├─ store/
│  └─ playerStore.ts
├─ workers/
├─ wasm/
└─ App.tsx
```

## 5. 分阶段开发清单

### 阶段 0：技术风险验证

- [x] 选定可用于发布的 GME WASM 实现
- [x] 核实依赖许可证及再分发要求
- [x] 验证 NSF 和 NSFe 均可加载
- [x] 验证五声道是否可独立 Mute（预渲染原型）
- [ ] 验证能否获取每声道音量、频率、占空比等遥测数据
- [x] 若现有封装不支持声道能力，确定修改 GME、扩展 WASM 接口或更换内核
- [ ] 准备拥有合法使用权的测试音乐文件

完成标准：实现“选择 NSF → 播放 → 五个 Mute 按钮”的最小原型，并确认声道遥测方案可行。

### 阶段 1：项目骨架

- [x] 创建 Vite + React + TypeScript 项目
- [ ] 配置 ESLint、Prettier 和路径别名（ESLint 已完成）
- [x] 建立音频、视觉、组件、主题和状态目录
- [x] 建立响应式播放器页面框架
- [x] 建立统一设计令牌和主题接口
- [x] 加入第三方依赖与许可证记录

完成标准：项目可启动，基础播放器界面可在桌面和手机尺寸正常显示，并能切换占位主题。

### 阶段 2：NSF 播放内核

- [x] 加载 NSF / NSFe 文件
- [x] 读取标题、作者、版权和子曲目数量
- [x] 读取 NSFe 内嵌子曲目标题；经典 NSF 缺失时回退为编号
- [x] 初始化 AudioContext
- [x] 使用 AudioWorklet 连续生成音频
- [x] 实现播放、暂停和停止（实时 AudioWorklet）
- [x] 实现子曲目切换（实时 AudioWorklet）
- [ ] 实现循环与淡出
- [x] 对未知时长的预渲染曲目自动裁剪尾部静音
- [ ] 处理浏览器必须由用户手势启动音频的限制
- [ ] 避免开始播放及切歌时爆音
- [ ] 正确销毁旧 AudioNode、Worklet 与 WASM 实例

完成标准：连续播放 30 分钟，无明显卡顿、爆音或持续内存增长。

### 阶段 3：声道控制与遥测

- [ ] 识别 Pulse 1、Pulse 2、Triangle、Noise 和 DPCM
- [ ] 从播放内核暴露每个声道的实时状态
- [ ] 实现单声道 Mute
- [ ] 实现 Solo，并允许多个声道同时 Solo
- [ ] 实现全部恢复
- [ ] 显示各声道活动状态
- [ ] 切换文件及子曲目时正确重置声道控制
- [ ] 控制数据与音频时间轴同步

建议遥测接口：

```ts
interface NesChannelTelemetry {
  channel: "pulse1" | "pulse2" | "triangle" | "noise" | "dpcm";
  active: boolean;
  volume: number;
  frequency?: number;
  note?: number;
  dutyCycle?: number;
}
```

完成标准：静音任意声道后能听到明确差异，界面状态和声音保持同步。

### 阶段 4：基础可视化

- [ ] 使用 AnalyserNode 获取总输出波形
- [ ] 实现整体示波器
- [ ] 实现整体频谱
- [ ] 为五个声道制作独立音量表
- [ ] Pulse 通道根据频率和占空比绘制方波
- [ ] Triangle 通道绘制三角波或低频地形
- [ ] Noise 通道根据真实活动触发像素粒子
- [ ] DPCM 通道显示采样脉冲
- [ ] 增加可由主题配置的辉光、余辉与 CRT 扫描线
- [ ] 提供动画强度或视觉质量设置
- [ ] 尊重 `prefers-reduced-motion`
- [ ] 页面进入后台时降低或暂停视觉刷新

完成标准：视觉变化与鼓点、音高及声道活动有清晰对应关系，而非随机动画。

### 阶段 5：播放器交互

- [ ] 文件选择按钮
- [ ] 文件拖放区域
- [ ] 文件类型与大小验证
- [ ] 播放、暂停、停止、上一首和下一首
- [ ] 子曲目列表
- [ ] 播放进度与时间显示
- [ ] 总音量控制
- [ ] 循环模式
- [ ] 全屏模式
- [ ] 主题选择器
- [ ] 保存用户选择的主题
- [ ] 键盘快捷键
- [ ] 清晰的加载、空状态和错误提示

建议快捷键：

```text
Space       播放 / 暂停
← / →       切换子曲目
M           全部静音 / 恢复
F           全屏
1–5         切换对应声道
Shift+1–5   Solo 对应声道
```

### 阶段 6：稳定性与发布

- [ ] 限制可导入文件大小
- [ ] 处理损坏或不支持的 NSF / NSFe
- [ ] 测试 Chrome、Edge、Firefox 和 Safari
- [ ] 测试不同设备采样率
- [ ] 测试移动端触摸操作
- [ ] 测试高 DPI、缩放及不同屏幕比例
- [ ] 执行性能与内存分析
- [ ] 检查键盘可用性、焦点状态和颜色对比度
- [ ] 编写使用说明、隐私说明和版权声明
- [ ] 确保用户文件不上传服务器
- [ ] 部署到静态托管服务

## 6. 主题系统与 Cotris Theme Kit 复用规范

项目已提供 `theme-kit/`。它来自 Cotris 1.6，是不依赖框架的静态主题系统，包含主题数据、CSS 变量、页面主题解析和预览页面。播放器将直接复用该规范，不再建立一套与其竞争的主题模型。

### 6.1 Theme Kit 现有能力

- `theme.js` 保存主题对象并提供 `applyCssTheme`、`getTheme`、`listThemes`。
- `page-theme.js` 按 URL 参数、本地存储、默认主题的优先级解析主题。
- 默认存储键为 `theme-kit-theme`，也允许通过 HTML 属性覆盖。
- `theme.css` 提供基础页面、面板、按钮、输入框和背景样式。
- 主题包含 `dark` / `light` 色调，可同步设置浏览器 `color-scheme`。
- 当前共定义 18 套主题，其中 10 套由 `listThemes()` 对外显示。

现有核心 CSS 令牌：

```text
--bg
--panel
--panel-2
--line
--text
--muted
--accent
--danger
--gold
--shadow
--board-shell
--key-bg
--touch-bg
--overlay-bg
--grid-a
--grid-b
--glow-a
--glow-b
```

现有程序化视觉字段：

```ts
interface CotrisTheme {
  id: string;
  name: string;
  description: string;
  css: Record<string, string>;
  colors: {
    I: string;
    O: string;
    T: string;
    S: string;
    Z: string;
    J: string;
    L: string;
  };
  boardBackground: string;
  previewBackground: string;
  gridColor: string;
  ghostAlpha: number;
  tone: "light" | "dark";
}
```

### 6.2 播放器接入策略

- UI 组件直接使用 Theme Kit 的 CSS 变量。
- Canvas / PixiJS 不读取计算后的组件样式，而通过主题对象适配器获取颜色。
- 不修改已有主题对象的基础字段，保证 Theme Kit 仍可独立使用。
- 播放器专用参数放在可选的 `player` 扩展字段中。
- 对没有 `player` 字段的旧 Cotris 主题，适配器必须自动生成默认值。
- 主题切换只更新表现层，不重建 AudioContext、WASM 或播放状态。
- 主题状态继续遵循 URL → localStorage → 默认主题的解析顺序。
- 播放器使用独立存储键时，建议设为 `chip-player-theme`。

播放器扩展建议：

```ts
interface PlayerThemeExtension {
  channels?: {
    pulse1: string;
    pulse2: string;
    triangle: string;
    noise: string;
    dpcm: string;
  };
  effects?: {
    glow: number;
    scanlines: number;
    trail: number;
    particleIntensity: number;
  };
}
```

主题可选写法：

```ts
{
  // 保留 CotrisTheme 的全部原字段
  player: {
    channels: {
      pulse1: "#79c0ff",
      pulse2: "#bc8cff",
      triangle: "#3fb950",
      noise: "#d29922",
      dpcm: "#f85149"
    },
    effects: {
      glow: 0.65,
      scanlines: 0.28,
      trail: 0.4,
      particleIntensity: 0.7
    }
  }
}
```

旧主题的默认声道映射：

```text
Pulse 1  ← colors.I
Pulse 2  ← colors.T
Triangle ← colors.S
Noise    ← colors.O
DPCM     ← colors.Z
```

`colors.J` 和 `colors.L` 保留给频谱辅助色、选中态、粒子渐变或未来扩展声道。浅色主题需要由适配器降低辉光、扫描线和粒子不透明度，避免视觉发灰或对比度不足。

### 6.3 首批主题计划

- [ ] 直接接入 Theme Kit 当前公开主题
- [ ] 增加 NES 默认主题：深灰、暖白、红色强调
- [ ] 增加 MD 预留主题：黑色、钴蓝、荧光紫
- [ ] 增加高对比度或低动态效果主题
- [ ] 为主题预览页增加五个 NES 声道色和视觉效果参数预览
- [ ] 明确隐藏主题是否只用于兼容，或允许在播放器高级设置中显示

### 6.4 实施清单

- [x] 将 `theme-kit/theme.js` 转为 TypeScript，或提供完整 `.d.ts`
- [ ] 保持 `theme-kit` 的纯静态使用能力
- [x] 建立 `adaptThemeForPlayer(theme)` 适配器
- [x] 建立 React 主题状态与选择器
- [ ] 将主题变化同步到 Canvas / PixiJS
- [ ] 为 NES 与 MD 添加主题对象，不在组件中写死配色
- [ ] 将视觉效果强度与用户“减少动态效果”偏好合并计算
- [ ] 为所有公开主题测试文字、按钮和声道颜色对比度
- [ ] 核实 Theme Kit 及其中主题名称、配色的许可与归属说明

### 6.5 主题验收标准

- 所有公开主题覆盖页面、弹层、按钮、声道和可视化状态。
- 未包含 `player` 扩展字段的旧主题仍能正常工作。
- 切换主题时音乐连续播放且无爆音。
- 不刷新页面即可完成主题切换。
- 刷新页面后保留用户选择。
- URL 参数可以临时覆盖本地存储主题。
- Canvas / PixiJS 与 DOM 界面在同一帧切换到新主题。
- 新增普通 Cotris 主题无需修改播放器业务组件。
- 新增 NES / MD 专用主题只需提供主题数据，不修改音频内核。

## 7. 推荐开发顺序

```text
技术风险验证
  → 项目与主题骨架
  → 文件导入
  → NSF 正确播放
  → 子曲目切换
  → Mute / Solo
  → 声道遥测
  → 声道可视化
  → Cotris 主题适配
  → 粒子与视觉润色
  → 稳定性测试与发布
```

## 8. 第一版验收标准

- [ ] NSF 与 NSFe 能可靠加载
- [ ] 元数据及子曲目正确显示
- [ ] 播放、暂停和切歌无明显爆音
- [ ] 五个声道均可独立 Mute / Solo
- [ ] 声道可视化与实际声音同步
- [ ] 普通电脑稳定达到 60 FPS
- [ ] 动画降级后移动端稳定达到 30 FPS
- [ ] 连续播放 30 分钟无明显内存泄漏
- [ ] 用户文件全部在浏览器本地处理
- [ ] 第三方依赖许可证符合发布方式
- [ ] NES 与 Cotris 主题均通过统一主题接口工作
- [ ] 切换主题不会中断播放或重置当前曲目

## 9. 关键风险记录

1. 声道级数据是第一版最大的技术风险，必须在视觉开发前验证。
2. AnalyserNode 只能分析最终混合音频，不能代替芯片声道遥测。
3. 选定 GME 封装前必须确认 Mute / Solo、NSFe 和许可证支持情况。
4. Cotris 主题目前未出现在工作区；实际资产加入后需先审查再建立映射。
5. 不应为了视觉效果让主线程承担音频生成，稳定播放优先于动画复杂度。

## 10. 后续版本方向

- VGM / VGZ
- Mega Drive 的 YM2612 与 SN76489
- YM2612 六通道及 Operator / Algorithm 可视化
- Three.js 全屏沉浸场景
- 本地曲库和播放列表
- PWA 安装与离线使用
- WAV 导出
- MIDI 到 NES 风格合成
