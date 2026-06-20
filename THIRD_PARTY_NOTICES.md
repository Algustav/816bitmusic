# Third-party dependencies

本文件记录直接依赖和计划引入的音频内核。最终发布前需要根据锁定版本重新生成完整许可证清单。

## 当前直接依赖

| 项目 | 用途 | 许可证 |
|---|---|---|
| React / React DOM | 用户界面 | MIT |
| Zustand | 状态管理 | MIT |
| Vite | 构建工具 | MIT |
| TypeScript | 类型检查 | Apache-2.0 |
| Vitest | 单元测试 | MIT |
| ESLint | 静态检查 | MIT |

## 待选音频内核

Game Music Emu（GME）或其 WebAssembly 封装尚未锁定。在引入前必须确认：

- 上游仓库与维护状态
- NSF / NSFe 支持
- 五声道 Mute 与遥测接口
- 源码及 WebAssembly 产物的许可证
- 修改后的源码公开或署名要求
- Cloudflare Pages 静态部署兼容性

2026-06-20 的初步调查确认，Web-Chiptune-Player 上游仓库使用 LGPL-2.1，并调用 GME 的声道枚举与静音 API。项目暂定采用直接 GME 实时桥接；最终许可证记录以锁定的 GME 上游版本为准。

开发验证阶段暂时使用以下上游产物：

- Web-Chiptune-Player commit：`e2319ae4bddabb3d2e7b4251a281e3970948b49e`
- 上游日期：2026-01-15
- 本地许可证副本：`third_party/web-gme-player/LICENSE`
- 本地桥接源码副本：`third_party/web-gme-player/main.c`

该预构建 WASM 仅作为技术验证产物。正式发布前必须从锁定的 GME 源码自行构建，以保证二进制来源、修改内容和 LGPL 对应源码均可追溯。

## 实时 GME 构建

实时版本使用官方 `game-music-emu` 仓库作为 Git submodule：

- Commit：`dd3182a8bdae3ff761438632aace418fbcaed439`
- 上游版本线：0.6.6 development
- 上游日期：2026-04-21
- 自有桥接源码：`third_party/realtime-gme/bridge.c`
- 构建脚本：`tools/build-realtime-gme.ps1`
- 发布产物：`public/vendor/gme-realtime/realtime-gme.wasm`

发布时应继续提供 submodule 指向的对应源码、桥接修改源码以及 LGPL
许可证。旧预渲染产物暂时保留用于基线回退。
