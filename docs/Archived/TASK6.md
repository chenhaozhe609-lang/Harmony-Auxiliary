# Task 6: 视觉重塑与前端组件优化（黑色空间 / 象牙白显形）

## 1. 背景

Task 1–5 已经把 Harmony Auxiliary 做成功能完整的和声工具:工作台、引导流程、Supabase 账户与云端项目。当前视觉是"森绿 + 米白"的 Apple 极简风(commit 55fc542),干净但偏通用,缺少作品级的艺术气质。

Task 6 重塑视觉语言,并顺势优化前端组件结构。本轮**不改功能逻辑、不改和声算法、不改认证/云端行为**——只动外观、氛围、动效与组件拆分。

> **修订(2026-06-22,产品方)**:炭黑 + 象牙白(暖调 oklch + 噪点 + 油画暗角)实际**显脏**。
> 改为**纯黑(#000)+ 纯白(#fff)中性单色**,并**移除全部 CSS 材质/氛围层**(胶片噪点 `body::after`、
> `.stage-atmosphere` 暗角、`.app-shell`/`.landing-shell` 径向光晕)。舞台与工作台都是**平面纯黑底**,
> 白色形体直接显形;强调仍 = 更亮的白。玻璃体系(nav/登录/抽屉的 backdrop-blur)与英雄区
> FloatingLines 的**文字易读性 scrim** 保留(属功能层,非材质)。本节下文的"油画/噪点/暗角"已作废。

## 2. 风格构想(来自产品方)

**黑色空间**——深黑背景是主场景,代表未成形的想法、空白、未知、舞台。~~带油画底色、暗部层次、静物画布感~~(**已改:平面纯黑 #000,无材质**)。

**象牙白主体**——白百合、白丝带、白瓷器、白色布料是主要视觉材料,代表:想法逐渐显形、柔软但有结构、作品被塑造出来、介于艺术与产品之间的"数字形态"。

## 3. 设计决策(已确认)

参考:产品方网店头图(荷兰静物画式明暗对比——深黑中浮起白百合/白瓷/缎带/垂布,纤细宽字距优雅衬线标题 + 克制 sans 副标 + 中点分隔 tagline)。

1. **舞台戳刮 + 工作台克制**:~~落地页/空状态/弹窗走满溢油画黑~~ → **改:落地页/空状态/弹窗与工作台同为平面纯黑**;钢琴卷帘/检查器/密集控件高对比纯白,保证可读。
2. **纯黑 + 纯白(中性单色,去暖金)**(修订自"炭黑+象牙白"):令牌**去色相去饱和**(`chroma 0`),`--color-void`/`--color-bg` = #000,文字/强调 = #fff;**强调 = 更亮的白**,不是金属色——香槟/黄铜金已弃用;功能高亮靠**明度**(T=白 0.96 / D=暗灰 0.82,**去冷铂金色相**);错误仍保留低饱和**陈玫瑰**作为可用性信号(唯一例外)。
3. ~~**静物头图 + CSS 明暗**~~(**已作废**):取消油画底色/噪点/径向渐变/暗角等一切 CSS 材质氛围层,改平面纯黑;不依赖静物图。
4. **彻底编辑化去盒子**(新增):去掉面板/卡片的边框、填充、大圆角,改用纤细发丝分隔线 + 大量留白,内容直接浮在黑底上;检查器/候选/命令栏/引导/弹窗全部去盒子。仅钢琴卷帘保留数据网格必需的结构。
5. **内置 Cormorant 衬线**:自托管 `@fontsource/cormorant-garamond`(300/400/500),`--font-display` 指向它,还原参考的纤细宽字距优雅衬线。
6. **视觉重塑 + 组件拆分**:重映射令牌 + 氛围层,同时把 App.tsx(约 2200 行)拆成可维护组件。

## 4. 非目标

- 不改和声生成算法、评分、候选逻辑(Task 7)。
- 不改认证、云端项目、引导流程的**行为**(只改其外观)。
- 不引入 UI 框架/组件库(Tailwind、MUI 等),沿用原生 CSS + 令牌。
- 不引入图片/视频素材(纯 CSS 氛围)。
- 不做主题切换器(本轮黑色空间是唯一身份,不保留旧绿主题作为可选项)。
- 不重构 reducer / 状态模型 / 业务 hook。

## 5. 设计语言

### 5.1 令牌重映射(global.css)

语义令牌名保持不变(`--color-bg`/`--color-surface`/`--color-text`/`--color-accent`…),只重定义取值,使大部分 App.css 自动跟随。新增"舞台 vs 工作台"两级表面与珍珠/象牙阶(**强调 = 更亮的白,无金属色**)。

**实际取值(2026-06-22 修订:纯黑/纯白中性单色,`chroma 0` 去色相)**:

```css
/* 黑色空间:中性、平面、纯黑 */
--color-void:           oklch(0 0 0)        /* #000 最深舞台,英雄/空状态背景 */
--color-bg:             oklch(0 0 0)        /* #000 主背景 */
--color-surface:        oklch(0.17 0 0)     /* 工作台面板 */
--color-surface-muted:  oklch(0.12 0 0)
--color-surface-raised: oklch(0.22 0 0)     /* 抬升卡片 */
--color-border:         oklch(0.34 0 0)
--color-hairline:       oklch(0.26 0 0)

/* 白色材质 */
--color-text:           oklch(1 0 0)        /* #fff 主白 */
--color-text-muted:     oklch(0.72 0 0)
--color-ivory:          oklch(1 0 0)        /* #fff 高光 */
--color-ivory-dim:      oklch(0.82 0 0)

/* 强调:更亮的白 —— 无金属、无色相 */
--color-accent:         oklch(1 0 0)
--color-accent-strong:  oklch(0.88 0 0)
--color-accent-soft:    oklch(0.40 0 0)     /* 中性石墨,用于边缘光/底色 */

/* 功能色:中性单色,靠明度区分 */
--color-stable:         oklch(0.96 0 0)     /* T 白 */
--color-tension:        oklch(0.82 0 0)     /* D 暗灰(去冷铂金色相) */

/* 状态 */
--color-danger:         oklch(0.62 0.08 25) /* 低饱和陈玫瑰(唯一保留色,可用性信号) */
--color-focus:          oklch(1 0 0)        /* 白聚焦环 */

/* 签名渐变:中性白微光(去蓝调) */
--gradient-warm: linear-gradient(102deg, oklch(1 0 0), oklch(0.78 0 0))
```

阴影保留深色场景的"压暗 + 微光";**不再用顶部柔光/单光源氛围**(已随材质层移除)。

### 5.2 功能色编码(中性单色)

和声功能不用彩虹色,改为**中性明度阶**(去色相):

- **T 主功能 / 稳定**:白(`--color-stable` = oklch(0.96 0 0))。
- **PD 下属**:暗白(`--color-ivory-dim`)。
- **D 属功能 / 张力**:暗灰(`--color-tension` = oklch(0.82 0 0))—— 靠**明度**区别于 T,**去冷铂金色相、不用金**。
- **Color 色彩**:中性暗白,与 T 区分仅靠明度。

候选条三种风格(stable/pop/color)靠明度与排版区分,不靠饱和色块。

### 5.3 排版

- 保留 UI 无衬线(`--font-ui`)与音乐数据等宽(`--font-mono`)。
- 新增 `--font-display`:优雅衬线(系统衬线栈,如 "Hoefler Text", "Iowan Old Style", Garamond, "Times New Roman", Georgia, serif),用于品牌/英雄/分区标题,营造画廊/静物的编辑气质。本地优先,不绑定外部字体(后续可选自托管)。
- 大标题加大字距与负 leading,衬线 + 象牙白,呈"美术馆标牌"感。

### 5.4 氛围与材质 ~~(纯 CSS)~~ — **已移除(2026-06-22)**

> 炭黑暖调 + 噪点 + 油画暗角实际显脏。**全部 CSS 材质/氛围层已删除**,改平面纯黑:
> - 删 `body::after` 胶片噪点(`feTurbulence`)。
> - 删 `.stage-atmosphere` 暖光 + 暗角径向渐变 → 退化为 `background: var(--color-void)`(纯黑)。
> - 删 `.app-shell` / `.landing-shell` 的径向光晕/暗角 → 平面纯黑底。
> - `--gradient-warm` 去蓝调 → 中性白微光。
>
> **保留(属功能层,非材质)**:玻璃体系(nav/登录/抽屉的 `backdrop-filter` 模糊)、英雄区
> FloatingLines 之上的文字易读性 scrim(`.hero-screen::before` / `.landing-hero::before`,基于纯黑)。
> 音符/和弦块/候选卡仍是纯白形体 + 亮白选中边,但不再有"内部柔光/白瓷材质"。

## 6. 任务拆分

> **实施状态(截至当前)** — 视觉基础已落地,布局讨论已冻结(等 T6.6 做动效)。
>
> - ✅ **T6.1 令牌重映射** — 完成,且已**二次修订(2026-06-22)**:从"炭黑+象牙白暖调"改为**纯黑 #000 + 纯白 #fff 中性单色**(`chroma 0`,去冷铂金色相);仅 `--color-danger` 保留低饱和陈玫瑰(见 §3 决策 2、§5.1)。
> - ✅~~🗑️~~ **T6.2 氛围材质** — **已作废并移除(2026-06-22)**:SVG 颗粒 + 单光源径向渐变 + 暗角实际显脏,全部删除改平面纯黑(见 §5.4)。
> - 🔄 **T6.3 舞台表面** — Cormorant 标题、编辑式排版已落地;**落地页 §9 多屏重设计已实现**(见下)。
> - ✅ **T6.4 工作台克制化** — 完成(彻底去盒、奢侈留白、去金单色、卷帘外框开放);**专家工作台 §10 卷帘最大化仍待做**。
> - ➕ **新增进展**:
>   - ✅ **§9 落地页多屏重设计** — 已实现。`src/components/landing/`(`Landing` + `HarmonyDemo` + `Carousel` + CSS),取代旧 workflow-intro/section/workspace-preview。含 §9.0 磨砂玻璃胶囊 nav、§9.1 真 100dvh 英雄(FloatingLines 离屏 `paused` 暂停)、§9.2 真实引擎 demo + 试听、§9.3 发丝线便当、§9.4 React Bits Carousel(`motion`+`react-icons`,DOM 非 WebGL)、§9.5 CTA、§9.6 scroll-snap。
>   - ✅ **§9.8 玻璃体系** — 完成。胶囊 nav + AuthPanel(`.auth-card`)+ ProjectsPanel(`.projects-drawer`)统一深烟玻璃(半透明 void + backdrop blur + 象牙发丝边 + 顶部高光);表单输入框给更实内表面保可读;`-webkit-` 前缀 + `@supports not` 无 backdrop-filter 兜底为更实底色。
>   - ✅ **§10 专家工作台重构** — 完成。`.workspace-grid.is-expert` 作用域:卷帘最大化(单列 + `.melody-window` 放大,见 §10.5)、检查器变玻璃侧抽屉(`.inspector.inspector-sheet.is-open`,**点和弦/声部才滑出**,空闲卷帘吃满整宽)、走带变底部悬浮玻璃细条、候选条紧凑化。**DOM/className 不变**,verify 脚本 t4/t5-2/t5-3/t5-4/t5-5 全绿(桌面+移动);移动端抽屉退化为全屏 sheet。
>   - ✅ **§10.5 引导模式卷帘对齐** — 卷帘放大(`min(46vh,460px)`)提到共享基样式,引导/专家同一套去金象牙卷帘。
>   - ⚠️ **遗留(与本轮无关)**:旧 verify 脚本 t2-1..t2-8、t3-7 在落地页因 Task 5 登录软门槛遮罩拦截"Open Workspace"点击而失败(应改为走 `.auth-demo-link` 入口,与 t5 脚本一致);属 Task 5 门槛 + §9 落地页改名的遗留,非专家重构所致。
> - ✅ **T6.5 组件拆分** — 完成。布局定稿(§11 Phase A/B)后,把 `App.tsx`(2210 行)拆出 8 个
>   工作台组件 + 2 个纯模块,**DOM/className 与行为不变**:
>   - 纯层:`src/app/pianoRollLayout.ts`(音高行/网格坐标/候选选择等纯函数,`midiForDraggedPitch`
>     测试改从此处导入)+ `src/app/workspaceConstants.ts`(`DURATION_OPTIONS`/`KEY_OPTIONS`/
>     `PLAYBACK_TONE_OPTIONS`/`GUIDE_STEPS`)。
>   - 组件 `src/components/workspace/`:`CommandBar`、`PianoRoll`、`HarmonyLane`、`CandidateStrip`、
>     `Inspector`、`Transport`、`SettingsFields`、`GuideOverlay`(rail+coach 弹窗)。
>   - 状态/handler/effect/引导门槛机器仍集中在 `App`,以显式 props 下传;不动 reducer。
>   - `App.tsx` 2210 → 1460 行(−34%)。`tsc`/`build`/71 tests 绿;verify **t4 + t5-2/4/5 桌面+移动全绿**
>     (无横向溢出、引导弹窗映射、隐私文案);保留 `.auth-demo-link` 软门槛入口。
>     注:拆分中一度误删着陆页 `screen === "landing"` 早返回(导致直接进工作台),已通过 Playwright
>     DOM 自检发现并修回——拆分务必校验首屏分流。
> - ✅ **T6.6 动效与可访问性** — 完成(2026-06-22)。动效哲学 = **"白色形体从黑里浮现"**(克制留白档:只 `opacity`+小幅 `translateY`+一条慢 ease-out,无弹跳/旋转)。
>   - 地基(`global.css`):动效令牌 `--dur-fast/base/slow`、`@keyframes emerge`(浮现)/`fade`(原地显影)/`slide-in-right`(右抽屉)、**全局 `prefers-reduced-motion: reduce` 安全网**(把所有 animation/transition 降到 ~0)。
>   - 入场(`App.css`):**签名时刻=生成即显形**(候选条三卡 `emerge` + 极小错峰 55/110ms;和声卷帘 chord-block/声部 `fade` 原地显影);音符 `fade`;恢复/迁移/消息/和声过期 banner `emerge`;登录卡/引导弹窗 `emerge`+遮罩 `fade`;项目抽屉 `slide-in-right`。
>   - 微交互:按钮按下 `translateY(1px)`(原有)+ focus-visible 白环扩展到 `[tabindex]`/`a`/`summary`(纯黑上 2px 可见)。
>   - **键盘 a11y**:新增 `src/app/useDialog.ts`——弹窗/侧抽屉/项目抽屉/登录 **Esc 关闭 + 打开移焦、关闭还焦**(GuideOverlay/Inspector/AuthPanel/ProjectsPanel);**DOM/className 不变**。
>   - 验证:`tsc`/`build`/71 tests 绿;verify **t4 + t5-2/4/5 桌面全绿**;Playwright 实测动效结束态 `opacity:1`(不卡 0)、reduced-motion 下同样静态可用;截图自检满铺/显形。
> - ✅ **T6.7 回归测试与浏览器验证** — 完成(2026-06-22,统一收口)。
>   - 三件套:`tsc -b`(0)/ `vitest`(**71 passed**)/ `vite build`(✓)全绿。
>   - verify 全套桌面+移动:**t4 + t5-2 / t5-3(真 Supabase 云端往返)/ t5-4 / t5-5 全绿**。
>   - 浏览器自检:落地页 + 工作台在 **1440 与 390** 两档**均无横向溢出**(`scrollWidth ≤ clientWidth`);`body` 背景实测 `oklch(0 0 0)` 纯黑;键盘 Tab 焦点环实测 **2px 纯白**(`oklch(1 0 0)`)可见;reduced-motion 下入场结束态 `opacity:1` 不卡。
>   - 移动端退化正常:命令栏纵向堆叠、候选条三列、和声抽屉贴底。
>
> **Task 6 至此全部完成(T6.1–T6.7)。**

### T6.1 令牌重映射与基础

目标:把设计系统从"森绿+米白"切到"黑色空间 + 象牙白(去金单色)"。

- 重定义 [src/styles/global.css](../src/styles/global.css) 的颜色令牌(见 5.1),含 `--color-void`、象牙阶、珍珠白强调、陈玫瑰、淡象牙聚焦。
- 重定义阴影/渐变令牌为深色场景版本;`--gradient-warm` 改为珍珠白微光。
- 新增 `--font-display` 衬线栈。
- `body`/`:root` 背景切到黑色空间;聚焦环改淡象牙。

验收:全站底色变为黑色空间,象牙白文字,淡象牙聚焦;无残留绿色与金色;`tsc`/`build`/`test` 通过。

### T6.2 氛围与材质层(纯 CSS)

目标:加入油画底色、暗角、画布颗粒、单光源柔光。

- 用 CSS 多层径向渐变实现舞台暗角 + 顶部暖柔光。
- SVG 噪点 overlay(内联 data-uri 或 CSS),低强度,舞台强/工作台弱。
- 提供可复用的氛围 class(如 `.stage-surface` / `.canvas-grain`)。
- 尊重 `prefers-reduced-motion`,氛围为静态不闪烁。

验收:舞台面有可见油画质感与暗角,工作台面有克制织理且不伤可读性;无明显性能下降。

### T6.3 舞台表面重塑

目标:落地页、空状态、弹窗、英雄区、候选卡走满溢油画黑 + 象牙显形。

- 落地页:黑色舞台 + 衬线大标题 + 象牙副文 + 象牙白 CTA;英雄改 FloatingLines(象牙/珍珠线条)。
- 空状态:"空白舞台",单个象牙形体"显形"的隐喻。
- AuthPanel / ProjectsPanel:深烟玻璃面板,象牙文字,象牙白主按钮。
- 候选卡:象牙静物卡,选中亮白边缘光。

验收:首屏与弹窗呈作品级艺术气质;关键文字仍清晰可读。

### T6.4 工作台克制化

目标:命令栏、钢琴卷帘、和声窗口、检查器、引导外壳在深色下保持高可读。

- 工作台面板用炭黑 + 象牙白数据,边框/网格线低对比但清晰。
- 钢琴卷帘:黑白键改象牙/炭黑材质;音符为象牙雕塑块;播放头/选中/激活用亮白。
- 和弦块/声部:象牙物体 + 亮白 rim 标记选中与正在播放。
- 检查器:象牙数据行,亮白强调关键值;功能标签按 5.2 编码。
- 引导步骤条/教练卡:当前步亮白填充,已完成暗象牙,未达暗炭。
- 对比度:工作台关键文字达 WCAG AA。

验收:钢琴卷帘与检查器在黑色下清晰可用,选中/激活/播放头一眼可辨;移动端无溢出。

### T6.5 组件拆分

目标:把 App.tsx 拆成可维护组件,**行为与 DOM/className 不变**(保护测试与验证脚本)。

- 抽出:`Landing`、`CommandBar`、`TimelinePanel`(可再分 `PianoRoll`/`HarmonyLane`)、`CandidateStrip`、`Inspector`、`GuidedShell`(rail+coach)。
- 状态/handler 仍集中在 `App`,以 props 下传(或必要时轻量 context),不改 reducer。
- 保持现有 className 与 DOM 结构,避免打断 verify 脚本与未来测试。

验收:App.tsx 显著瘦身,功能与现状逐一致;`tsc`/`test`/`build` 通过;既有浏览器验证仍绿。

### T6.6 动效与可访问性

目标:象牙形体"显形"的克制动效 + 可访问性。

- 生成/候选切换/弹窗:象牙形体从暗部柔和浮现(fade/emerge),不喧宾夺主。
- 淡象牙聚焦环贯穿可聚焦元素;键盘可达不破坏。
- 全程尊重 `prefers-reduced-motion`(降级为无动效)。
- 关键文字对比度自查(舞台允许更戏剧,但不牺牲核心可读)。

验收:动效克制优雅;reduced-motion 下静态可用;键盘焦点清晰。

### T6.7 回归测试与浏览器验证

目标:避免视觉重塑与拆分引入回归。

- `tsc -b` / `vitest run` / `vite build` 全通过。
- 既有 verify 脚本(t4、t5-2…t5-5)在 className 不变前提下仍可跑;如有必要更新选择器。
- 新增 Task 6 视觉验证:深色主题生效、关键区无横向溢出、桌面/移动端截图、聚焦环可见、reduced-motion 截图。

验收:四项构建/测试全绿;浏览器验证覆盖深色主题、可读性、无溢出、组件拆分后流程不变。

## 7. 建议实施顺序

1. **T6.1** 令牌重映射(地基,改一处带动全局)。
2. **T6.2** 氛围材质层(纯 CSS 氛围工具)。
3. **T6.3** 舞台表面重塑(戏剧面)。
4. **T6.4** 工作台克制化(可读面)。
5. **T6.5** 组件拆分(结构,视觉稳定后再拆,降低风险)。
6. **T6.6** 动效与可访问性。
7. **T6.7** 回归与浏览器验证。

原因:令牌先行,改一处带动全局;氛围工具就绪后分别打磨舞台与工作台;视觉稳定后再做组件拆分,避免视觉与结构同时变动难以定位问题;动效与可访问性收口;测试最后统一补齐。

## 8. 风险与注意点

- **可读性是红线**:黑色下密集数据(钢琴卷帘、检查器)必须达 AA;戏剧只在舞台面,不侵蚀工作台。
- **拆分不改行为**:T6.5 保持 className/DOM 结构,保护 verify 脚本与测试;先视觉后拆分,降低同时变动风险。
- **纯 CSS 氛围性能**:噪点/多层渐变注意不拖慢滚动与播放;颗粒用静态 overlay 而非动画。
- **不用金,强调 = 更亮的白**:香槟/黄铜金已弃用(不贵气、显土豪);强调靠明度(珍珠/象牙白),D 属功能用一丝冷铂金;仅用于强调/功能高亮/聚焦/选中。
- **令牌语义保持**:沿用现有令牌名,避免大面积改 class;新增令牌而非重命名。
- **范围克制**:不碰算法(Task 7)、不改认证/云端行为、不引框架。

## 9. 着陆页重设计(产品方布局构想 + 评价)

> 本节由产品方口述布局、AI 评价整理,作为后续实现依据。叙事骨架:**钩子(英雄)→ 让我试(交互 demo)→ 这是给谁的(便当)→ 它能做什么(carousel)→ 行动(CTA)**。全程英文文案(落地页英文专属)、黑+象牙/珍珠白单色、Cormorant 标题 / sans 正文 / mono 音乐数据、大留白、去盒子。
>
> 进展中的视觉基础(已落地):FloatingLines 英雄、去金单色、奢侈留白、Cormorant、`prefers-reduced-motion` 兜底、WebGL 兜底。新结构将**取代**现有的 workflow-intro + 三个 workflow-section + workspace-preview 图。

### 9.0 导航 · 磨砂玻璃胶囊 nav(随滚动浮动)

- 构想:顶部导航换成**半透明磨砂玻璃胶囊**,浮动跟随视口。
- 评价/要点:近黑页面上做玻璃,底色用**半透明深烟色** + `backdrop-filter: blur`,加一根极淡象牙发丝边 + 顶部微高光;**不要白磨砂**(会脏)。
- 风险:`backdrop-filter` 带 `-webkit-` 前缀 + 不支持时兜底底色;滚动后加一档状态(更聚拢/更实/加投影);`scroll-padding-top` 防锚点被盖;z-index 在 FloatingLines 之上、弹窗之下;键盘可达。

### 9.1 第一屏 · 英雄(FloatingLines 满屏)

- 问题:当前 FloatingLines 没铺满首屏,下方有缝。根因是英雄高度 `100dvh - 96px`(减的是估算 nav 高)与实际 nav + shell 内边距对不齐。
- 解法:nav 改浮动覆盖后,英雄做成**真正 100dvh 满屏**,FloatingLines 绝对填满,nav 浮于其上;确认 canvas ResizeObserver 撑满全高;英雄与下一屏**零 margin 接缝**。
- 内容:Cormorant "Harmony, heard." + sans 副标 + 中点 tagline + 主/次 CTA(沿用现有)。

### 9.2 第二屏 · 简化和声生成交互体验区

- 构想:一个**简化的和声生成交互**,让访客先试再进。
- 评价:转化力最强,但**最重**,需控范围。
- **已定**:用**真实引擎 + 允许试听**。轻量版——预置短旋律 + "Generate" 按钮跑真实 `generateHarmonyCandidates` → 显示 3 个和弦 chip + 理论标签 + **播放试听**(用户手势触发 AudioEngine、懒加载音色)。**不要搬整个工作台**,只给一口尝鲜。

### 9.3 第三屏 · 响应式便当盒(目标用户)

- 构想:便当盒写目标用户:**作曲者 / 内容创作者 / 学生**。
- 评价/要点:便当不对称尺寸适合 3 个异构人格;延续去盒子——格子用**留白 + 发丝线 + 编号/标签**定义,而非填色重卡;移动端塌成纵向堆叠;每格 = 人格 + 一句需求 + 极简视觉符号。

### 9.4 第四屏 · Carousel(核心功能)

- 构想:用组件库的 **carousel** 展示核心功能。**已确认**用 React Bits 的 `Carousel`(产品方现找的,`carousel.txt`)。
- 特性:**DOM + Framer Motion**(`motion/react`),**非 WebGL**;依赖 `motion` + `react-icons`。props:`items`(icon/title/description/id)、`autoplay`/`autoplayDelay`、`pauseOnHover`、`loop`、`round`、`baseWidth`;支持拖拽。
- 利好:不是第二个 WebGL,**性能担忧消除**(全页仅 FloatingLines 一个 WebGL)。
- 要点:`items` 填**核心功能卡**(MIDI 导入 / 手动输入 / 三风格生成 / 试听对比 / 导出 / 理论解释),配 Feather 图标或自定义;单色化样式(去金、象牙白、发丝边);`baseWidth` 适配响应式;`round={false}` 走卡片态。

### 9.5 第五屏 · CTA

- 构想:最后一屏做 CTA。
- 建议:Cormorant 大标题 + 一个象牙白主按钮 + 一句话,极简"谢幕舞台";可留极淡 FloatingLines 余韵或纯黑。

### 9.6 跨屏统一要求

- **性能预算**:全页仅 FloatingLines 一个 WebGL(carousel 是 DOM/Framer Motion,不算);离屏暂停 FloatingLines 渲染 + 尊重 `prefers-reduced-motion`;新增依赖 `motion` + `react-icons`。
- **滚动系统**:是否整屏 scroll-snap;浮动 nav 覆盖;锚点 `scroll-padding-top`。
- **一致性**:单色黑+象牙/珍珠白;Cormorant / sans / mono 三档字;大留白;去盒子(发丝线 + 空白,不用重卡)。
- **动效**:scroll-reveal 形体浮现,克制;reduced-motion 降级静态。

### 9.8 玻璃体系(nav + 登录 + 项目抽屉)

- 构想:登录界面也做**磨砂玻璃质感**(与 9.0 胶囊 nav 统一)。
- 评价:nav + AuthPanel + ProjectsPanel 统一成"深烟色玻璃"体系,贵气且一致;叠在动的 FloatingLines 上,透出模糊线条余韵很美。
- 要点:玻璃卡 = 半透明深烟底 + `backdrop-filter: blur` + 发丝边 + 顶部微高光;**表单输入框单独给一层更实的内表面**保证可读;遮罩底色够暗;`-webkit-` 前缀 + 不支持兜底;动态 WebGL 上 blur 有 GPU 成本,低端设备可降级为更实底色。

### 9.9 已拍板 / 待定

- ✅ 第四屏 carousel = React Bits `Carousel`(DOM/Framer Motion)。
- ✅ 第二屏 demo = 真实引擎 + 允许试听。
- ✅ 整屏 **scroll-snap** = 要。
- ✅ 落地页**全英文**(工作台才双语)。
- ✅ 登录/抽屉 = 磨砂玻璃。
- (无遗留待定)

## 10. 专家模式工作台重构(卷帘最大化 + 信息按需)

> 注意:这是**信息架构 + 交互**的改动,不只是 CSS。会与 T6.5 组件拆分、verify 脚本一起动,比纯视觉重——单列为一节。引导模式(Task 5 的分步流程)不变;本节只改**专家视图**。

### 10.1 目标

- 钢琴卷帘占比**尽可能大**,成为工作台主角,大气美观。
- 其余信息(检查器/候选/走带/设置)从"常驻控件墙"改为**按需交互呈现**,不挤占卷帘。

### 10.2 信息按需的呈现方式(建议)

- **检查器** → 选中和弦/音符时**滑出侧抽屉或浮层**(side-sheet / popover),不再常驻右栏;空闲时卷帘吃满整宽。
- **走带控制** → 底部**悬浮细条**(play / from-start / from-bar / mute / beat),半透明、自动常驻、不抢戏。
- **候选 A/B/C** → 紧凑切换(卷帘上方小分段控件或浮动切换),不再是底部大卡条。
- **设置 / 生成** → 命令栏极简按钮(沿用),设置走 tray。

### 10.3 卷帘"大气美观"要点

- 更大的行高与可视音域,更克制的网格线(发丝级),象牙音符为绝对焦点。
- 旋律窗 + 和声窗占满主区宽度;横向滚动顺滑;播放头/选中/激活用亮白(去金)。
- 留白与对齐替代边框;窗体为柔面板(已去外框)。

### 10.4 风险

- **可发现性**:信息藏进交互,需保留 affordance(hover 提示、选中即弹、空态引导),否则用户找不到。
- **结构改动**:检查器变浮层/抽屉会改 DOM,**需同步更新 verify 脚本**;与 T6.5 拆分一起做更省。
- **两种模式共存**:引导(分步)与专家(卷帘最大化)共享同一份 AppState,交互模式不同但数据一致,切换不丢。
- **移动端**:专家视图在窄屏退化策略(抽屉变全屏 sheet,走带条贴底)。

### 10.5 引导模式(只对齐卷帘,不改流程)

- 引导模式服务专业性不高 / 对流程不熟的人群,**当前分步结构没问题,保留**。
- 唯一改动:把**钢琴卷帘等内容与专家模式对齐**(同一套放大、美观、去金的卷帘与音符样式),让两种模式视觉一致。
- 不改引导的步骤逻辑、不改其按需披露;只是共享升级后的卷帘组件。

## 11. 工作台舞台化重构(卷帘为主体 / 和声抽屉 / 模式合一 + 引导弹窗)

> 产品方在 §10 之后提出更进一步的工作台 IA 改造:**钢琴卷帘成为页面主体,其余组件为附属**;
> 旋律卷帘为全屏舞台,**和声收进底部抽屉**(点击展开和声卷帘);并**取消强制区分专家/引导**——
> 默认即专家工作台,**引导改为按需弹窗向导**,操作映射到同一份工作台状态。
>
> 这会**改动 Task 5 引导流程的行为**(§4 原非目标已被产品方明确解除),且 DOM 改动较大,
> 单独列为详细子任务清单:见 [TASK6-workbench-stage.md](TASK6-workbench-stage.md)。
> 分两阶段:**Phase A** 舞台 + 和声抽屉(纯结构,先不动模式);**Phase B** 模式合一 + 引导弹窗
> (重写 verify-t5-4)。两阶段均未开始(已勘察结构)。
