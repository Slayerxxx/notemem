# 和弦进行识别训练模块 - 产品需求文档（spec.md）

## Overview
- **Summary**：在 NoteMem 现有「音级训练 / 和弦训练 / 五度圈训练」三个模块基础上，新增第四个训练模块「和弦进行识别训练」。每题播放一段来自 `public/midi/` 的和弦进行 MIDI（包内含 Major/Minor/Modal 三大类），用户从 4 个罗马数字序列选项中选出与听到的进行一致的一项。模块完整复用现有游戏框架（题量/限时/错题模式、分数连击、即时反馈、错题本、统计、设置）。
- **Purpose**：训练音乐人耳朵对和弦进行的识别能力，借助真实钢琴音色（soundfont-player）与文件名自带的进行标注，让听力训练既不失真又可程序化出题。
- **Target Users**：有一定乐理基础、希望系统训练和弦进行听觉识别的音乐学习者与从业者。

## Goals
- 听到一段 MIDI 进行后能从 4 个罗马数字序列中选出正确进行。
- 新模块与现有三个模块拥有一致的训练流程、反馈机制与数据体系。
- 用 soundfont-player 提供真实钢琴音色，避免「数字感」合成音。
- 速度按风格自动设置（fast/medium/slow 三桶），无需用户操作。

## Non-Goals
- 不做用户可控的倍速开关（页面上无倍速选择器）。
- 不做用户可选风格（本期训练默认走 baseline 风格；style 字段保留供未来扩展，但 UI 不暴露）。
- 不做多音色切换（本期仅钢琴一种音色；其他音色作为后续扩展接口预留）。
- 不做听力模式（识别调性、识别根音等额外题型）。
- 不做耳朵训练之外的和弦生成、改写、导出功能。
- 不改动既有音级/和弦/五度圈三模块的任何功能与测试。

## Background & Context
- 现有架构：乐理纯函数在 `src/music/`（scales.js / chords.js / circle.js / difficulty.js / index.js），出题纯函数在 `src/quiz/generator.js`，游戏状态机在 `src/stores/game.js`（idle → answering → feedback → finished，作答后停留 feedback 态，用户点「下一题」才继续，不自动跳转），错题本/统计/设置分别在 `src/stores/wrongbook.js`、`stats.js`、`settings.js`，页面为 HomeView / TrainView / ResultView / WrongBookView / StatsView / SettingsView，合成音效在 `src/sound/index.js`（与本期真实音色解耦，互不替代）。
- 题型现状：scale/circle 题为单选，chord 题为单选 4 选 1；game store `answerQuestion(index)` 以 `index === correctIndex` 判定，progression 沿用此单选模型，作答载荷为选项索引数字。
- MIDI 资源：`free-midi-progressions-20260314.zip` 已解压到 `public/midi/`（Vite 原样 serve `public/`，运行时可用 `/midi/...` 加载，无需 import）。包内结构：`Major/` 600 进行、`Minor/` 696 进行、`Modal/` 984 进行，每类下含 4 个 style 子目录（`pop style/` `pop2 style/` `hiphop2 style/` `soul style/`）+ 1 份顶层 baseline 副本，共 5 副本；同一段进行在不同 style 下为独立 MIDI（md5 不同）。本期训练固定用每类顶层 baseline 副本（保持速度统一），style 子目录全量保留供未来扩展。
- 文件名格式严格规整：`<Key> - <Progression tokens> - <Mood tags>.mid`。
  - Key 12 个，使用降号拼写：`A Ab B Bb C D Db E Eb F G Gb`（与项目既有降号拼写规范一致）。
  - Progression tokens 3-8 个，空格分隔；token 形态：`I/ii/iii/IV/V/vi/vii` 等罗马数字（大小写区分大/小和弦）+ 后缀（`7` `M7` `m7` `dom7` `sus2` `sus4` `add9` `6` `69` `dim` `5` `M-5` `M=#` 等）。Modal 类额外含 `#`/`b` 前缀（如 `#IVdim` `bVIIM` `bIIM7`）。
  - Mood tags 1-3 个英文形容词（如 `Hopeful Nostalgic`），与玩法无关，仅作为 manifest 元数据保留。
- 既定硬约束（项目记忆）：训练页作答后不得自动跳转；v-if 守卫防止 currentQuestion 为 null 时白屏；难度按常用度（升降号数量）排序；作答计时默认从题目展示开始（progression 题型例外，见 FR-5）。
- 测试约定：`src/**/__tests__/*.test.mjs` 使用 node:assert 纯脚本，可直接 `node <file>` 运行。

## Functional Requirements

- **FR-1 文件名解析**：新增 `parseProgressionFilename(name)` 纯函数，将文件名解析为 `{ key, mode, progressionTokens, mood, style }`；mode 为 `'major'`/`'minor'`/`'modal'`；progressionTokens 为罗马数字 token 数组（保留原拼写，不做语义归一化）；style 为 `'baseline'`（顶层）或 `'pop'`/`'pop2'`/`'hiphop2'`/`'soul'`（来自子目录名）。未知格式抛错。
- **FR-2 manifest 构建**：新增构建期脚本 `scripts/build-midi-manifest.mjs`，扫描 `public/midi/{Major,Minor,Modal}/` 下全部子目录与顶层 `.mid`，对每个文件调用解析函数，输出 `public/midi/manifest.json`，结构为 `{ major: [...], minor: [...], modal: [...] }`，每条记录 `{ key, mode, progressionTokens, mood, style, url, tokenHash }`；`url` 为相对站根的 `/midi/...` 路径，`tokenHash` 为 progressionTokens join 后的稳定 hash（用于选项去重）。脚本通过 `npm run build:manifest` 调用；`build` 脚本前置依赖 `build:manifest`。
- **FR-3 难度分级**：进行训练设 4 个等级，按调性范围 + 和弦复杂度递增：
  - L1 大调三和弦：仅 Major 类、且 progressionTokens 全为纯三和弦（无后缀的 I/ii/iii/IV/V/vi/vii 或 Modal 视为大写罗马）的 baseline 进行。
  - L2 大调七和弦：Major 类 baseline，进行中至少含 1 个七和弦/9 和弦/dom7/sus 后缀 token。
  - L3 小调进行：Minor 类 baseline（小调体系，含小写罗马 i/iii/iv/v 等）。
  - L4 Modal 进行：Modal 类 baseline（含 `#`/`b` 前缀或 Modal 借用，最复杂）。
  - 同一难度内进行不混合 mode；各难度内仅出现 baseline style。
- **FR-4 出题逻辑**：从当前难度的 manifest 子集中以错题加权方式抽 1 条进行（候选 id 粒度 `progression:<mode>:<key>:<tokenHash>`，避免连续重复同题）。正确答案为该进行的罗马数字序列字符串（如 `I V vi IV`）。3 个干扰项策略：
  1. 顺序调换：对正确 tokens 做相邻交换（`I V vi IV` → `I V IV vi`），同和弦不同序。
  2. token 替换：保留位置结构，替换 1-2 个 token 为同 mode 内其他合法级数（`I V vi IV` → `I V ii IV`）。
  3. 同难度其他进行：从候选池中挑 tokenHash 不同的另一条进行。
  兜底去重：4 个选项 tokenHash 两两不同；选项顺序随机打乱。
- **FR-5 作答交互**：题干区展示「请听这段 <mode 中文名> 和弦进行」+ 调性提示「调性：<Key>」+ 大型 ▶ 播放按钮 + 简易播放进度条。选项区 4 个竖向大选项按钮，每个显示罗马数字序列（如 `I · V · vi · IV`）。计时起点为用户首次点击 ▶ 播放的瞬间（而非题目渲染时），避免音色加载时间被算进答题时间，破坏速度奖励公平性；播放完成后用户随时可点击选项判定。点击 ▶ 后音频开始播放即调用 `game.answerQuestion` 之前的「计时起点记录」由 store 提供 hook（详见 FR-6）；用户点选项后进入 feedback 态。feedback 态播放按钮转为「复听」可用，可重复点击播放当前进行。
- **FR-6 游戏状态机扩展**：game store 的 `start()` type 校验扩展为 `'scale' | 'chord' | 'circle' | 'progression'`；progression 题型新增「延迟计时」模式——题目渲染后不立即启动单题倒计时，等待视图调用新 action `startProgressionTimer()` 后才启动；超时按既有规则计错、连击清零、入错题本；feedback 态保留「下一题」按钮，用户主动点击才继续（复用既有状态机，不自动跳转）。`extractScopeFromWrong` 支持 progression（解析 `progression:<mode>:<key>:<tokenHash>` 与对象 `mode`/`key`/`tokenHash` 字段），错题范围写入 `config.customProgressions`（与 customKeys/customRoots/customNotes 同构）。
- **FR-7 错题本集成**：进行错题类型为 `'progression'`，记录 mode、key、tokenHash、promptText「请听这段 <mode> 和弦进行，调性 <Key>」、correctAnswer（罗马数字序列字符串，如 `I · V · vi · IV`）、userAnswer。错题本新增「进行训练」Tab、对应计数、单条移除、按模块清空、错题模式入口。
- **FR-8 统计集成**：按 `progression_<level>` 维度记录最高分/正确率/反应时长/轮次；统计页新增「进行训练」Tab 与 L1-L4 难度选择。
- **FR-9 设置集成**：新增持久化默认项 `progressionLevel`（默认 1）、`progressionTrainMode`（默认 `'count'`）；设置页提供进行训练默认难度与默认模式选择；重置设置覆盖新字段。
- **FR-10 首页入口**：首页新增第四张训练卡片「和弦进行训练」，含难度 chips、模式选择、错题模式禁用态、开始训练跳转，与现有卡片交互一致。
- **FR-11 音色加载**：使用 `soundfont-player` 加载真实钢琴音色（`acoustic_grand_piano`）。音色采样文件（预渲染的 JS 包，约 4-8 MB）预先下载并放到 `public/soundfonts/acoustic_grand_piano.js`，构建期随 `dist` 一起打包（方案 A：本地化、与项目同源）。加载时机：进入 `/train?type=progression` 时异步加载，加载完成前显示「音色加载中…」进度；加载失败回退到既有 `src/sound/index.js` 的合成提示音（不阻塞训练流程）。同一 AudioContext 实例内缓存 player 实例，会话内不重新加载。
- **FR-12 MIDI 解析与播放**：使用 `@tonejs/midi` 的 `Midi.fromUrl(url)` 解析 MIDI 文件得到 `tracks[0].notes[]`（含 `midi`/`time`/`duration`/`velocity`/`ticks`）与 `header.ppq`/`header.tempos`。播放调度自实现：忽略 `header.tempos` 原始 tempo，按 `getBpmForStyle(style)` 返回的 BPM 重算每 note 的 `startSec`/`durSec`（`secondsPerTick = 60 / (BPM × ppq)`），用 soundfont-player `player.play(noteName, ctx.currentTime + startSec, { duration: durSec, gain: velocity })` 排程。维护 `scheduledNodes[]`，停止时遍历 `player.stop(node)`。
- **FR-13 速度分桶算法**：`getBpmForStyle(style)` 返回 BPM：
  - `'soul'` → 慢桶 70 BPM
  - `'baseline'` `'pop'` `'pop2'` → 中桶 90 BPM
  - `'hiphop2'` → 快桶 115 BPM
  未知 style 默认中桶。本期训练固定使用 baseline 风格（即固定 90 BPM），实现三桶算法便于未来开放风格选择时即用即变。算法为纯函数，可单测。

## Non-Functional Requirements
- **NFR-1**：乐理（文件名解析）与出题逻辑为纯函数、无 Vue/副作用，放在 `src/music/progression.js` 与 `src/quiz/generator.js` 的 progression 分支，具备单元测试。
- **NFR-2**：MIDI 播放引擎封装在 `src/audio/midiPlayer.js`，与既有 `src/sound/index.js` 解耦（前者负责 MIDI 真实音色播放，后者保留为合成提示音与 fallback）。
- **NFR-3**：移动端布局以 375px 宽度为基准可用，播放按钮与选项按钮最小点击区域 ≥ 44px；PC 端浏览器正常显示。
- **NFR-4**：不破坏现有音级/和弦/五度圈三模块的任何功能与测试（新增代码以扩展为主，既有测试需全部通过）。
- **NFR-5**：所有数据继续走 localStorage（`notemem_` 前缀），纯前端无后端；localStorage 异常时静默降级。manifest.json 不入 localStorage（运行时 fetch 静态文件）。
- **NFR-6**：TrainView 等页面继续遵守 v-if 守卫，currentQuestion 为 null 时不访问其属性。
- **NFR-7**：音色加载失败不阻塞训练流程（fallback 到合成音；或显示提示但允许用户继续选择，仅不播放真实音色）。

## Constraints
- **Technical**：Vue 3 + Pinia + vue-router + Vite；新依赖仅 `@tonejs/midi` 与 `soundfont-player`，不引入其他第三方包；测试用 node:assert 脚本。
- **Business**：本期不开放风格选择 UI、不开放倍速开关、不引入非钢琴音色。speed 分桶算法本期实现，UI 上不暴露。
- **Dependencies**：复用 `src/storage/index.js` 的 safeGet/safeSet/STORAGE_KEYS、generator 的 `pickWeighted`/`shuffle`、game store 状态机、sound 模块作为 fallback。`manifest.json` 由构建期脚本生成，dev 与 build 路径统一从 `/midi/manifest.json` fetch。

## Assumptions
- 文件名解析不区分大小写敏感性，大小写即代表和弦性质（`I` 大三和弦、`i` 小三和弦）；本模块展示时保留原拼写，不做音名归一化或等音替代。
- 「调性提示」按 mode + key 给出中文描述：major→「大调」、minor→「小调」、modal→「Modal 进行」，例如「请听这段大调和弦进行，调性：C 大调」。
- 「计时起点改为用户首次点击 ▶」是 progression 题型专属规则，其他题型（scale/chord/circle）保持原「题目渲染即开始计时」逻辑不变。
- 「按风格自动设置速度」本期引擎层实现三桶算法；训练走 baseline 风格等价于「统一速度 90 BPM」，未来开放风格选择时即按桶变速。
- 「音色本地化方案 A」即把 soundfont 采样文件（预渲染 JS 包）放进 `public/soundfonts/`，构建期与 `dist` 同源；首屏加载耗时由首次进入训练页承担。
- 进行错题粒度为「整段进行」（mode + key + tokenHash 三元组），不细分到 token；错题模式仅按该三元组重题。
- 4 个选项固定不变（不随难度递增），难度仅通过「调性范围 + 和弦复杂度」体现。

## Acceptance Criteria

### AC-1: 文件名解析正确
- **Type**: `rule`
- **Given**: `parseProgressionFilename`
- **When**: 对样本文件名 `A - I I7 Idom7 I7 - Relaxed Playful.mid`、`D - iim7 V7 iiim7 vi7 iim7 V7 - Romantic Nostalgic.mid`、`A - I I7 I9 IV ivm - Romantic Nostalgic.mid`（含 Modal 类 `#`/`b` 前缀样本如 `A - I IV V bVIIM - Triumphant Rebellious.mid`）逐一解析
- **Then**: 返回对象含正确的 `key`（降号拼写）、`mode`、`progressionTokens`（保留原拼写含 `#`/`b`/后缀）、`mood`、`style`；未知格式（如缺 `-` 分隔）抛错
- **Pass Condition**: 全部样本断言通过
- **Evidence**: `node src/music/__tests__/music.test.mjs` 中 progression 解析用例输出

### AC-2: manifest 构建正确
- **Type**: `rule`
- **Given**: `scripts/build-midi-manifest.mjs`
- **When**: 执行 `npm run build:manifest`
- **Then**: `public/midi/manifest.json` 生成，含 `major`/`minor`/`modal` 三数组；每条记录含 `key`/`mode`/`progressionTokens`/`mood`/`style`/`url`/`tokenHash`；major 数组 ≥ 3000 条（600 进行 × 5 style 副本）、minor ≥ 3480、modal ≥ 4920；每条 url 以 `/midi/` 开头且文件确实存在
- **Pass Condition**: 文件生成且字段断言通过
- **Evidence**: 命令输出 + manifest.json 抽样校验

### AC-3: 难度池划分正确
- **Type**: `rule`
- **Given**: `PROGRESSION_DIFFICULTIES` / `getProgressionPoolByLevel(level)` 从 manifest 过滤
- **When**: 查询 L1-L4 难度池
- **Then**: L1 全部 mode=major、style=baseline、tokens 均为无后缀纯三和弦；L2 全部 mode=major、style=baseline、tokens 至少含 1 个后缀 token；L3 全部 mode=minor、style=baseline；L4 全部 mode=modal、style=baseline；非法等级（0、5）抛错；各池均非空
- **Pass Condition**: 断言全部通过
- **Evidence**: music.test.mjs 难度池用例输出

### AC-4: 出题结构正确
- **Type**: `rule`
- **Given**: `generateProgressionQuestion`
- **When**: 生成一道进行题
- **Then**: 题目 type 为 `'progression'`，id 为 `progression:<mode>:<key>:<tokenHash>`；options 为 4 个 tokenHash 两两不同的罗马数字序列字符串；correctIndex 指向正确进行；干扰项包含至少 1 个顺序调换或 token 替换策略；explanation 含正确进行字符串
- **Pass Condition**: 批量生成 200 题，结构断言全部成立
- **Evidence**: `node src/quiz/__tests__/quiz.test.mjs` 中 progression 用例输出

### AC-5: 速度分桶算法正确
- **Type**: `rule`
- **Given**: `getBpmForStyle(style)`
- **When**: 分别查询 `'baseline'`/`'pop'`/`'pop2'`/`'soul'`/`'hiphop2'`/未知
- **Then**: baseline=90、pop=90、pop2=90、soul=70、hiphop2=115、未知=90
- **Pass Condition**: 全部断言通过
- **Evidence**: music.test.mjs 中速度分桶用例输出

### AC-6: game store 支持 progression 题型
- **Type**: `rule`
- **Given**: game store 以 type `'progression'` 开始训练
- **When**: 模拟「渲染题 → 视图调 startProgressionTimer → 用户点选项 → feedback」全流程；以及「渲染后不点播放直接刷新/离开」「超时」三种边界
- **Then**: 全对计分/连击增加；半错/全错连击清零、入错题本且字段含 mode/key/tokenHash/promptText/correctAnswer/userAnswer；超时 selectedIndex=-1、reactionMs=限时；未调 startProgressionTimer 时 questionRemainingMs 不递减；feedback 态后需 nextQuestion 才继续
- **Pass Condition**: store 测试断言全部通过
- **Evidence**: `node src/stores/__tests__/game.test.mjs` 中 progression 用例输出

### AC-7: 错题模式与错题加权生效
- **Type**: `rule`
- **Given**: 错题本中存在 progression 错题
- **When**: 以 trainMode `'wrong'` 开始进行训练；普通模式下传入 wrongQuestions
- **Then**: 错题模式出题 tokenHash 限定在错题涉及的 tokenHash 集合内；普通模式以 50% 概率优先抽错题进行；`wrongbook.clearAll('progression')` 仅清进行错题、`progressionCount` 计数正确
- **Pass Condition**: 断言全部通过
- **Evidence**: game.test.mjs / storage 相关用例输出

### AC-8: MIDI 播放引擎可用
- **Type**: `rule`
- **Given**: `src/audio/midiPlayer.js` 在浏览器（或 JSDOM mock AudioContext）环境下
- **When**: 加载音色 → fetch manifest 取一条 url → `Midi.fromUrl(url)` → 按 `getBpmForStyle('baseline')` 重算调度 → 播放 → 停止
- **Then**: 返回控制器含 `play()`/`stop()`/`isPlaying()`；调用 stop 后 `isPlaying()` 为 false 且 scheduledNodes 清空；播放过程中 AudioContext 无 suspended 阻塞
- **Pass Condition**: 集成测试断言通过（可用 mock AudioContext 跑 node 脚本）
- **Evidence**: `node src/audio/__tests__/midiPlayer.test.mjs` 输出

### AC-9: 音色加载失败回退
- **Type**: `rule`
- **Given**: soundfont-player 加载音色失败（如网络断开或文件损坏）
- **When**: 进入训练页尝试加载
- **Then**: 不抛错、不阻塞训练流程；fallback 到 `src/sound/index.js` 的合成提示音；用户可继续作答；UI 显示「音色加载失败，已使用合成音色」提示
- **Pass Condition**: 流程跑通无报错
- **Evidence**: 浏览器走查 + midiPlayer 单测（注入失败 mock）

### AC-10: 全链路页面可用
- **Type**: `rule`
- **Given**: 应用启动
- **When**: 首页选择进行训练卡片 → 选题量/限时/错题模式 → 训练页 ▶ 播放→作答多题（含对/错/超时）→ 结算页 → 错题本 Tab → 统计 Tab → 设置页
- **Then**: 各页进行训练入口、跳转、展示、数据落库均正常；非法 level（<1 或 >4）直达 `/train` 时回首页；刷新结算页无数据时回首页
- **Pass Condition**: 浏览器走查全程无控制台错误、无白屏
- **Evidence**: 构建成功 + 浏览器走查记录（review.md）

### AC-11: 现有模块无回归
- **Type**: `rule`
- **Given**: 新增进行训练模块后的代码库
- **When**: 运行全部既有单元测试并执行 `npm run build`
- **Then**: music/quiz/game/storage 全部测试通过，构建成功无报错
- **Pass Condition**: 所有测试退出码 0，build 成功
- **Evidence**: 测试与构建命令输出

### AC-12: 训练页交互与视觉质量
- **Type**: `rubric`
- **Dimension**: 进行训练页的移动端交互可用性与视觉一致性
- **Scale**: 1-5
- **Anchors**: 1 = 布局错乱/播放按钮难以点按/反馈看不懂；3 = 功能可用但布局或反馈有明显瑕疵；5 = 题干-播放按钮-选项结构直观，4 选项拇指友好，对错状态清晰，复听按钮易用，与现有页面视觉风格统一
- **Pass Threshold**: ≥ 4
- **Evidence**: 浏览器移动端视口走查截图/记录（review.md）

## Open Questions
（无 — 全部由用户决策闭合：调性提示给、音色本地化方案 A、midi 全量保留、选项固定 4 个、按风格自动三桶速度无 UI 开关、仅钢琴音色）
