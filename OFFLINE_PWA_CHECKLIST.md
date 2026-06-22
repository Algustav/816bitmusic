# 8+16bit 离线 PWA 改造待办清单

> 目标：用户首次联网打开并完成缓存后，能够在 iPhone、Android 和桌面设备上从主屏幕启动应用，并在完全离线的情况下选择和播放全部内置专辑。

## 1. 基础接入

- [x] 安装并配置 `vite-plugin-pwa`
- [ ] 确定 Service Worker 更新策略：
  - `registerType: "prompt"`：新版本可用时由用户确认刷新
  - `registerType: "autoUpdate"`：自动更新并激活新版本
- [x] 注册 Service Worker
- [x] 保留并检查现有 `site.webmanifest`
- [x] 确认应用名称和短名称
- [x] 确认彩色像素 M 图标
- [x] 确认 `theme_color` 与 `background_color`
- [x] 确认 `display: "standalone"`
- [x] 确认 `start_url` 和 `scope` 均适用于 Cloudflare Pages 根路径

## 2. 离线资源范围

确保以下资源进入预缓存：

- [x] `index.html`
- [x] 构建后的 JavaScript
- [x] 构建后的 CSS
- [x] WOFF / WOFF2 字体
- [x] GME WASM 文件
- [x] Audio Worklet
- [x] GME Render Worker
- [x] 全部内置 NSFe 专辑
- [x] favicon 和 PWA 图标
- [x] Web App Manifest
- [x] Todo 页面及其资源

建议包含的资源模式：

```text
**/*.{js,css,html,ico,png,svg,woff,woff2,wasm,nsfe}
```

构建后必须确认当前全部 NSFe 文件都已进入缓存清单。

## 3. 缓存策略

- [x] 构建哈希资源使用 `Cache First`
- [x] NSFe 音乐文件使用 `Cache First`
- [x] WASM 使用 `Cache First`
- [x] Worker 和 Worklet 使用 `Cache First`
- [x] 页面导航使用 `Network First`
- [x] 导航网络失败时回退到本地首页
- [x] 新 Service Worker 激活后清理旧版本缓存
- [x] 避免缓存 404、500 和 Cloudflare 错误响应
- [x] 验证带中文、空格、单引号及特殊字符的 NSFe URL
- [x] 确认缓存更新不会删除仍被当前版本使用的资源

## 4. 安装和状态 UI

- [x] 提供“可安装到主屏幕”提示
- [x] 显示离线资源正在下载
- [ ] 如可行，显示下载进度
- [x] 缓存完成后显示“已可离线使用”
- [x] 显示当前在线 / 离线状态
- [x] 新版本可用时提示用户刷新
- [x] 缓存失败时显示错误状态
- [x] 缓存失败时提供重试操作
- [x] 缓存流程不能阻塞正常在线播放

## 5. iPhone / iPad 专项

- [ ] 使用 Safari 打开线上地址
- [ ] 从 Safari 添加到主屏幕
- [ ] 确保 iOS 继续使用 `IOS MEDIA` 音频引擎
- [ ] 首次安装后等待全部资源缓存完成
- [ ] 关闭 Safari 页面
- [ ] 开启飞行模式
- [ ] 从主屏幕冷启动应用
- [ ] 飞行模式下播放不同专辑
- [ ] 飞行模式下切换未曾播放过的专辑
- [ ] 测试暂停、继续、停止和进度拖动
- [ ] 测试锁屏和重新解锁
- [ ] 测试切换到后台后重新进入
- [ ] 确认收藏离线可用
- [ ] 确认 Todo 离线可用
- [ ] 测试设备存储空间紧张时的表现
- [ ] 记录 iOS 清理网站存储后的恢复流程

## 6. Android 和桌面平台

- [ ] Android Chrome 安装测试
- [ ] Android Edge 安装测试
- [ ] Android 飞行模式冷启动
- [ ] Windows Edge 安装测试
- [ ] Windows 离线启动和播放测试
- [ ] macOS Safari 主屏幕 / Dock Web App 测试
- [ ] 普通浏览器模式下不安装也能正常运行
- [ ] HTTPS 线上环境测试
- [ ] localhost 开发环境测试
- [ ] 发布新版本后确认旧缓存正确清除

## 7. 构建验证

执行：

```powershell
npm run build
npm run preview
```

检查 `dist` 是否包含类似资源：

```text
sw.js
workbox-*.js
manifest.webmanifest
```

实际文件名可能因插件配置而不同。

验证项目：

- [x] Service Worker 注册成功
- [x] Service Worker 作用域覆盖整个应用
- [x] 全部 NSFe 进入缓存清单
- [x] WASM 进入缓存
- [x] Worker 和 Worklet 进入缓存
- [x] 字体进入缓存
- [x] Todo 页面资源进入缓存
- [x] 断网刷新仍能显示应用
- [x] 断网冷启动仍能显示应用
- [ ] 离线时能够切换所有内置专辑
- [ ] 离线播放不出现资源 404
- [ ] 浏览器控制台没有 Service Worker 或缓存错误

## 8. Cloudflare Pages 发布

- [ ] 运行正式生产构建
- [ ] 生成内部路径统一使用 `/` 的 ZIP
- [ ] ZIP 根目录直接包含 `index.html`
- [ ] ZIP 不得包含额外的 `dist/` 外层目录
- [ ] 确认 Service Worker 文件位于正确路径
- [ ] 确认所有缓存资源都包含在 ZIP 中
- [ ] 上传 Cloudflare Pages 创建新部署
- [ ] 清除或绕过旧 Service Worker 缓存进行首次测试
- [ ] 在线完成首次离线资源下载
- [ ] 从主屏幕重新启动
- [ ] 开启飞行模式完成最终验收

## 9. 最终验收标准

> 在一台此前没有访问过该网站的新设备上，首次联网打开应用并完成缓存；随后关闭网页、开启飞行模式，从主屏幕重新启动应用，能够浏览、选择并播放全部内置专辑。

同时满足：

- [ ] 页面、字体和主题显示正常
- [ ] WASM 音频引擎正常加载
- [ ] iOS 原生媒体兼容引擎正常出声
- [ ] 示波器和五声道可视化正常
- [ ] 播放控制和进度条正常
- [ ] 收藏功能正常
- [ ] Todo 页面正常
- [ ] 不产生任何网络依赖错误
