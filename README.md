# 8+16bit Chip Music Lab

浏览器端 NES / Mega Drive 芯片音乐可视化播放器。当前处于技术验证阶段。

## 当前能力

- React、TypeScript、Vite 项目骨架
- Cotris Theme Kit 接入与主题切换
- NSF / NSFe 本地文件识别
- NSF 元数据、区域与扩展音频芯片解析
- NSFe 内嵌子曲目标题（`tlbl`）解析
- NES 五声道主题色适配
- 自编译 GME / WebAssembly + AudioWorklet 实时播放
- NSFe 专辑曲目列表与点击即播
- 播放、暂停、停止、上一首和下一首
- 标准 NES 五声道独立 Mute
- Cloudflare Pages 静态部署基础配置

当前开发分支使用 AudioWorklet 按 128 帧实时生成音频，不再等待整首预渲染。NSFe 的 `time` 和 `fade` 区块会作为准确播放长度。Solo 和芯片寄存器遥测尚未接入。

## 本地开发

```bash
npm install
npm run dev
```

## 质量检查

```bash
npm run lint
npm test
npm run build
```

## Cloudflare Pages

```text
Build command: npm run build
Output directory: dist
```

用户导入的音乐文件只在浏览器本地读取，不会上传服务器。

## 当前播放限制

- 经典 NSF 通常不含子曲目标题；没有 `.m3u` 等外部曲目表时只能显示编号。
- 经典 NSF 通常也不含可靠时长；这类循环曲会显示未知时长，后续加入循环探测。
- 当前只对标准 NES 五声道提供控制；扩展音频芯片暂未映射。

## 音频内核构建

实时 WASM 由固定的 `game-music-emu` Git submodule 和
`third_party/realtime-gme/bridge.c` 构建。Windows 开发环境可运行：

```powershell
npm run build:gme
```

构建脚本使用 `.tooling/` 下的 Emscripten SDK；该工具链目录不提交到 Git。
已生成的 `public/vendor/gme-realtime/realtime-gme.wasm` 会随静态站点发布。

预渲染版本保留在 Git 标签 `prerender-player-v0.1` 和 `main` 分支。
