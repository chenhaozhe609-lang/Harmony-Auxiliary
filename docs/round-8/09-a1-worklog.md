# A1 工作日志：工作区与基础设施骨架

> 状态：进行中。
> 关联任务：[A1 架构任务书](05-architecture-tasks.md#A1建立工作区基础设施和可观测性骨架)。

## 2026-07-12：A1.1 工作区边界

### 已完成

- 将既有 Vite + React 编辑器从仓库根目录迁入 `apps/web`，没有修改其运行逻辑。
- 新建 `apps/api`，包含部署到 Vercel 时使用的 `health`（liveness）与 `ready`（当前显式未就绪）端点；数据库真实探测留待 A2。
- 新建 `packages/domain`、`packages/contracts`、`packages/harmony-core`，只建立编译边界，不提前复制或迁移领域对象。
- 新建 `infra` 目录，作为迁移、部署、备份和运行手册的唯一归属。
- 根 `package.json` 改为 pnpm workspace 编排；`pnpm-workspace.yaml` 声明 `apps/*` 和 `packages/*`。
- 替换根环境示例与 README 中“新建 Supabase”的过时指引。遗留 Supabase 源码仍在 `apps/web`，只会在 A4 接入新 API 后移除。
- 新建 GitHub Actions CI：冻结依赖安装、单元测试、类型检查和构建。

### 验证证据

| 检查 | 结果 |
| --- | --- |
| 迁移前 `pnpm test` | 18 test files / 90 tests passed |
| 迁移前 `pnpm build` | passed；主包 392.28 kB gzip 警告已记录 |
| 迁移后 `pnpm test` | 18 test files / 90 tests passed |
| 迁移后 `pnpm typecheck` | `apps/web`、`apps/api`、三个 shared packages 全部通过 |
| 迁移后 `pnpm build` | 待本次提交前最终复核 |

### 已知边界

- `ready` 端点在没有 `DATABASE_URL` 时刻意返回 `503`，防止把尚未配置数据库误报为可同步；A2 将改为实际数据库探测。
- CI 的依赖漏洞扫描、迁移测试、API 合约测试和浏览器回归将在相应实现存在后加入；本次不伪造这些质量门。
- 建立 Neon、R2、Vercel 环境、邮件服务与实际告警仍需要账户侧操作，清单见 [ADR-0001](adr/ADR-0001-long-term-platform.md#a1-必须落实的事项)。
