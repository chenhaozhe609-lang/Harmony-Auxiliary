# Harmony Auxiliary

免登录的本地和声创作工具，使用 React、Vite 和 TypeScript。所有项目数据保存在当前浏览器中。

## 保留功能

- 导入 MIDI、选择旋律轨道，或在钢琴卷帘中手动编辑音符。
- 生成三个和声候选，试听、对比与替换和弦。
- 导出 MIDI、复制和声进行。
- 本地项目保存、打开、更新、重命名与删除。
- 自动保存与刷新后的草稿恢复、中英文界面和操作引导。

首页、工作区和示例入口分别为 `/`、`/workspace` 和 `/demo`。全部无需账户、后端、数据库服务或环境变量。

## 开发与验证

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

生产构建输出到 `apps/web/dist`，使用支持 SPA 路由回退的静态服务器部署。
浏览器回归的运行方法见 [scripts/README.md](scripts/README.md)。

## 数据和音频

项目与草稿保存在 IndexedDB，偏好设置保存在 localStorage。不同浏览器、设备或网站地址不共享项目。清空本地数据会删除当前浏览器的项目、草稿和设置；可通过 MIDI 导出保留副本。

采样音色从第三方来源加载，播放立即使用本地合成器，采样完成后再升级。编辑、生成、导出和项目保存无需云端服务。应用未实现 PWA 离线安装；首次打开仍需加载静态网页资源。

本轮审计、修复和剩余问题见 [审计文档](docs/AUDIT.md)。`docs/Archived/round-8` 保留为历史材料，其云端认证与 API 建设计划已被本轮本地工具方向替代。
