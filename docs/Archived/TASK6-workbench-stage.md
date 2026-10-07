# Task 6 · 工作台舞台化重构（卷帘为主体 / 和声抽屉 / 模式合一 + 引导弹窗）

> 本文件是 TASK6.md §10 的延伸子任务清单。起因:产品方要求把工作台从"网格面板堆叠"
> 改为"钢琴卷帘为页面主体、其余组件为附属"的舞台式 IA。比 §10 的按需呈现更进一步,
> 且会**改动 Task 5 引导流程的行为**(原 Task 6 非目标,现产品方明确要改),故单列。

## 0. 愿景(来自产品方 Q&A,2026-06-21)

- **卷帘是页面主体(full-viewport stage)**,其他组件是它的附属。
- **旋律卷帘 = 主舞台**;**和声卷帘收进页面底部抽屉**,点击展开为和声钢琴卷帘。
- 当前旋律/和声被分成上下两块、中间夹一条**无意义的竖向滚动条**——要消除。
- **取消强制区分"专家/引导"**:默认即**专家工作台**;需要引导时点"引导"按钮 →
  弹出**引导表单弹窗**,用户在引导中的操作**映射到同一份工作台状态**。

## 1. 现状(实现前快照)

- 时间线 JSX(`App.tsx` ~1697–1916):`.timeline-stack` 竖向网格 = `ruler-window`(标尺)
  + "Melody" 标题 + `.melody-window`(`overflow-y:auto`, `max-height: min(46vh,460px)`)
  + "Harmony" 标题 + `.harmony-window`。三窗共享水平时间滚动(`syncHorizontalScroll`
  + `rulerScrollRef`/`melodyScrollRef`/`harmonyScrollRef`)。
- "无意义滚动条" = `.melody-window` 因整段音高(`PITCH_ROWS`)高于 460px 而产生的**内竖向滚动条**,
  它夹在旋律与和声之间。
- 模式:`viewMode: "guided" | "expert"`(`preferencesRepository`),`guided` 派生大量
  `show*` 可见性;引导 rail/coach 渲染在 `.timeline-panel` 内。§10 的舞台改动 scoped 在
  `.workspace-grid.is-expert`。
- 关键 className 被 verify 依赖:`.melody-window .note`、`.harmony-window .chord-block`、
  `.inspector`、`.candidate(-strip)`、`.toolbar-transport/-source`、`.settings-tray`、
  `.guide-rail/-coach/-coach-nav` 等。

## 2. Phase A — 舞台 + 和声底部抽屉

> 目标:旋律卷帘占满视口成为主体;和声进底部抽屉;消除中间滚动条。先不动模式系统。

- **A1 旋律舞台化**:命令栏之下,旋律卷帘占满工作区视口高度(full-viewport stage)。
  sticky 时间标尺(顶)、sticky 音高/键标签(左)、播放头贯穿。先 scoped 在 expert,
  保证引导旧布局不破。
- **A2 和声底部抽屉**:新增 `.harmony-drawer`(固定/吸底)。收起 = 细条(标题 +
  当前进行预览 chord symbols + 展开把手);展开 = 滑出和声卷帘(voices + chord blocks)。
  **复用** `harmonyScrollRef` + `syncHorizontalScroll` 保持与旋律的水平时间对齐(JS 同步,
  与布局位置无关,故可自由重定位)。`.harmony-window`/`.chord-block` className 保留。
- **A3 消除中间滚动条**:和声移出后旋律不再与之相邻,夹缝滚动条自然消失。可选增强:
  **auto-fit 音高范围**(按旋律实际 min/max midi 裁剪 `PITCH_ROWS` + 留白)进一步去掉
  旋律内竖向滚动条——注意会牵动 `noteGridRow` 映射,作为 A 阶段后段或独立小步。
- **A4 走带 × 抽屉共存**:**已定 = (a)** 走带浮条暂保持独立,置于抽屉之上;底部各组件的
  统一排布由产品方后续整体规划。(b) "和声 + 走带"统一底栏暂不做。
- **A5 候选切换归属**:候选 A/B/C 与和声强相关,考虑移入抽屉头部("选和声→看其卷帘")。
  Phase A 可先保持原位,降低改动面。
- **A6 验证**:保留 verify className;跑 `t4`/`t5-4`;用 Playwright 截图(桌面+移动)自检
  舞台占比、抽屉收起/展开、无横向溢出。

**验收**:旋律卷帘为视口主体;和声抽屉收起/展开顺滑;无"中间滚动条";t4/t5-* 绿;无横向溢出。

## 3. Phase B — 模式合一 + 引导弹窗

> 目标:默认 expert 工作台;引导从常驻视图改为按需弹窗向导,操作映射同一状态。

- **B1 默认专家**:`preferencesRepository` 默认 `viewMode = "expert"`(或彻底移除 guided 视图
  概念,保留状态兼容)。移除命令栏的"引导/专家"视图切换段控件。
- **B2 命令栏"引导"按钮 → 引导弹窗**:把现有 rail + coach 的 6 步(input/settings/generate/
  audition/select/export)改造为**弹窗向导**。每步控件 `dispatch` 到同一 `AppState`(映射到工作台);
  关闭弹窗后停留在工作台当前进度。**不新建第二份状态**(沿用 §10 的"activeStep 只是视图游标")。
- **B3 可发现性**:首访提示/空态引导入口,避免用户找不到引导;弹窗内步骤可跳转、可关闭。
- **B4 重写 verify-t5-4**:引导由 `.guide-rail` 常驻 → 弹窗。更新选择器与流程断言;保留
  Task 5 登录软门槛 + `.auth-demo-link` demo 入口。其余 t5-2/3/5 视情况微调。
- **B5 移动端**:引导弹窗与和声抽屉在窄屏退化为全屏 sheet;走带贴底;无溢出。

**验收**:默认进入即工作台;"引导"弹窗操作映射工作台;`tsc`/`build`/`test` 绿;
t4 + t5-*(t5-4 按新引导重写)绿;桌面/移动截图自检。

## 4. 风险与红线

- **改 Task 5 引导行为**:原 §4 非目标"不改引导流程行为",本轮经产品方明确**解除**;
  必须同步 verify 脚本,避免静默回归。
- **共享时间滚动**:抽屉重定位后,水平滚动靠 JS `syncHorizontalScroll` 同步,与布局无关,
  须保持三方(标尺/旋律/和声)联动;注意抽屉收起时 `harmonyScrollRef` 节点是否在 DOM。
- **层叠**:和声抽屉(底)× 走带浮条(底)× 检查器侧抽屉(右)× 弹窗(上)的 z-index 与遮挡。
- **可读性红线**:舞台密集数据仍达 WCAG AA;auto-fit 不得错位音符。
- **DOM/className**:能保留就保留(护 verify);确需变动的(引导弹窗)同步改脚本。

## 5. 实施顺序与状态

1. ✅ **Phase A**(舞台 + 和声抽屉)— 完成。
   - 旋律卷帘 **FL Studio 式满铺**:`.app-shell.expert` 全宽(`--stage-pad` 小边距)、命令栏压缩
     (去副标题、缩小 brand、padding 收紧)、`.workspace-grid.is-expert` 去 max-width、
     `.melody-window` 高度 `max(320px, calc(100dvh - 250px))`。
   - **和声底部抽屉**:`.harmony-drawer` = **`position: sticky; bottom:0`**,作为 `.timeline-panel`
     最后一个子节点,**与旋律同列** → 网格左原点天然对齐(避免了 fixed 全宽与居中列的错位)。
     收起=细条把手 + 进行预览;展开=和声卷帘(auto-open 当和声存在,verify 可查)。`min-width:0`
     防止宽网格撑破面板。共享水平滚动复用 `harmonyScrollRef`/`syncHorizontalScroll`。
   - 走带浮条置于抽屉之上(option A)。
   - 验证:`tsc`/`build` 通过;**verify t4 + t5-4 桌面+移动全绿**(对齐 0px、无横向溢出);
     Playwright 截图自检满铺/抽屉/对齐。
2. 🔄 **Phase A2(修正:真·满铺 = 固定高度 App)** — 进行中。
   > **关键纠正**:"铺满全屏"指的是**固定高度布局**(`overflow:hidden`,整页不滚动),
   > 卷帘高度 = `calc(100vh - 顶栏 - 工具栏 - 抽屉)`,**只有卷帘内部/抽屉内部滚动**。
   > 之前 Phase A 仍是"整页可滚 + 卷帘是 max-height 窗口" → 看起来像嵌入式组件。
   > 完整细则见 [钢琴卷帘设计.md](钢琴卷帘设计.md)。要点:
   - 四区固定:Top App Bar ~48px / Editor Toolbar ~48px(标题+工具合一,segmented+compact select)/
     Melody Editor 主区(flex 填满)/ Harmony Drawer 底部(收起 40px / 预览 24–30% / 展开 ~50%)。
   - 横向滚动条做成卷帘上侧的 **mini timeline navigator**(非浏览器默认条);右侧纵向细滚动条(6px)属卷帘内部。
   - **默认 8 小节项目 + 4 小节视口**(`MIN_TIMELINE_MEASURES` 4→8;列宽 44px/subdiv,4 小节≈1476px≈桌面宽)。
   - 抽屉去白硬边 → 暗色玻璃(`rgba(14,11,8,.92)`+blur+发丝边+上投影)+ 拖拽把手;
     走带条移入抽屉 header(不再卡在旋律/和声之间)。
   - 命名:上=旋律编辑器 / 下=和声轨道。
   - 保留 verify className;每步 t4/t5-4 + 截图自检。
3. ✅ **Phase B**(模式合一 + 引导弹窗)— 完成。
   - 实现路线:**取消 `guided` 布局分支**,工作台恒为 expert(`app-shell expert` / `workspace-grid is-expert` 写死);
     所有 `show*` 门槛恒为 true(工作台始终完整呈现)。
   - 新增 `guideOpen` 状态;命令栏去掉"引导/专家"段控件,改成一个 **"引导"按钮**(`view.guided`)打开向导。
   - 把原 `renderStepRail` + `renderStepCoach`(6 步:input/settings/generate/audition/select/export)
     从工作台内联**移进玻璃弹窗** `.guide-overlay/.guide-modal`;步骤里的控件仍 `dispatch` 到同一 `AppState`
     (映射工作台);`activeStep/guideStep/stepGates/goToStep` 机器保留不变;关闭弹窗停留在当前进度。
   - 默认 `viewMode` 改 `expert`;旧"guided"持久值不再影响布局(布局忽略 viewMode)。
   - 移动端:弹窗退化为全屏 sheet。
   - **重写 verify-t5-4**:引导从常驻 rail → 按需弹窗;默认即专家工作台。保留 `.auth-demo-link` 软门槛入口。

> 每个 Phase 独立 commit;每步 `tsc`/`build`/`test` + 相关 verify + Playwright 截图自检后再推进。
