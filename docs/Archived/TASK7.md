# Task 7: 和声生成重做（引擎 + 体验双轨）

> 本文件锁定 Task 7 的方向、边界与分阶段计划。起因:Task 1–6 已交付完整产品,但**和声生成**
> 这条线有两个并存的问题——① 算法仍是 Task 1 时的手写贪心启发式;② 它的**交互/呈现**在 §10/§11
> 卷帘最大化里被降级了(风格选择还是最初的三格、检查器被吞成按需侧抽屉)。产品方决定**不在旧基础上
> 修补,而是把"和声生成相关"整条线连引擎带体验一起重做**。
>
> **双轨**:**第一轨 = 引擎**(§1–§10,Tonal + Viterbi);**第二轨 = 和声体验**(§11,阶段化 IA +
> 风格流 + 解释回归)。两轨互相牵引:引擎产出更丰富 → 体验要给它呈现的空间;体验要展示什么 → 引擎要
> 算出对应的解释。**不动**:reducer/状态模型、钢琴卷帘编辑机制、音频引擎、认证/云端、纯黑白视觉令牌。

## 0. 一句话方向

> **引擎**:用 [Tonal](https://github.com/tonaljs/tonal) 把"音乐理论词汇"做对做全 → 在它之上,
> 参考学术标准 HMM/Viterbi 蓝图自己写"和弦选择引擎",保留功能标注(T/PD/D)与可解释性。
> **体验**:阶段化布局——**编辑阶段卷帘是主角且不出现任何和声 UI,和声阶段和声升为主角**;风格
> 三档预览→选一档深挖;解释回归一等常驻(只在和声阶段)。
>
> 一句话:**Tonal 负责"音乐对不对",我们负责"选得好不好",体验负责"让人看得懂、用得顺"。**

调研结论(2026-06-22):GitHub/npm 上**没有**可直接用的、确定性且可解释的浏览器 JS 旋律→和弦
和声器;现成的真和声器多是 Python + 深度模型(NADE / Transformer)或方向相反的 Magenta(和弦→旋律),
均与本产品"可解释/教学/轻量确定性"身份冲突。但有两块现成的好东西:**Tonal**(理论库)+
**HMM/Viterbi**(学术标准且可解释的算法蓝图,见 [Comparative Study](https://arxiv.org/pdf/2001.02360)、
主打 interpretable 的 [BacHMMachine](https://arxiv.org/pdf/2109.07623))。

## 1. 现状快照(实现前)

流水线三步,**确定性、可解释、纯启发式**:

1. **切段** [segmentMelody.ts](../src/music/harmony/segmentMelody.ts):按节奏型(bar/strong-beats/
   every-beat/cadence-aware/sparse)切"和声段",一段 = 一个和弦。
2. **打分** [scoreChords.ts](../src/music/harmony/scoreChords.ts):和弦 vs 段内旋律音,按音-和弦音
   关系加权(根 2.1 / 三 2.4 / 五 1.8 / 七 1.5 / 延伸 1.2 / 非和弦音 −1.1)× 时值 × 强拍系数,产出
   契合分 + 可读理由 + 非和弦音警告。
3. **生成三候选** [generateCandidates.ts](../src/music/harmony/generateCandidates.ts):
   - **stable-classical**:大调七和弦调色板,**逐段贪心**(仅 1 步回看),叠功能进行奖励 + 终止式奖励 +
     非和弦音惩罚。
   - **pop-songwriting** / **color-tension**:**两个写死的 4 和弦循环**,按 `index % 4` 取,旋律契合
     只能小幅改写。

**理论层**:[chords.ts](../src/music/theory/chords.ts) 手写音程表,**仅大调**(小调 UI `disabled`),
词汇少(三和弦 + Imaj7/V7 + 两个固定集)。

### 现状的真实局限(Task 7 要解决的)

1. **贪心、无全局最优**:局部好 ≠ 整体顺。
2. **流行/色彩不是"生成",是套模板**;三模式靠"硬编码不同调色板"区分,不是同一引擎的不同风格档。
3. **只有大调**,无小调/调式/系统性借用。
4. **无声部进行(voice leading)**:只评竖向契合,不评横向平滑;声部是显示用固定排布,不参与决策。
5. **词汇有限**:无系统副属、转位、挂留、按上下文选七/九和弦。
6. **不区分结构音与经过音**:弱拍经过/邻音照样扣分,可能错杀好和弦。
7. **和声节奏全靠手选**,不会从旋律自动找乐句/终止点。

**强项(必须保留)**:**每个选择都有人话理由** —— 这是产品"引导/教学"身份的根。因此 Task 7
**不走不可解释的 ML**,走**有原则、可检视**的 HMM/Viterbi。

## 2. 目标与非目标

### 目标
- 用 Viterbi **全局最优**替换贪心,进行更顺、终止式更稳。
- 三风格变成**同一引擎的三套权重档**(真生成、真有别),不再写死循环。
- 引入 **Tonal** 作理论底座,**白送小调 + 调式 + 副属 + 转位 + 扩展和弦**词汇与正确性。
- 引入**声部进行**作为转移代价的一部分(低音/内声部平滑、避免平行)。
- **全程保留可解释性**:每个发射/转移都有命名理由,喂给检查器/引导。
- **引擎的数据 API 稳定**:`generateHarmonyCandidates(melody, settings)` 与 `ChordDefinition`/
  `PlacedChord`/`ChordExplanation`/`HarmonyCandidate` 形状保持稳定(可**新增**字段承载更丰富解释,
  但不破坏既有),让第二轨 UI 消费同一份更丰富的数据。
- **体验目标(第二轨,详见 §11)**:阶段化布局、编辑阶段无和声 UI、风格三档预览→深挖、解释回归一等。

### 非目标
- 不引入 ML / 深度模型 / Magenta / TF.js(黑盒、体积大、不可解释,与身份冲突)。
- 不做音频域分析(音高检测等)。
- 不改**认证 / 云端 / 纯黑白视觉令牌 / reducer 状态模型 / 钢琴卷帘的编辑机制**(本轮重做的是
  "和声生成相关"的算法与呈现,不是整个 app)。
- 不做实时/后端;保持浏览器内同步、确定性。
- 不追求"四部和声写作"级别的严格对位(声部进行做到"更顺"即可,不做学术级配置)。
- **注意**:第二轨会改 `CandidateStrip`/`Inspector`/`HarmonyLane`/工作台布局的 DOM 与 className,
  **相关 verify 脚本(t4 等)需同步更新**——不再是"UI 不动"。引擎轨保持数据 API 稳定不在此列。

## 3. 设计决策(已确认)

1. **Tonal 藏在领域类型背后**:新增薄适配器 `Tonal 和弦 → 我们的 ChordDefinition`,补 `functionLabel`/
   `roman`/解释钩子。Tonal 的数据结构**不漏到 app 其他部分**。风险可控、增量替换。
2. **功能标注(T/PD/D/Color)我们自己掌**:Tonal **不提供**功能和声标签。我们维护大调/小调的功能表
   (Tonal `Key.*.chordsHarmonicFunction` 可作参考起点,但最终以我们的表为准)。
3. **发射分复用现有打分**:[scoreChords.ts](../src/music/harmony/scoreChords.ts) 已不错且可解释,
   直接当 Viterbi 的发射函数,不重写。
4. **目标函数 = 现状的全局版**:现状贪心已经在算 `发射 + 功能进行(回看1) + 终止式(看位置)`;
   Viterbi 用**同一目标**做整条最优。概念跳跃小、质量提升大。
5. **三风格 = 三套转移/调色板权重档**,共用一个引擎。
6. **分阶段**:先**换内核**(Viterbi + Tonal 大小调),跑通并对比;再**扩词汇**(副属/转位)与
   **拟真**(声部进行 v2 / 旋律约简)。每阶段独立、可验证、可回退。

## 4. 架构与数据流

```
melody, settings
   │
   ├─ segmentMelody()                         ← 复用(可能后续做"自动和声节奏")
   │     → HarmonySegment[]
   │
   ├─ buildStatePalette(key, styleProfile)    ← 新:用 tonalAdapter 产出该调/风格的候选和弦全集
   │     → ChordDefinition[]  (大调/小调 diatonic + 风格允许的副属/借用/转位)
   │
   ├─ 每段每候选: scoreChordForSegment()       ← 复用:发射分 E(chord, segment) + 解释
   │
   ├─ viterbi(segments, palette, profile)     ← 新:
   │     emission(seg, chord)  = E + 位置项(终止式/乐句)
   │     transition(prev, cur) = 功能进行权重 + 声部进行平滑 − 风格惩罚
   │     → 全局最优 ScoredChord[]
   │
   └─ makePlacedChord() → HarmonyCandidate     ← 复用
```

### 文件计划
- **新增** `src/music/theory/tonalAdapter.ts`:`Tonal → ChordDefinition`;按调(大/小/调式)产出
  diatonic 和弦集 + 罗马数字;按风格构造副属(`V/x`)、借用、转位。封装所用 Tonal 模块
  (`Key.majorKey`/`Key.minorKey`、`Chord.get`、`Note.transpose/midi`、`Interval`、`RomanNumeral`)。
- **新增** `src/music/harmony/viterbi.ts`:通用 Viterbi(状态序列最优路径,加权可配)。
- **新增** `src/music/harmony/transitions.ts`:转移代价(功能进行表 + 声部进行)+ **风格档**定义 +
  位置项(终止式/乐句)。
- **改** `src/music/harmony/generateCandidates.ts`:编排上面各步;**公开 API 不变**。
- **保留** `scoreChords.ts`(发射)、`segmentMelody.ts`、`displayVoicing.ts`、`chordAlternatives.ts`。
- **逐步收缩** `chords.ts`:其能力迁到 tonalAdapter;`relationshipToChordTone`(打分用)保留或平移。
- **依赖**:`pnpm add tonal`(或按需 `@tonaljs/*` 子包,tree-shake 控体积)。

## 5. 算法细则

### 5.1 状态与发射
- **状态**:每段的候选和弦来自 `buildStatePalette`(该调 diatonic + 风格允许的扩展)。为控状态空间,
  按发射分**剪枝**(每段保留 Top-K,如 K=8)。
- **发射** `emission(seg, chord)` = `scoreChordForSegment(...)` 的分 + **位置项**:
  - 终止式:末段偏好 T/I,倒二段偏好 V/D(沿用现 `cadenceBonus` 思路,作为位置相关发射项)。
  - 空段(无旋律音):按功能给基础分(沿用现状)。

### 5.2 转移
`transition(prev, cur, profile)` = 加权和:
- **功能进行**:`T→PD +`、`PD→D +`、`D→T ++`、`D→PD −` 等(沿用现 `motionBonus` 的方向,数值入风格档)。
- **声部进行**(分阶段):
  - **v1(本轮)**:低音根音运动偏好(顺阶/四五度优于大跳)+ 公共音保持的粗略估计。
  - **v2(后续)**:基于实际 voicing 的总移动量最小化 + 避免平行五/八度。
- **风格惩罚**:对"Color/非diatonic/副属/借用"的容忍度按风格档不同(古典严、色彩松)。

### 5.3 Viterbi
- 标准 DP:`best[i][c] = emission(i,c) + max_p ( best[i-1][p] + transition(p,c) )`,回溯取路径。
- **确定性**:并列时按稳定 tie-break(如和弦 id 字典序),保证可复现。
- 复杂度 `O(段数 × K²)`,K 剪枝后很小,浏览器内同步秒回。

### 5.4 三风格档(初版设定,实现时微调)
| 维度 | stable-classical | pop-songwriting | color-tension |
|---|---|---|---|
| 调色板 | diatonic(含 Imaj7/V7) | diatonic + 常见转位(顺低音) | diatonic + 副属 + 借用 + 9th |
| 功能进行 | 强(严格 T-PD-D-T) | 中(容忍循环/重复) | 弱(允许离调色彩) |
| 终止式 | 强 | 中 | 中 |
| Color 惩罚 | 高 | 中 | 低/奖励 |
| 声部进行 | 中 | 高(平滑低音) | 中(允许半音色彩) |

### 5.5 小调与调式
- Tonal `Key.minorKey(tonic)` 给 natural/harmonic/melodic 的和弦集与罗马数字 → 我们补小调功能表
  (i, ii°, III, iv, V(取自和声小调), VI, vii° 等)。**打开 UI 里 `disabled` 的小调选项**。
- 调式(dorian/mixolydian 等)作为 pop 友好选项,**列入后续阶段**,非第一版必须。

## 6. 词汇范围(分阶段)

- **P1(换内核)**:大调 + **小调** diatonic(含 7th);三风格全部走 Viterbi + 风格档。**先达到/超过现状**。
- **P2(扩词汇)**:**副属(V/x)、借用(modal interchange)、转位/slash(顺低音)**;扩状态空间,
  转移处理 tonicization。
- **P3(拟真)**:**声部进行 v2** + **旋律约简**(弱拍经过/邻音先识别再打分)。
- **P4(可选)**:调式;自动和声节奏(从旋律找乐句/终止点),替代手选节奏型。

## 7. 可解释性(红线)

每个被选和弦仍产出 `ChordExplanation`:
- **fit**:发射层给的旋律契合理由(现有)。
- **function**:功能 + **进行理由**(从 transition 的命名项生成,如"属解决到主""下属准备属""副属离调到 vi")。
- **warnings**:非和弦音(现有)+ 新增(如平行五度、未准备的离调)。
- 检查器"备选和弦" [chordAlternatives](../src/music/harmony/chordAlternatives.ts) 改为从同段的 Viterbi
  候选/Top-K 取,理由一致。

## 8. 验证策略

- **单元测试**:发射单调性(和弦音覆盖越多分越高);Viterbi 在构造旋律上选到已知最优;末段落 T;
  小调产出小调 i;副属正确解决。
- **黄金用例**:一组参考旋律(demoMelody/longDemoMelody + 新增)+ 期望进行**或不变式**
  (如"以 I/i 收束""强拍无未准备的持续非和弦音""三风格进行互不相同")。
- **A/B 对比脚本**:打印"现状 vs 新引擎"对各 demo 旋律的进行,供人工试听对比(放 `scripts/`)。
- **回归**:`tsc`/`vitest`/`build` 全绿;现有 `harmony.test.ts`/`chordAlternatives.test.ts` 有意更新
  (输出会变,改为断言不变式而非具体和弦)。**引擎轨**只改数据、不动 DOM,verify 不受影响;
  **体验轨(§11)**会改和声 UI 的 DOM/className,verify t4 等需同步更新(见 §11)。

## 9. 风险与红线

- **Tonal API/体积**:按需引子包、tree-shake;Tonal 本身小(非 Magenta 那种 MB 级)。
- **解释连续性**:Tonal 不给功能标签 —— 功能表与进行理由是**我们的核心资产**,自己维护。
- **状态空间膨胀**:扩词汇后用 Top-K 剪枝 + 调色板上限控住 K²。
- **输出变化打破旧测试**:用黄金用例 + 不变式重写测试,**有意**更新,不静默回归。
- **确定性**:并列稳定 tie-break,杜绝随机。
- **范围克制**:声部进行只到"更顺",不做学术级四部写作;调式/自动节奏留后续阶段。

## 10. 实施顺序与状态

1. ✅ **P1 换内核** — 完成(2026-06-22)。新增 `theory/tonalAdapter.ts`(Tonal 大小调 diatonic→
   ChordDefinition)、`harmony/viterbi.ts`(通用全局最优 DP,稳定 tie-break)、`harmony/transitions.ts`
   (功能进行表 + 声部进行 v1 + 三风格档 + 终止式位置项);`generateCandidates.ts` 改走 Viterbi,公开 API 不变。
   `tsc`/`build`/**77 tests** 绿(含 adapter/viterbi/minor 新测)。
   - **意外发现并修复**:旧引擎**小调模式下仍吐大调和弦**(无视 `mode`);新引擎用 Tonal 给出正确小调
     (小三主 + 和声小调功能属 V7)。A/B:C 小调 旧 `Imaj7→IV→vi` ❌ → 新 `i→V7→i` ✅。
   - **已知局限(留 P2)**:diatonic-only 阶段 **pop≈stable**(同调色板,权重差异分不开),只有 color 因七和弦
     有别;三风格真正分明靠 P2 词汇。
   - **已知成本(留后续)**:tonal 让初始 JS 包 gzip ~218KB→~397KB(+180KB);Chord/Key 拉字典,tree-shake
     砍不掉;**解法 = 和声引擎按需懒加载**(只在"生成"后用,`import()` 拆 chunk,不进首屏),放体验轨/性能收口。
   - 旧 `theory/chords.ts` 暂留(`chordAlternatives` + display 仍用),P2 再收缩。
2. ✅ **P2 扩词汇** — 完成。副属 / 借用 / 转位 / pop loop-anchor(三风格分明);收缩 `theory/chords.ts`。
   commit 362ffb4 / 970a7c1 / 5acbad3 / a5f635f(详见 §13.2)。
3. ✅ **P3 拟真** — 完成(2026-07-11)。`transitions.ts` 的声部进行从 v1 根音/共同音粗估升级为
   v2:构造四声部 MIDI voicing,按总移动量扣分,并额外惩罚同向平行五/八度;仍保留功能进行与 tonicization
   的可解释骨架。新增 `melodyReduction.ts`,在 `scoreChords.ts` 发射分前识别短弱拍经过音/邻音,把这类
   非和弦音视为装饰音轻罚且不触发持续冲突警告。新增 P3 单元测试覆盖弱拍经过音约简与低移动量 voicing
   偏好。验证:84 tests 绿。
4. ✅ **P4 可选** — 完成(2026-07-11)。调式扩展为 major/minor/dorian/mixolydian;major/minor 继续走
   Tonal Key,modal 走同一领域适配器里的调式音阶三度叠置,Dorian 不强塞古典 V7,Mixolydian 保留 ♭VII
   锚点;设置面板、偏好持久化、i18n 同步打开。新增 `auto-phrase` 和声节奏:以小节为骨架,在乐句间隙、
   半小节强拍长音、终止前导处增加换和弦点,介于 bar 与 every-beat 之间。验证:88 tests 绿;build 绿;
   `verify-t4` 桌面/移动绿。

> 每阶段独立 commit;每步 `tsc`/`build`/`test` + 黄金用例 + A/B 试听对比后再推进。
> P1 是重点也是风险点:**目标是用全局最优 + 风格档,在 demo 旋律上明显比现状更顺、三风格更分明**,
> 同时**不破坏可解释性与公开 API**。

---

## 11. 第二轨:和声体验(UX / IA 重做)

### 11.0 产品身份(定调)

> **"带专业级旋律编辑器的和声助手"** —— 钢琴卷帘是把旋律**输进来**的利器(编辑时它最大),
> 但产品的**回报是"听得懂的和声"**(和声时它最大)。

背景:§10/§11 为了"卷帘大气"把和声体验降级(风格=最初三格、检查器被吞、和声沉底抽屉)。但本 app 的
**差异化价值是和声辅助**——卷帘是通用品(用户有 FL Studio),和声理解才是来这儿的理由。所以体验重做要把
"差异化价值"重新顶到该有的位置,**同时不浪费已做好的专业卷帘**——靠**阶段化**让两者各占其时。

### 11.1 阶段化布局(按工作进度渐进,非模式切换)

同一个统一工作台(沿用 §11 Phase B"不分专家/引导,引导是弹窗"),布局**渐进回应"你现在在干嘛"**:

- **State 0 · 空舞台**:无旋律 → 现有空状态引导(导入/示例)。
- **State 1 · 编辑阶段**:有旋律、未生成 → **卷帘 hero,且不出现任何和声 UI**(见 §11.2)。
- **State 2 · 和声阶段**:点了生成 → 和声升为主角:三档预览对比 + 试听 → 选一档深挖;卷帘退为
  "总谱条"(旋律 + 所选和声对齐);**解释面板一等常驻**。
- 触发:`生成` 进入和声阶段;`重新编辑/清空和声` 退回编辑阶段。

```
编辑阶段(State 1)                    和声阶段(State 2)
┌───────────────────────────┐      ┌───────────────────────────┐
│ 命令栏          [生成]     │      │ 命令栏  [风格▾古典|流行|色彩] [重生成] │
├───────────────────────────┤      ├──────────────┬────────────┤
│                           │      │ 三档预览(试听)│            │
│   钢琴卷帘 = 主场(大)     │      │ → 选一档深挖   │ 解释面板    │
│   旋律输入/编辑            │      │  (变体/微调)  │ 为什么是这个 │
│   melody-only,无和声      │      ├──────────────┤ 和弦:功能/  │
│                           │      │ 总谱条:旋律+  │ 终止/声部/   │
│                           │      │ 所选和声对齐   │ 副属/备选    │
└───────────────────────────┘      └──────────────┴────────────┘
```

### 11.2 更狠的划分:编辑阶段不展示任何和声 UI(产品方明确)

State 1(编辑阶段)里,**和声相关 UI 一律不出现**:
- ❌ 和声底部抽屉(`.harmony-drawer`)/和声卷帘 —— 不渲染。
- ❌ 候选条(`.candidate-strip`,含"等待生成"占位卡)—— 不渲染。
- ❌ 任何"和声菜单栏"。
- ✅ 只保留:命令栏、输入源工具、钢琴卷帘、旋律编辑工具、**旋律播放走带**(纯旋律试听)。

和声 UI **只在 State 2 出现**。这把"干净旋律器"和"和声理解"两个阶段彻底切开,符合产品方"划分要更明显"。

> **待解的设计细节**(逐阶段设计时定):
> - **走带的归属**:走带现在在和声抽屉头里;编辑阶段没抽屉,旋律播放走带要有新家(命令栏附近/卷帘底)。
>   和声专属控制(和声静音)只在和声阶段出现。
> - **回到编辑**:和声阶段要有清晰的"再改旋律"入口(退回 State 1)。
> - **"深挖一档"长什么样**:变体列表?可调参数(松紧/色彩度)?
> - **风格选择器位置**:和声阶段命令栏内的分段控件 `[古典|流行|色彩]`。
> - **移动端退化**:两阶段在窄屏怎么塌(和声阶段大概率纵向堆叠:预览→总谱条→解释 sheet)。

### 11.3 风格选择流:三档预览 → 选一档深挖

- 点生成 → 引擎出**三档**(古典/流行/色彩)做**预览对比**,每档可**试听**(沿用真实 AudioEngine)。
- 选中一档 → 进入**深挖**:该风格的多个变体 / 可微调参数;卷帘总谱条显示所选;解释面板跟随所选和弦。
- 对应引擎:默认仍算三档(快速对比),深挖时按该风格档要变体(见第一轨 §5.4 风格档)。

### 11.4 解释回归一等(只在和声阶段)

把被吞的检查器**升级成和声阶段常驻的解释面板**,承载引擎产出的更丰富内容:
- **功能**(T/PD/D + 罗马数字)、**终止式**、**声部进行**(低音走向/平滑)、**副属/借用离调**说明、**备选和弦**。
- 编辑阶段不出现(那时没什么可解释)。"空闲卷帘吃满宽度"的 §11 顾虑只属编辑阶段,不和此冲突。
- 实现复用现 [Inspector](../src/components/workspace/Inspector.tsx) 的内容与 `ChordExplanation`,但**重新定位**为
  和声阶段主面板(而非点击才滑出的侧抽屉)。

### 11.5 体验轨的验证

- `CandidateStrip`/`Inspector`/`HarmonyLane`/工作台布局的 DOM 与 className 会变 → **同步重写 verify t4**
  (及涉及和声区的断言);t5-* 登录/云端不受影响。
- 截图自检:编辑阶段确无和声 UI;和声阶段三档预览/深挖/解释面板/总谱条;桌面+移动无溢出;纯黑白一致;
  动效沿用 T6.6(克制浮现)。

### 11.6 体验轨实施顺序(在引擎 P1 跑通后并行推进)

1. ✅ **E1 阶段化骨架** — 完成(2026-06-22,commit cecf1ad)。`inHarmonyPhase = (有候选 || 生成中) && !editOverride`;
   **编辑阶段隐藏候选条 + 和声抽屉**(干净旋律器),走带移到面板底部细条;**和声阶段**候选条 + 抽屉前置、走带回抽屉头;
   header 切「和声探索」+「编辑旋律」返回按钮,编辑阶段有候选时给「查看和声」。**顺带修了个移动端旧 bug**:定高舞台
   在窄屏把卷帘挤成 0 高 → 移动端改为可滚动 + 卷帘保 46vh。verify t4(加阶段断言)+ t5-4 更新;t4 + t5-2/4/5 桌面+移动绿;
   77 tests + build 绿。**未做(留 E2-E4)**:深挖一档、解释面板升级、移动端和声完整退化。
2. ✅ **E2 风格流** — 完成(commit 3bccbcc)。三档预览从"只可选卡片"升级为 **预览 + 试听 + 深挖 CTA**;
   和声阶段命令栏新增 `[古典|流行|色彩]` 风格分段控件;生成后先处于 compare,选卡片/命令栏风格后进入 deep-dive。
   `verify-t4` 增加三档预览、试听入口、深挖按钮、命令栏风格同步断言;桌面/移动绿。
3. ✅ **E3 解释面板** — 完成(commit a5e2492)。Inspector 升为和声阶段常驻右侧停靠面板,露出 P1 voicing
   及功能/进行理由/契合/备选;编辑期不挂载;点和弦只 `select-chord`。
4. ✅ **E4 深挖 + 总谱条** — 完成(2026-07-11)。深挖阶段隐藏旋律编辑工具,三档预览前置并压缩为风格栏;
   新增 `DeepDivePanel` 展示所选风格、进行、和弦数/色彩和弦/当前和弦,并把当前和弦变体接到既有 `replace-chord`
   微调链路;卷帘压缩为总谱条,与和声抽屉保持同一时间轴;移动端顺序改为 **预览 → 深挖面板 → 总谱条 → 解释面板**。
   `verify-t4` 增加 deep-dive class/panel、总谱高度、预览/深挖/总谱顺序断言;桌面+移动截图自检通过。

> 引擎(P1–P4)与体验(E1–E4)交错推进:E1/E2/E3 可在引擎 P1 跑通后并行;E4 的"深挖变体"依赖引擎
> 风格档成熟(P1 后段)。

---

## 12. 延后任务:前端路由(选 B,做完和声再做)

**完成状态(2026-07-11)**:已加轻量本地路由层 `appRouter.ts`,把 `/`、`/workspace`、`/demo`
映射到现有 `screen/isDemo` 状态;`App.tsx` 接入 History API 和 `popstate`,浏览器前进后退可用。
匿名访问 `/workspace` 仍按认证规则回 landing;`/demo` 可深链直达 demo 工作台并自动载入示例旋律。

**决定(产品方)**:**选方案 B —— 引轻量 router(`wouter` ~2KB 或 react-router)**;**记录在此,Task 7
和声重做完成后再做**(那时阶段/步骤稳定了,正好映射成可链接、可回退的地址)。

**范围(实现时细化)**:
- 给 landing / workspace(及和声阶段、引导步、项目抽屉)各自可链接、可回退的 URL。
- **部署坑**:干净路径需静态托管做 SPA fallback(未知路径回退 `index.html`);Vercel/Netlify 自动带,
  裸静态服务器要手配。(若嫌麻烦可退而用 hash 路由,无需 fallback。)
- 与阶段化体验协同:State 1/2、引导步 → 路由状态。

验证:90 tests 绿;build 绿;新增 `scripts/verify-routing.mjs` 断言 `/demo`、匿名 `/workspace`、`/` 路由;
`verify-t4` 桌面/移动主流程绿。

---

## 13. 剩余工作 · 执行顺序(每项一个新对话可独立开工)

> **已完成**:P1 引擎内核(commit d4ad9ae)、E1 阶段化骨架(commit cecf1ad)、E3 解释面板(a5e2492)、
> P2 扩词汇+风格分明(362ffb4 风格分明 / 970a7c1 副属+借用 / 5acbad3 收缩 chords.ts / a5f635f 转位)。
> **进行约定**:Task 7 全程**只 commit 不 push**,全部做完统一 push。每项收尾 = `tsc`/`build`/`test` +
> 相关 verify(t4/t5-*)+ 桌面/移动截图自检 + 独立 commit。下面按"价值 × 独立性 × 依赖"排序;
> 括号里的依赖可据此微调顺序。**新对话开工时,取下面第一个 ⏳ 项即可。**

1. ✅ **E3 · 解释面板**(本次完成)
   - [Inspector](../src/components/workspace/Inspector.tsx) 从"点击才滑出的侧抽屉"改为**和声阶段常驻**的右侧停靠
     "为什么是这个和弦"面板:罗马/功能/**声部(新露出 P1 voicing)**/旋律契合/契合理由/**功能+进行理由**(`describeFunction`
     含 motion)/警告/备选和弦。点和弦即更新(`onSelectChord` 只 dispatch `select-chord`,不再开关抽屉)。
   - 编辑阶段**不挂载**(`showInspector = inHarmonyPhase`),保持纯净旋律编辑器;`workspace-grid` 在和声阶段加
     `is-harmony-phase` 切两列(舞台 flex:1 + 面板 clamp(300,26vw,380))。≤767px 面板退到舞台下方堆叠(完整移动端 E4 再做)。
   - 验证:tsc/build/77 测试绿;playwright 自检(临时 playwright-core 驱动系统 Chrome)断言编辑期面板 0 个、和声期常驻+
     自动选和弦、点末和弦→标题 Am/级数 vi、Voicing 行存在、返回编辑面板消失;桌面/编辑/移动三张截图自检通过。

2. ✅ **P2 · 扩词汇 + 风格分明**(完成,4 个 commit)
   - **P2a 风格分明(362ffb4)**:pop 加权重驱动的 loop-anchor(大调 I/IV/V/vi、小调 Aeolian i/III/VI/VII),
     不写死循环;顺带修 voice-leading「同弦重复=最大共同音」导致的 V7×4 停滞。新增 `scripts/ab-styles-t7.ts`(pnpm vite-node)。
   - **P2b 副属+借用(970a7c1)**:`V7/x`(5 度上行、解决 down-5 给奖励、悬而不决罚分)+ 大调借 iv/♭VI/♭VII、
     小调借大 IV;`ChordDefinition` 加 `role/appliedTo/borrowedFrom`;explain 出 tonicization/borrowed-color(中英)。
     仅 pop/color 开 `extendedVocabulary`,stable 纯自然音;color 罚分移到 emission(覆盖首段)。
   - **P2c 收缩+转位(5acbad3 / a5f635f)**:删 `theory/chords.ts`,`chordAlternatives` 改吃 `getStylePalette` 新词汇;
     `relationshipToChordTone` 并入 scoreChords。`inversions.ts` 做 bass 平滑(只一转位 IV6/V7/B,首末保根位,stable 关),
     audio/export 已读 `chord.bass` 故可听可导出。
   - **未做(克制)**:Top-K 剪枝——当前 K≈16,K² 完全够用,过早优化无益,留到真的变大再做。
   - 验证:tsc/build/82 测试绿(含 P2a 风格互异、P2b 副属解决/role、P2c 转位不变式);A/B 脚本三风格肉眼/听感分明;
     playwright 自检:color 出 `C7=V7/IV→Fmaj7` 且解释含 tonicization;pop 出 `F/A=IV6` 且 Voicing 低音=A2。

3. ✅ **E2 · 风格流**(完成,commit 3bccbcc)
   - 三档预览 + 试听 → 选一档进入"深挖";风格选择器进命令栏。
   - 验证:82 tests + build + `verify-t4` 桌面/移动绿。

4. ✅ **E4 · 深挖 + 总谱条 + 移动端和声退化**(本次完成)
   - 选中一档后进入 deep-dive:新增深挖面板 + 当前和弦变体微调;卷帘退为"总谱条"(旋律+所选和声对齐);
     移动端完整退化为预览→深挖→总谱→解释。
   - 验证:82 tests + build + `verify-t4` 桌面/移动绿;截图无水平溢出。

5. ✅ **引擎懒加载(体积收口)** — 完成(2026-07-11)。Workspace 的 `generateHarmonyCandidates` 与
   `chordAlternatives` 都改为按需 `import()`;Landing 的 [HarmonyDemo](../src/components/landing/HarmonyDemo.tsx)
   也改为点击生成后再加载真实和声引擎。构建产物新增异步 `generateCandidates-*` / `chordAlternatives-*` /
   `scoreChords-*` chunks,`tonal`/`Key.majorKey` 等只出现在异步 chunk 中;主包 gzip 约 401.98KB → 391.65KB。
   验证:82 tests 绿;build 绿;`verify-t4` 桌面/移动绿;Landing demo 生成烟测绿(3 chord chips + 3 style tabs)。

6. ✅ **P3 · 拟真**(可选增强,本次完成)
   - 声部进行 v2(实际 voicing 总移动量最小化 + 避免平行五/八度)+ 旋律约简(弱拍经过/邻音先识别再打分)。
   - 依赖:P1/P2。

7. ✅ **P4 · 可选**(本次完成):调式(dorian/mixolydian);自动和声节奏(从旋律找乐句/终止点替代手选节奏型)。

8. ✅ **路由(见 §12,选 B)**:Task 7 收尾后做。(本次完成:本地轻量 router + History API + routing verify)

9. ✅ **最终回归 + push**(2026-07-11):已完成并逐项 push。验证结果:
   90 tests 绿;build 绿;`verify-routing` 绿;`verify-t4` 桌面/移动绿;`verify-t5-2` 桌面/移动绿;
   `verify-t5-4` 桌面/移动绿;`verify-t5-5` 绿。`verify-t5-3` live Supabase 回合因外部 TLS
   连接重置(`ECONNRESET` 到 `ieefkysrbhhdlybapvvx.supabase.co:443`)未能完成,不是本地断言失败;
   已修复维护中 t5 脚本的 Playwright runtime 路径(1.60.0 → 1.61.1)。
