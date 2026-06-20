# 8+16bit Chip Music Lab

浏览器端 NES / Mega Drive 芯片音乐可视化播放器。当前处于技术验证阶段。

## 当前能力

- React、TypeScript、Vite 项目骨架
- Cotris Theme Kit 接入与主题切换
- NSF / NSFe 本地文件识别
- NSF 元数据、区域与扩展音频芯片解析
- NSFe 内嵌子曲目标题（`tlbl`）解析
- NES 五声道主题色适配
- GME / WebAssembly 本地预渲染播放
- 子曲目选择、播放与暂停
- 标准 NES 五声道独立 Mute
- Cloudflare Pages 静态部署基础配置

当前播放实现会在 Web Worker 中预渲染五条独立声道。它用于验证 GME、子曲目和 Mute 能力；后续会替换为 AudioWorklet 实时渲染，以降低首次等待时间和内存占用。Solo 和芯片寄存器遥测尚未接入。

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

- 第一次播放某条子曲目需要等待本地预渲染。
- 经典 NSF 通常不含子曲目标题；没有 `.m3u` 等外部曲目表时只能显示编号。
- 无时长元数据的曲目会渲染至 150 秒上限，再自动裁掉尾部静音。
- 持续循环至渲染上限的曲目会显示 `~2:30`，表示估算时长。
- 预渲染版本内存占用较高，不是最终发布架构。
- 当前只对标准 NES 五声道提供控制；扩展音频芯片暂未映射。
