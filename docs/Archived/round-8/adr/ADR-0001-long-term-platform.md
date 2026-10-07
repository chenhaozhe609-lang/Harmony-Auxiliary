# ADR-0001：长期运行平台与运营责任

> 2026-10-07：历史材料。本轮已改为免登录的本地工具，云端认证、自有 API、数据库与同步建设不再是当前执行计划。参见[项目说明](../../../../README.md)与[当前审计文档](../../../AUDIT.md)。

- **状态：** 已被 2026-10-07 本地工具方向替代
- **日期：** 2026-07-12
- **决策范围：** 第八轮 A0 / ARC-00.1 至 ARC-00.4
- **关联：** [架构审计](../01-architecture-audit.md)、[架构任务书](../05-architecture-tasks.md)、[总控任务书](../04-delivery-plan.md)

## 背景

当前产品是 Vite + React 单页工作台：浏览器通过 Supabase SDK 同时处理认证和项目读写，音频采样依赖匿名第三方 CDN。Supabase 数据库停止服务后，登录和用户项目一并不可用，证明“前端直连的单一 BaaS”不是可持续的运行边界。

本轮不迁移旧测试数据。目标并非一次性建设重型后端，而是先恢复以下长期能力：本地可创作、云端可安全同步、数据可恢复、音频首播不被网络阻塞、部署与成本可观测。

## 决策

### 1. 部署拓扑与区域

| 层 | 已选方案 | 区域与职责 | 明确不承担 |
| --- | --- | --- | --- |
| 静态 Web | **Vercel** | Vite 构建产物由全球 CDN 分发 | 数据库直连、长时任务、唯一备份 |
| HTTP API | **Vercel Node.js Functions**，与 Web 同仓库部署 | 生产函数固定在新加坡 `sin1`，靠近数据库；仅承载认证、项目/修订、同步、签名 URL、健康检查 | WebSocket 常驻连接、音频转码、长时生成、唯一队列 |
| 主数据库 | **Neon PostgreSQL（付费生产项目）** | AWS Asia Pacific (Singapore) `aws-ap-southeast-1`；API 只使用最小权限的 pooled 连接 | 直接暴露给浏览器、承载二进制音频资产 |
| 对象存储与资产 CDN | **Cloudflare R2 + 自有子域名** | 采样、导出和备份副本；私有对象经短期签名 URL，公开采样只使用版本化只读路径 | 将 `r2.dev` 用作生产域名、把 API token 下发浏览器 |
| 认证 | **Better Auth 运行在 API 内** | 用户、会话、验证令牌保存在同一 PostgreSQL；浏览器只持有 Secure/HttpOnly 会话 cookie | 浏览器保存数据库密钥、未登录即禁止本地创作 |
| 异步任务 | **本轮不部署 worker** | 生成继续在客户端确定性运行；仅在确有长时/异步需求时以独立 worker ADR 追加 | 用 Vercel Cron 作为同步、备份或关键任务的唯一保障 |

选择新加坡是产品当前以中文用户为主、且数据库与函数必须同区的工程取舍。Vercel 静态资源仍由 CDN 就近服务；只把有状态 API 固定在数据库附近。Neon 当前提供新加坡区，且项目区域创建后不可直接变更，因此区域迁移必须作为显式演练与变更，而不是临时配置。[Neon Regions](https://neon.com/docs/introduction/regions)；[Vercel Functions Regions](https://vercel.com/docs/functions/configuring-functions/region)

### 2. 为什么采用这套组合

- **保留 Vercel 而不重写为 Next.js。** 当前 Web 是 Vite/React 编辑器，迁移框架不能修复数据边界。Vercel Functions 可处理短 HTTP 请求、数据库访问、鉴权和指标，且能指定靠近数据源的区域；先以同仓库 `api/` 实现最小 API，避免额外运维面。[Vercel Functions](https://vercel.com/docs/functions)
- **用 Neon 替代前端直连的 Supabase。** 选择标准 PostgreSQL 和自有迁移，API 成为唯一数据入口。生产使用付费项目，不以免费层休眠行为承担用户项目；连接经 pooler，避免 serverless 并发连接耗尽。Neon 提供 PITR，并支持用 `pg_dump`/`pg_restore` 做独立恢复副本。[Neon connection pooling](https://neon.com/docs/connect/connection-pooling)；[Neon backups](https://neon.com/docs/manage/backups)
- **将资产从匿名 CDN 收回到受控对象存储。** R2 支持 S3 兼容接口和自有域名。生产公开资源走自有域名和版本化路径，私有用户导出走短期签名 URL；不使用仅适合开发的 `r2.dev` URL。[R2 S3 API](https://developers.cloudflare.com/r2/get-started/s3/)；[R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- **认证与数据在同一可迁移边界。** Better Auth 使用数据库持久化用户和会话，并可生成或迁移其 schema；邮件密码是本轮唯一账户方式。社交登录、支付、组织与实时协作不进入 A0–A5。[Better Auth database](https://www.better-auth.com/docs/concepts/database)；[email/password](https://www.better-auth.com/docs/authentication/email-password)

### 3. 用户身份、项目归属与权限

```text
匿名访问
  └─ IndexedDB 中创建 local project（可编辑、生成、试听、导出）
       ├─ 保持匿名：始终只在本地
       └─ 用户主动注册/登录
            └─ 用户确认“同步此项目”
                 └─ API 写入 account-owned project + immutable revision
                      └─ 浏览器保留本地副本和同步队列
```

- 本地项目默认不上传，不因认证服务或网络不可用而消失。
- 注册采用邮箱 + 密码；验证邮件、密码重置邮件由受控邮件服务发送，凭据只存在 API 环境变量。邮件服务供应商的选择与账户开通可在 A1 环境配置中完成，不改变认证数据模型。
- API 依据会话中的用户 ID 授权项目；所有项目、修订、变更和签名 URL 都必须做所有权检查。
- 同步时用户选择把匿名项目归属到当前账户；不得自动扫描或上传本地项目。
- 数据库角色分为迁移角色、API 运行角色、只读观测角色和仅在演练时使用的恢复角色；禁止共享超级用户连接串。

### 4. 可靠性、数据保留和成本目标

| 项目 | 已接受目标 | 实施责任 | 验证方式 |
| --- | --- | --- | --- |
| 本地创作可用性 | 网络/认证/API 不可用时，核心创作路径仍可用 | Web | 离线 E2E：新建、编辑、生成、试听、导出 |
| 云端 API 可用性 | 月度目标 99.5%，不把本地模式故障计入云端 SLO | Technical Owner | 健康检查与 API 成功率仪表盘 |
| 数据 RPO | **24 小时**：每日独立 `pg_dump` 到 R2；同时启用 Neon PITR | Technical Owner | 每季度恢复一份独立备份 |
| 数据 RTO | **4 小时**：从已验证备份恢复到隔离同构环境 | Technical Owner | 每季度恢复演练记录 |
| 项目删除 | 软删除保留 30 天；到期后从主库清理，备份按周期自然过期 | API/DB | 删除与恢复集成测试 |
| 数据库 PITR | 生产至少保留 7 天（具体窗口取决于已购计划） | Technical Owner | Neon 设置截图/导出与演练 |
| 独立备份保留 | 每日备份 35 天；每月备份 12 个月 | Technical Owner | R2 生命周期与备份清单 |
| 应用日志 | 默认 30 天；安全/审计事件 90 天；日志不记录密码、cookie、完整项目内容或音符数据 | Technical Owner | 日志抽查与脱敏测试 |
| 成本治理 | 生产固定预算上限 **USD 60/月**；预测达到 USD 45/月或任一供应商发生异常增长即告警并需审批 | Product Owner | 月度成本报表、平台预算告警 |

> 上述目标是第八轮的可运营下限，不等同于多区域高可用承诺。数据库跨区灾备、实时协作和 99.9% 云端 SLO 必须在独立 ADR 中重新估算成本与复杂度。

### 5. 责任角色与事件处置

当前项目由小团队运营，因此先定义角色而不绑定个人姓名；部署前必须在运行手册中填写实际负责人和备用联系人。

| 责任 | 角色 | 最低职责 |
| --- | --- | --- |
| 产品预算、数据保留与重大风险接受 | Product Owner | 批准预算超限、保留策略改变、数据删除和重大供应商切换 |
| 部署、迁移、密钥、备份恢复、告警处置 | Technical Owner | 维护运行手册、每季度演练、处理 P0 事件、确保至少两名账户管理员 |
| 日常发布与质量门 | Release Owner | 确认 CI、变更记录、版本标记、回滚路径和发布后指标 |

**P0 触发条件：** 用户项目无法读写、错误同步覆盖、认证失效导致已登录用户无法访问自己项目、默认音频无法首次播放、发现密钥泄露或未授权数据访问。

**P0 首次响应：** Release Owner 停止继续发布并记录版本/时间；Technical Owner 先保护数据（必要时切只读或关闭写入），再按 runbook 恢复或回滚；Product Owner 决定外部沟通。任何恢复都必须留下事件编号、影响范围、数据处置和后续防复发任务。

### 6. 安全与配置底线

- 生产、预发布、开发环境分别使用独立数据库项目、R2 bucket、认证密钥和 Vercel 环境变量；禁止跨环境复用生产连接串。
- 所有管理账户开启 MFA；生产密钥仅存于供应商受控密钥系统，按 90 天或事件后轮换。
- Web 只获得公开 API 基址；R2、数据库、邮件和认证密钥绝不以 `VITE_*` 变量打包。
- CORS 仅允许已登记 Web 域名；会话 cookie 使用 `Secure`、`HttpOnly`、`SameSite=Lax`，生产使用 HTTPS。
- API 对注册、登录、重置、同步、签名 URL 实施速率限制和审计事件记录；签名 URL 最短可行期限，默认不超过 10 分钟。
- 依赖漏洞、迁移、契约、关键浏览器和离线测试都是合并门槛；无法通过的安全检查不得以临时忽略上线。

## 替代方案与未选原因

| 方案 | 结论 | 原因 |
| --- | --- | --- |
| 保持 Supabase 前端直连 | 不采用 | 认证与数据同故障域；当前停用已证实其运营风险；也不符合 API/权限/修订边界 |
| 迁移到全新 Next.js + Vercel 全栈 | 不采用 | 框架重写不解决核心问题，会阻断成熟编辑器、扩大 A1 风险；Vite/React 可继续运行 |
| 自建 VM + 自管 PostgreSQL | 暂不采用 | 对当前用户规模增加补丁、监控、备份和高可用运营负担；若托管成本或合规需求改变，再单独评审 |
| 立即引入 Redis、队列、CRDT、WebSocket | 暂不采用 | 本轮生成仍是客户端确定性任务；先证明版本化同步和本地优先数据层可靠 |
| 继续使用第三方匿名采样 CDN | 不采用 | 关键试听能力不可控；用户已反馈首播慢，且依赖无服务承诺 |

## A1 必须落实的事项

1. 创建新加坡 Neon 付费生产/预发布项目，启用 PITR、pooler、最小权限角色与预算/告警；不导入旧 Supabase 数据。
2. 创建 R2 的 `production`、`staging`、`backups` 独立 bucket，自有域名、生命周期规则和最小权限 token。
3. 在 Vercel 设置 `sin1`、独立环境变量和部署保护；建立 API 健康检查与发布版本标记。
4. 选择并开通受控邮件服务，填充发件域名、验证与重置流；不把邮件令牌写入仓库。
5. 建立密钥、备份、恢复、回滚、P0 事件的 runbook，并写入实际责任人/备用联系人。

## 触发重新决策的条件

以下任一情况必须更新或替代本 ADR，而不是静默修改代码：

- 需要 WebSocket、实时协作、服务端长时生成、音频转码或后台队列。
- 用户数据合规要求不允许存储在新加坡，或主要用户群发生实质地区变化。
- 连续两个月预测成本超出 USD 60/月，或技术供应商无法满足 4 小时恢复演练。
- 需要多区域数据库灾备、99.9% 云端 API SLO、企业 SSO 或组织级权限。
- Better Auth、Neon、R2 或 Vercel 任一供应商发生影响核心承诺的产品/合同变化。

## A0 验收证据

- 本 ADR 已覆盖 ARC-00.1–ARC-00.4，且所有选择均给出责任、边界、保留/恢复与复审条件。
- [总控任务书](../04-delivery-plan.md) 已记录 M0/A0 完成，后续任务以本 ADR 为前置。
- 本文件将随第八轮 A0 变更提交并推送到远端；A1 不得绕开本文新增生产供应商或凭据。
