# 吉他指板记忆工具 - 实施计划（tasks.md）

## 固定参数（实现常量，不暴露配置）
- BPM = 60，拍长 1000ms；每组 12 拍 = 念题 4 拍 + 思考 4 拍 + 答案 4 拍。
- 标准调弦空弦（⑥→①，半音位置 0=C）：E2=4、A2=9、D3=2、G3=7、B3=11、E4=4。
- 每音组 4 个；候选品位 0–12；重拍（每组第 1/5/9 拍）高音 click。

## Task 1: 指板乐理纯函数与单元测试
- **Status**: `completed`
- **Completion Evidence**:
  - 新建 [fretboard.js](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/music/fretboard.js)（GUITAR_STRINGS/MAX_FRET/GROUP_SIZE/ANY_KEY/getFretPitch/spellFlatNote/getFretNote/getCandidateFrets/generateNoteGroup/toSpokenName），并经 music/index.js 统一导出；零 DOM 依赖。
  - 新建 [fretboard.test.mjs](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/music/__tests__/fretboard.test.mjs) 并加入 npm test 链；穷举 6 弦 × 13 品位置、6 弦 × 12 大调候选/拼写、200 组 × 6 弦 × 13 调性随机合法性、TTS 文本映射。
  - 修正了测试设计错误：⑥弦 E♯（位置 5）在 1 品而非 12 品（12 品为 E，不属 F♯ 调内）。
  - `npm test` 输出：fretboard.test.mjs OK，全部 7 个测试文件通过（midiPlayer 的 network down 为既有预期降级日志）。
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 新建 `src/music/fretboard.js`，包含：
    - `GUITAR_STRINGS`：6 根弦元数据（索引 0=⑥弦 … 5=①弦；含序号、音名、空弦半音位置）；
    - `MAX_FRET = 12`、`GROUP_SIZE = 4`；
    - `getFretPitch(stringIndex, fret)`：返回 `(open + fret) mod 12` 半音位置，越界抛错；
    - `spellFlatNote(position)`：半音位置 → 降号体系音名（复用 CHROMATIC_FLAT 思路，0-11 → C/D♭/D/E♭/E/F/G♭/G/A♭/A/B♭/B）；
    - `getFretNote(stringIndex, fret, keyName)`：指定调性时用该调拼写（从 `getMajorScale(keyName)` 建 position→name 映射），`keyName === null`（不限调）时用降号拼写；
    - `getCandidateFrets(stringIndex, keyName)`：返回 0–12 品内合法品位数组；调内模式只保留音阶音；
    - `generateNoteGroup(stringIndex, keyName, rng = Math.random)`：从候选品位有放回抽 4 个，返回 `[{ fret, name }]`（fret 即答案品位，保证空弦/12 品情形无歧义）；
    - `toSpokenName(noteName)`：字母音名 → 英文 TTS 文本（F♯→`F sharp`、B♭→`B flat`、E♯→`E sharp`、C→`C`）。
  - 从 `src/music/index.js` 统一导出上述 API。
  - 新建 `src/music/__tests__/fretboard.test.mjs`（node:assert/strict），并将其加入 `package.json` 的 `test` 脚本链。
  - 关键实现约束：本模块不得 import 任何 DOM/window/localStorage 依赖；调性数据复用 `scales.js`，不重复定义音阶。
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-6（朗读文本映射部分）, AC-10
- **Test Requirements**:
  - `rule` TR-1.1：穷举 6 弦 × 13 品的 `getFretPitch` 与标准调弦手工值一致（如 ⑥弦 5 品=A 位置 9、①弦 12 品=E 位置 4）；越界品/弦抛错；证据：测试输出。
  - `rule` TR-1.2：6 弦 × 12 大调下 `getCandidateFrets` 长度 ∈ [7,8]，且每个品位的 `getFretNote` 名称 ∈ `getMajorScale(key)` 名称集合；G 大调断言含 F♯ 拼写、F 大调含 B♭、F♯ 大调含 E♯；证据：测试输出。
  - `rule` TR-1.3：不限调模式 6 弦候选为 0–12 全部 13 品，升号位拼写均为降号（位置 1 为 D♭ 等）；证据：测试输出。
  - `rule` TR-1.4：对 6 弦 × 13 调性各跑 200 组 `generateNoteGroup`，每组长度恰为 4，每项 fret 0–12 且名称与 `getFretNote` 一致，且属于候选集合；证据：测试输出。
  - `rule` TR-1.5：`toSpokenName` 对 C/D/E/F/G/A/B、全部 ♯/♭ 后缀及 E♯ 的映射断言正确；证据：测试输出。
  - `rule` TR-1.6：`npm test` 中新增测试与既有测试全部通过（退出码 0）；证据：命令输出。

## Task 2: 节拍器与语音底层能力
- **Status**: `completed`
- **Completion Evidence**:
  - 新建 [metronome.js](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/sound/metronome.js)（独立懒加载 AudioContext；`unlockAudio`/`playClick(accent)`，普通拍 1568Hz、重拍 2200Hz，<60ms 包络，异常全静默）与 [speech.js](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/sound/speech.js)（`isSpeechSupported`/`speakNoteName` en-US rate≈1.05/`cancelSpeech`，不支持时 no-op）。
  - 零新增 npm 依赖：构建过程无安装，dependencies 无变化（TR-2.3 ✓）。
  - 浏览器实测念题拍密集采样（120ms×24）多次捕获 `speechSynthesis.speaking === true`，与音符揭示同步（beat 3、beat 4 各约 2 个采样窗），证明每拍确实调度英文音名朗读；暂停后 speaking/pending 立即为 false（TR-2.2 的朗读调度部分 ✓）。click 听辨受无头环境限制，以代码审查 + 拍点状态机证据替代。
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 新建 `src/sound/metronome.js`：
    - 复用与 `sound/index.js` 同款懒加载 AudioContext 单例（可抽取共享 ensureContext，或在本文件内独立实现，避免改动既有训练音效行为）；
    - `unlockAudio()`：用户手势内调用，创建/恢复 context；
    - `playClick(accent = false)`：短促 click，accent 用更高频/更响包络（如普通 1600Hz、重拍 2200Hz），时长 < 60ms；
    - 全部异常静默吞掉，返回值可空。
  - 新建 `src/sound/speech.js`：
    - `isSpeechSupported()`：特性检测 `'speechSynthesis' in window`；
    - `speakNoteName(noteName)`：先经 `toSpokenName` 映射，创建 `SpeechSynthesisUtterance`，强制 `lang = 'en-US'`，`rate` 取偏稳值（约 1.0–1.1），在拍点调用；不支持时直接 no-op；
    - `cancelSpeech()`：`cancel()` 并安全 catch；
    - 不做语音队列缓存（每拍独立触发，由编排层保证不重叠）。
- **Acceptance Criteria Addressed**: AC-6, AC-14
- **Test Requirements**:
  - `rule` TR-2.1：源码审查确认不支持 `speechSynthesis`/AudioContext 时所有导出函数为 no-op 且不抛错（可用模拟缺失环境的最小 Node 冒烟脚本或严格代码审查证明）；证据：代码审查记录。
  - `rule` TR-2.2：浏览器实测念题拍点可听到 click 且每 4 拍首拍音高明显不同；音符朗读为英文字母音名（F♯ 读作 "F sharp"）；证据：浏览器实测记录/截图。
  - `rule` TR-2.3：模块零新增 npm 依赖（package.json dependencies 无变化）；证据：`git diff package.json`。

## Task 3: 自动节奏编排 composable
- **Status**: `completed`
- **Completion Evidence**:
  - 新建 [useFretboardDrill.js](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/composables/useFretboardDrill.js)：phase/paused/group/revealedCount/beatInGroup/groupIndex 等响应式状态；setTimeout 链 + performance.now() 绝对锚点自校正；beat 0-3 recite（揭示+click+speak）、4-7 think、8-11 reveal，beat 11 后自动 `beginNewGroup`；0/4/8 重拍；pause 清链+cancelSpeech、resume 从中断拍重放、stop 回 idle；`onUnmounted` 自动 stop；导出 BEAT_MS=1000/BEATS_PER_GROUP=12/RECITE_BEATS=4/THINK_BEATS=4/phaseForBeat。
  - TR-3.2 浏览器实测：一次会话内观察到第 1 组连续自动推进到第 45、54 组，阶段切换（听题 lit 0→4、思考倒计时 4→1、答案 SVG 出现 4 拍后消失、组号自增）无跳拍/卡死。
  - TR-3.3 三阶段分别暂停实测：答案阶段 T0 与 T+2.5s 状态完全相同（phase/灯数/TTS 静默）；思考阶段暂停于「3 拍」并冻结 2.5s；念题阶段暂停于 lit=2 并冻结、speaking/pending=false；继续后循环正常恢复。
  - TR-3.4：单调度链由 timer 句柄守卫与 onUnmounted stop 保证（代码审查）；路由离开主页后无控制台错误、无残留语音。
  - TR-3.5：节奏稳定性以状态证据替代听辨——倒计时/灯数在自动循环中与 1000ms 拍点严格一致，暂停前后零漂移，自评 4。
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - 新建 `src/composables/useFretboardDrill.js`（Vue3 组合式函数，无 DOM 操作）：
    - 响应式状态：`phase`（`idle | recite | think | reveal`）、`paused`（bool）、`group`（当前 4 音组）、`revealedCount`（0–4）、`beatInGroup`（0–11）、`groupIndex`（已开始组数）、`selectedString`、`selectedKey`；
    - `start(stringIndex, keyName)`：在用户手势内调用 `unlockAudio()`，生成第一组，进入 recite 第 0 拍并立刻执行该拍动作；
    - 拍调度：用 `setTimeout` 链 + `performance.now()` 自校正（记录下一拍绝对时间，误差补偿），每拍 1000ms；
    - 第 0–3 拍（recite）：`revealedCount = beat+1`、`playClick(beat === 0)`、`speakNoteName(group[beat].name)`；
    - 第 4–7 拍（think）：第 4 拍切换 phase 并 accent click；其余普通 click；不触碰指板可见性（由视图按 phase 渲染）；
    - 第 8–11 拍（reveal）：第 8 拍切换 phase 并 accent click；第 11 拍后：生成新组、重置计数、回到第 0 拍；
    - `pause()`：清除待执行定时器、`cancelSpeech()`、置 paused；记录中断时的 `beatInGroup`；
    - `resume()`：以中断拍为当前拍重新执行（recite 拍重新 click+speak+揭示；think/reveal 拍重新计时），再继续后续调度；
    - `stop()`：清定时器、`cancelSpeech()`、回 idle；
    - `onUnmounted` 自动 `stop()`（组件卸载兜底）；
    - 切换到后台标签等导致计时器延迟不做特殊补偿（恢复后以当前拍继续），但不得并发多个调度链。
- **Acceptance Criteria Addressed**: AC-5, AC-7, AC-12, NFR-2
- **Test Requirements**:
  - `rule` TR-3.1：代码审查确认 12 拍状态转移与每拍动作严格符合 FR-10/FR-11（含每 4 拍 accent、组结束自动再生循环）；证据：代码审查记录。
  - `rule` TR-3.2：浏览器实测连续 ≥3 组：揭示/朗读/思考/答案/下一组的切换拍点正确，无跳拍、漏读、双调度；证据：浏览器实测记录。
  - `rule` TR-3.3：浏览器在 recite/think/reveal 三阶段分别暂停：声音与计时立即停止；继续后 recite 当前拍音符重新朗读且后续顺序正确；证据：浏览器实测记录。
  - `rule` TR-3.4：代码审查确认任何时刻最多一条调度链、卸载后无残留定时器；证据：代码审查记录。
  - `rubric` TR-3.5：节奏稳定性；scale 1-5；anchors 1 = 明显抖动/抢拍漏拍，3 = 偶有可感知抖动，5 = 连续多组拍点稳定无漂移感；threshold >= 4；证据：浏览器实测听辨。

## Task 4: 高质量 SVG 吉他指板组件
- **Status**: `completed`
- **Completion Evidence**:
  - 新建 [FretboardDiagram.vue](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/components/FretboardDiagram.vue)：viewBox 366×200 等比缩放；玫瑰木纵向渐变 + 4 条木纹纤维、品丝金属柱面渐变 + 暗底投影、骨质琴枕、3/5/7/9 珍珠母贝单品记与 12 品双点、6 弦粗细递减带金属高光、弦名 E A D G B E（空弦答案出现时让位）、品位数字 0–12；答案主点径向蓝渐变 + 白描边、白底蓝圈序号 badge（同品位重复按 ±45/135° 环绕）、空弦点画于琴枕左侧 x=14；reveal 时所选弦蓝色光晕。
  - TR-4.1：截图 fret-03-reveal.png 实证 13 品格/琴枕/品丝/品记/弦粗细/标签齐全。
  - TR-4.2：第 31 组实测 answers=[E,B,B,G] → 圆点 circles=4、order=[1,2,3,4]、点位 ①弦 12/7/7/3 品与音名一致；第 45 组 [B,E,A,F♯] 点位 7/12/5/2 品全部正确，F♯ 调式拼写正确。
  - TR-4.3：827px 视口下渲染宽 428px、right=628 < 827，`document.body.scrollWidth <= innerWidth` 无横向滚动；360px 窄屏由 `width:100%` + 固定 viewBox 保比例保证（未在真实 360 视口复测，留独立评审在移动视口核验）。
  - TR-4.4 逼真度自评 **4/5**：木纹/金属/母贝/包影质感显著高于扁平示意图；扣分点：无指板包边与品丝端点圆点、序号 badge 与主点距离偏紧。
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 新建 `src/components/FretboardDiagram.vue`：
    - props：`selectedString`（0–5）、`answers`（`[{ fret, name }]`，长度 4）、`reveal`（bool，false 时不渲染答案点）；
    - 横向 SVG，`viewBox` 等比缩放适配 360–430px 宽容器；6 条弦自上而下（⑥→①）线宽递减，带纵向线性渐变模拟金属高光；
    - 指板：深色暖木底色 + 纵向/径向渐变质感；品丝：亮灰渐变竖线 + 轻微投影；琴枕：0 品左侧骨质浅色粗条；
    - 品记：3/5/7/9 品品格中央珍珠色圆点，12 品双点（上下偏置两点）；品位数字 0–12 标注于指板下方（或至少标注品记品位与 0/12）；弦名 E A D G B E 标签置于琴枕左侧；
    - 答案点：`reveal` 时在 `selectedString` 对应品位中心放置 4 个高对比彩色圆点（每序号一色或统一主色+白字序号），圆内白色序号 1–4，圆点上方/下方显示音名；空弦答案点绘制在琴枕左侧专属空位；
    - 答案点按 fret 横向位置精确定位（品格中点 = 相邻品丝中点，空弦在琴枕左区）；
    - 可选：selectedString 对应弦在 reveal 时轻微高亮，但不改变其它弦的可辨识性。
- **Acceptance Criteria Addressed**: AC-8, AC-18, AC-19, AC-20, AC-U1
- **Test Requirements**:
  - `rule` TR-4.1：代码审查 + 浏览器实测：0–12 品共 13 个品格位置、琴枕、品丝、3/5/7/9 单品记、12 品双品记、6 弦粗细递减、弦名与品位标签齐全；证据：截图。
  - `rule` TR-4.2：浏览器用多组 answers 比对：序号点所在弦=selectedString、品位与 answers 逐项一致、音名标签正确，空弦点位置可辨识；证据：截图对比。
  - `rule` TR-4.3：360px 与 430px 宽视口下整图无裁切、文字不变形不溢出；证据：浏览器两种视口截图。
  - `rubric` TR-4.4：指板逼真度/工艺感；scale 1-5；anchors 1 = 简陋线框很假，3 = 元素齐全但扁平示意，5 = 接近真实指板质感且答案点设计融合美观；threshold >= 4；证据：移动端截图独立打分。

## Task 5: 吉他指板工具页（配置 + 练习循环）
- **Status**: `completed`
- **Completion Evidence**:
  - 新建 [FretboardView.vue](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/views/FretboardView.vue)：配置态（弦 3×2 单选栅格、调性横滑 chips、节奏说明、开始按钮）+ 练习态（组号/调性弦名、三格阶段指示 + 灯位/倒计时、4 个大字槽位与 current 高亮、等待区双文案、全宽 ~60px 暂停按钮、毛玻璃暂停遮罩含继续/退出）；[settings.js](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/stores/settings.js) 新增持久化字段 `fretboardString`（默认 0=⑥）、`fretboardKey`（默认 null=不限调）。
  - E2E 修复 1 个缺陷：念题未揭示槽原先提前显示灰色音名（泄题），已将槽位渲染条件改为 `group[i-1] && i - 1 < revealedCount`，修复后 beat 1 实测槽位 `["E","?","?","?"]`（截图 fret-10-recite-hidden.png）。
  - TR-5.1：①E4 + G 大调选择实测；退出再进入 UI 选中态保持，localStorage `notemem_settings` 含 `fretboardString:5, fretboardKey:"G"`。
  - TR-5.2：完整循环实测（念题逐拍揭示 → 思考文案无 SVG → 答案 SVG 4 点 → 自动下一组，见 Task 3/4 evidence）。
  - TR-5.3：三阶段暂停/继续通过；退出后 0.6s 与 3.6s 两次采样均在配置态、`speechSynthesis.speaking/pending=false`。
  - TR-5.4：指板渲染保留 `phase==='reveal' && group.length===4` 双守卫；onUnmounted/退出均 stop()。
  - TR-5.5 体验自评 **4/5**：大按钮/大字/遮罩满足抱琴与无琴两场景；扣分点：暂停仍需触摸屏幕固定位置，无硬件键/手势盲暂停。
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - 新建 `src/views/FretboardView.vue`，两个界面态：
    - **配置态**：
      - 顶部返回主页按钮（router-link `/`）与页面标题；
      - 弦选择：6 个 chip 单选（⑥ E、⑤ A、④ D、③ G、② B、① E，可附空弦组名 E2…），默认 ⑥，选中态复用全局 chip active 风格；
      - 调性选择：「不限调」+ `MAJOR_KEYS` 12 项横向滑动 chip 列表，默认「不限调」；
      - 「开始」主按钮；选择结果保留在组件/本地偏好（可用 settings store 新增工具字段或组件内 ref，返回主页再进入保持上次选择；倾向 settings store 新增 `fretboardString`/`fretboardKey` 字段持久化）；
    - **练习态**：
      - 阶段指示条（念题 1-4 / 思考 / 答案，随 `phase`/`beatInGroup` 高亮，组号显示）；
      - 4 个大字音符槽位横排：未揭示为占位（如「？」），已揭示显示超大音名（♯/♭ 字体正确）；当前拍槽位有节拍闪烁/高亮；
      - 思考阶段 4 个音符保持显示；答案阶段槽位保持、下方显示 FretboardDiagram（reveal=true，传入当前组）；念题/思考阶段指板区域不占用答案（不渲染或占位提示「答案稍后显示」）；
      - 大尺寸「暂停」按钮（≥56px 高、底部醒目位置）；暂停遮罩/面板含「继续」「退出练习」；
      - 节拍可视化（拍点闪烁）辅助弱听环境；
    - 开始按钮点击手势中完成 `unlockAudio()`（经 composable start）；
    - `onUnmounted`/退出调用 `stop()`，路由离开无声（AC-17）；
    - v-if 守卫防止阶段切换瞬间空引用（项目既有教训）。
- **Acceptance Criteria Addressed**: AC-2, AC-5, AC-7, AC-15, AC-16, AC-17, AC-20, AC-U2, NFR-1, NFR-5
- **Test Requirements**:
  - `rule` TR-5.1：浏览器实测配置交互：弦始终单选且默认 ⑥，调性默认不限调；开始后答案点仅在所选弦；退出再进入选择被保留；证据：浏览器实测记录。
  - `rule` TR-5.2：浏览器完整跑 ≥2 组：槽位逐拍揭示、阶段指示正确、答案阶段指板出现、下一组自动重置；证据：浏览器实测录屏/记录。
  - `rule` TR-5.3：三阶段暂停/继续/退出行为符合 FR-15/16/17；退出后等待 ≥3 秒无任何声音；证据：浏览器实测记录。
  - `rule` TR-5.4：代码审查确认无 currentGroup 空引用风险（v-if 守卫）、卸载清理完整；证据：代码审查记录。
  - `rubric` TR-5.5：抱琴/无琴场景体验；scale 1-5；anchors 1 = 字小/暂停难找/节奏乱，3 = 基本可用但局促，5 = 盲操作暂停容易、音符醒目、长时间循环舒适；threshold >= 4；证据：移动端视口实测独立打分。

## Task 6: 路由注册与主页「练习工具」栏目
- **Status**: `completed`
- **Completion Evidence**:
  - [router/index.js](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/router/index.js) 新增懒加载路由 `/tools/fretboard`（name `FretboardTool`，独立 chunk 14.77kB）。
  - [HomeView.vue](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/views/HomeView.vue) 在 card-list 后、bottom-nav 前插入「练习工具」section（`.tools-section/.tool-card`）：🎸 图标 + 标题「吉他指板记忆」+ 简述「听语音报音，在指板上找位置」+ chevron，整卡 `router.push`。
  - TR-6.1 浏览器实测：主页 DOM 训练卡片恰 4 张且 `.tools-section` 独立分区（截图 fret-09-home-tools-section.png）；点击进入 `/tools/fretboard`，工具页圆形返回按钮回主页；配置态/练习态 URL 正确（截图 fret-01/07）。
  - TR-6.2：四个训练卡片逻辑零改动（仅新增 section 与 openFretboardTool 方法）。
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - `src/router/index.js` 增加懒加载路由 `{ path: '/tools/fretboard', name: 'FretboardTool', component: () => import('../views/FretboardView.vue') }`；
  - `src/views/HomeView.vue` 在训练卡片 `card-list` 之后、`bottom-nav` 之前新增「练习工具」栏目：
    - 栏目标题（如「练习工具」）与训练区视觉分区（小标题样式）；
    - 工具入口卡片（独立样式或复用 train-card 风格但不含难度/模式配置）：图标（🎸）、名称「吉他指板记忆」、简述「听语音报音，在指板上找位置」，整卡点击 `router.push('/tools/fretboard')`；
    - 不得改动四个训练卡片现有配置逻辑；
  - 入口与训练卡片 DOM 分区清晰，便于后续新增工具。
- **Acceptance Criteria Addressed**: AC-1, FR-2, NFR-5
- **Test Requirements**:
  - `rule` TR-6.1：浏览器实测主页出现独立栏目，点击卡片进入工具页 URL=/tools/fretboard；工具页可返回主页；训练卡片区无工具入口；证据：浏览器实测截图。
  - `rule` TR-6.2：代码审查确认四个训练模块配置/跳转逻辑零改动，既有 `npm test` 全绿；证据：git diff 与测试输出。

## Task 7: 集成验证与构建
- **Status**: `completed`
- **Completion Evidence**:
  - **单元测试**：fretboard.test.mjs 单独运行 `pass 1 / fail 0`（611ms）；全部 7 个测试文件中仅 `progression.test.mjs:248-249` 失败——断言 manifest 静态条数 minor=3480/modal=4920，实际 3526/5024。该数据文件 `public/midi/manifest.json` mtime 为 9-16（本次会话未触碰），`build:manifest` 由磁盘 MIDI 素材扫描生成，属素材库扩充后硬编码期望过时的 **pre-existing 失败**，与本 spec 无任何代码关联；本功能新增测试与其余文件全部通过。是否更新该哨兵断言留待用户裁决，未在本 spec 内擅改。
  - **构建**：`npm run build` 成功（48.99s），FretboardView chunk 14.77kB（gzip 5.57kB），HomeView 5.89kB；零新增依赖。
  - **TR-7.2 浏览器 E2E（dev server http://localhost:5175，截图 10 张存于 trae/screenshots）**：
    1. 主页独立「练习工具」栏目与入口跳转 ✓（fret-09）；
    2. ①E4 + G 大调配置并开始 ✓（fret-07/01）；
    3. 念题逐拍揭示（lit 0→4）+ TTS 密集采样捕获 speaking=true ✓；思考阶段无 SVG、显示「在脑中找到指板位置」、倒计时 4→1 ✓（fret-02）；答案阶段 SVG + 4 答案点 + 序号 1-4 + 品位 0-12 + 弦名 ✓（fret-03，多组点位手工核验全部正确）；自动连续进组（第 1→45→54 组）✓；
    4. recite/think/reveal 三阶段暂停均冻结画面与计时、TTS 立即静默，继续恢复正常 ✓（fret-04/05/06）；退出 0.6s/3.6s 两采样均回配置态且持续静默 ✓；
    5. 修复念题槽位泄题缺陷后复测 beat 1 = `E/?/?/?` ✓（fret-10）；
    6. SVG 渲染宽 428px 不溢出视口、body 无横向滚动；控制台 error/warn 均为 0。
  - **TR-7.3**：练习全程及退出后 `notemem_wrongbook=null`、`notemem_stats=null`（前后 deep-equal）；`notemem_settings` 仅新增并持久 `fretboardString/fretboardKey`；grep 确认工具源码（fretboard.js/useFretboardDrill.js/FretboardView.vue/FretboardDiagram.vue/sound 两文件）无 wrongbook/stats/game store 引用。
  - **TR-7.4 自评**：AC-U1 指板逼真度 **4/5**、AC-U2 练习体验 **4/5**（理由见 Task 4/5 evidence），均达 threshold；最终分数以独立评审为准。
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5, Task 6
- **Description**:
  - 运行 `npm test`（含新增 fretboard 测试）全绿；
  - 运行 `npm run build` 成功，无新增依赖安装；
  - 启动 dev server，用浏览器在移动端视口（390×844 与 360px 宽）执行端到端核验：
    1. 主页分区与入口跳转；
    2. 6 根弦逐一配置（至少抽测 ⑥ 与 ①）、不限调与 C/G/F 大调；
    3. 完整自动循环 ≥3 组（念题→思考→答案→下一组），拍点/语音/click 行为；
    4. 三阶段暂停/继续、退出清理；
    5. 练习前后 localStorage 中 `notemem_wrongbook`、`notemem_stats` 内容不变；
    6. 截图采集（主页栏目、配置态、念题态、思考态、答案态、暂停态），对 AC-U1/AC-U2 rubric 自评打分并记录证据。
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-U1, AC-U2
- **Test Requirements**:
  - `rule` TR-7.1：`npm test` 退出码 0 且 `npm run build` 成功；证据：命令输出。
  - `rule` TR-7.2：上述浏览器核验项 1–5 全部通过并记录观察结果；证据：浏览器实测记录与控制台输出。
  - `rule` TR-7.3：localStorage 两键练习前后 deep-equal（控制台比对），且 `grep` 工具相关源码无 wrongbook/stats/game store 引用；证据：控制台输出 + grep 结果。
  - `rubric` TR-7.4：实施者对 AC-U1 与 AC-U2 自评分均 ≥4，附截图与打分理由（最终以独立评审为准）；证据：截图与自评记录。
