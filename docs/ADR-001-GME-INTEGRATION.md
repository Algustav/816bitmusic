# ADR-001：GME 采用实时桥接，而非整曲预渲染

状态：暂定，等待第一份 GME/WASM 原型验证  
日期：2026-06-20

## 背景

第一版需要在播放过程中实时执行：

- 五声道 Mute / Solo
- 声道活动与音量可视化
- 后续可能的声像和独立声道分析

已检查 Web-Chiptune-Player 上游实现（提交 `e2319ae4bddabb3d2e7b4251a281e3970948b49e`，2026-01-15）。它支持 NSF / NSFe，并使用 GME 的以下能力：

- `gme_voice_count`
- `gme_voice_name`
- `gme_mute_voice`
- `gme_mute_voices`

但该项目当前主要采用“预先渲染完整循环，再通过 AudioBuffer 播放”的架构。这适合稳定播放和导出，不适合播放中即时 Mute / Solo，也没有提供我们需要的实时芯片遥测。

## 决策

第一版优先直接封装 GME，建立小型 C/C++ → WebAssembly 桥，并在 AudioWorklet 中按音频块实时调用。

桥接层至少暴露：

```text
create / destroy
load_data
start_track
render_samples
track_info
voice_count
voice_name
mute_voice
mute_voices
```

声道遥测分两级实现：

1. 首先利用每声道独奏渲染或 GME 内部声道输出计算包络，满足活动状态与音量表。
2. 若要获得准确频率、占空比和寄存器状态，再对 GME 的 NES APU 层增加只读遥测接口。

## 原因

- GME 已确认具有可靠的声道枚举与静音 API。
- 实时渲染允许播放中切换 Mute / Solo。
- 音频内核与 UI 之间已有 `NsfEngine` 接口，不会把 GME 细节泄露到 React。
- 避免为了实时交互而反复预渲染整首曲目。

## 许可证注意

所检查的 Web-Chiptune-Player 仓库使用 LGPL-2.1。直接使用 GME 或其修改版本前，仍需以最终锁定的上游版本为准核实许可证，并随发布产物提供相应声明、许可证和可获得的对应源码。

## 尚待验证

- Emscripten 编译参数和最终 WASM 体积
- AudioWorklet 中加载 WASM 的方式
- Safari 和移动端的稳定性
- NSFe 元数据与播放行为
- 每声道包络计算的 CPU 成本
- 扩展音频芯片的声道编号与命名

## 预渲染探针结果

2026-06-20 使用 `04 - Kage.nsf` 的第 1 子曲目完成了本地 WASM 探针：

- GME 成功打开文件并输出 150 秒 PCM。
- 混合立体声 PCM 为 26,460,080 字节。
- Square 1、Square 2、Triangle、Noise 均输出非静音数据。
- DMC 在该子曲目中为静音，这属于曲目内容结果，不代表接口失败。
- 五声道分离渲染可用于验证即时 Gain Mute。

这证明预构建 WASM 与目标样本兼容，但不改变“正式版本应自行从锁定源码构建”的决定。
