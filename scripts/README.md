# 浏览器验证

使用仓库的 Playwright 开发依赖。首次运行安装 Chromium：

```bash
pnpm exec playwright install chromium
pnpm --filter @harmony/web dev --host 127.0.0.1 --port 5181
```

在另一个终端运行：

```bash
pnpm test:browser
node scripts/verify-routing.mjs
node scripts/verify-t4.mjs
node scripts/verify-t5-4.mjs
```

可通过 `VERIFY_URL` 指定服务器地址，通过 `VERIFY_BROWSER_PATH` 使用已安装的 Chrome。
Windows 后台启动服务须使用用户指定的 `C:\Users\LENOVO\.codex\bin\Start-CodexBackground.ps1`，并分别提供 stdout 和 stderr 日志路径，启动后在有限时间内检查就绪状态。

## 当前验证

- `verify-local-workspace.mjs`：桌面与手机入口、MIDI 导入/生成/导出、本地项目保存/更新/重命名/打开/删除、刷新恢复、清空数据、采样下载未完成时的首播，以及存储被禁用时的错误提示。
- `verify-routing.mjs`：首页、免登录工作区和示例路由。
- `verify-t4.mjs`：现有工作区布局、候选、试听与编辑阶段检查。
- `verify-t5-4.mjs`：按需操作引导。

登录、云端项目与账户隐私验证已删除。
`verify-t2-*.mjs` 与 `verify-t3-7.mjs` 是早期界面的历史检查，保留供查阅，不属于当前验收。
