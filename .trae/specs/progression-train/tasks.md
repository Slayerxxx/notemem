# 和弦进行识别训练模块 - 任务分解（tasks.md）

## 任务依赖关系概览

```
T1(manifest)─┬─→ T2(audio)─┬─→ T3(music/generator)─┬─→ T4(game store)─┬─→ T5(other stores)─┬─→ T6(HomeView)─┬─→ T7(TrainView)─┬─→ T8(other views)─┬─→ T9(verify+build)
             └────────────→ T3                                                                  └────────────→ T7
```

T1-T2 可并行；T3 依赖 T1；T4 依赖 T3；T5/T6 依赖 T4；T7 依赖 T6；T8 依赖 T7；T9 依赖 T8。

---

## Task 1: 构建期 manifest 脚本与文件名解析（依赖：无）

**目标**：实现 MIDI 包文件名解析 + 构建期 manifest 生成脚本，供后续所有任务使用。

**依赖**：无（独立于既有代码）。

**文件清单**：
- 新增：`src/music/progression.js` —— 文件名解析纯函数 `parseProgressionFilename(name)`、`hashProgression(tokens)`、`MODE_NAMES`（major/小调/Modal 中文名映射）
- 新增：`scripts/build-midi-manifest.mjs` —— 构建脚本，扫 `public/midi/` 生成 `public/midi/manifest.json`
- 新增：`src/music/__tests__/progression.test.mjs` —— 解析与 hash 单测
- 修改：`package.json` —— `scripts` 加 `"build:manifest": "node scripts/build-midi-manifest.mjs"`，`"build"` 前置 `prebuild` 钩子调 `build:manifest`（或显式 `&&` 串联）
- 新增：`public/midi/manifest.json` —— 脚本输出（不手写）

**步骤**：
1. 实现 `parseProgressionFilename(name)`：
   - 输入：`A - I I7 Idom7 I7 - Relaxed Playful.mid` 或子目录路径形式 `Major/pop style/A - I V vi IV - Hopeful.mid`
   - 解析：`<Key> - <Progression tokens> - <Mood>.mid`，按 ` - ` 分隔三段
   - 推断 mode：从父目录路径首段（`Major`→`major`、`Minor`→`minor`、`Modal`→`modal`）；顶层文件 mode 由所在顶层目录决定
   - 推断 style：顶层为 `'baseline'`；子目录名（如 `pop style`）规整为 `'pop'`
   - 输出：`{ key, mode, progressionTokens: string[], mood: string[], style: string }`
   - 未知格式抛 `Error('Invalid progression filename: ' + name)`
2. 实现 `hashProgression(tokens)`：简单稳定 hash（如 `tokens.join(' ')` 的 djb2），用于选项去重与错题 id
3. 写构建脚本：递归扫 `public/midi/`，过滤 `.mid`，对每个文件调解析函数，构造记录 `{ key, mode, progressionTokens, mood, style, url, tokenHash }`，url 为 `/midi/<相对路径>`（路径中空格保留 URL encode）
4. 输出结构：`{ major: [], minor: [], modal: [] }`，按 mode 分组（不按 style 二次分组，style 字段保留在每条记录）
5. 写单测：覆盖 Major/Minor/Modal 三类样本、顶层与子目录、含 `#`/`b`/复杂后缀 token、未知格式抛错
6. 配 package.json scripts，跑 `npm run build:manifest` 生成 manifest.json

**验证**：
- `node src/music/__tests__/progression.test.mjs` 退出码 0
- `npm run build:manifest` 生成 manifest.json 且 record 数 ≥ 11,400（600+696+984）× 5
- manifest.json 抽样 10 条记录的 url 对应文件确实存在

**Definition of Done**：
- 文件名解析函数单测通过
- manifest.json 生成、抽样 url 全部可访问
- package.json scripts 配置正确

---

## Task 2: MIDI 播放引擎与音色加载（依赖：无，可与 T1 并行）

**目标**：封装 `@tonejs/midi` 解析 + `soundfont-player` 播放，实现按风格分桶的统一速度调度，并提供音色加载与缓存。

**依赖**：无（与 T1 互不依赖，可并行）。

**文件清单**：
- 新增：`src/audio/midiPlayer.js` —— `loadInstrument(ctx)` / `playProgression({ midiUrl, bpm, ctx, instrument })` / 返回控制器 `{ play, stop, isPlaying, duration }`
- 新增：`src/audio/soundfontLoader.js` —— 加载 soundfont JS 包并缓存 player 实例，提供 fallback 信号
- 新增：`src/audio/__tests__/midiPlayer.test.mjs` —— 用 mock AudioContext + mock instrument 验证调度与停止
- 修改：`package.json` —— `dependencies` 加 `@tonejs/midi`、`soundfont-player`
- 新增：`public/soundfonts/acoustic_grand_piano.js` —— 预渲染音色包（首次运行由 soundfont-player 下载或预先放置；构建期随 dist 一起打包）

**步骤**：
1. 安装依赖：`npm install @tonejs/midi soundfont-player --save`
2. 获取并放置 soundfont 包：从 soundfont-player 默认 CDN 拉取 `acoustic_grand_piano.js`（约 4-8 MB）放到 `public/soundfonts/acoustic_grand_piano.js`；如手动放置不便，先确认 soundfont-player API 支持本地路径（`Soundfont.instrument(ac, name, { soundfont: '/soundfonts/acoustic_grand_piano.js' }` 或类似）
3. 实现 `loadInstrument(ctx)`：
   - 调 `Soundfont.instrument(ctx, 'acoustic_grand_piano', { soundfont: '/soundfonts/acoustic_grand_piano.js' })` 返回 Promise<player>
   - 失败时返回 `null`（视图层据此 fallback 到 `src/sound/index.js`）
   - 同 ctx 下缓存 player 实例（`Map<ctx, player>`）
4. 实现 `playProgression({ midiUrl, bpm, ctx, instrument })`：
   - `const midi = await Midi.fromUrl(midiUrl)`
   - 取 `midi.header.ppq`、`midi.tracks[0].notes[]`（如有 multiple tracks 取最长 notes 数的 track）
   - 计算 `secondsPerTick = 60 / (bpm × ppq)`
   - 每个 note：`startSec = note.ticks × secondsPerTick`、`durSec = max(note.durationTicks × secondsPerTick, 0.1)`、`gain = note.velocity`
   - 用 `player.start(noteName, ctx.currentTime + startSec, { duration: durSec, gain })`（或 `player.play`，看 soundfont-player v 版本）排程；返回值入 `scheduledNodes[]`
5. 返回控制器：`{ play: () => Promise<void>, stop: () => void, isPlaying: () => boolean, duration: number }`，`stop` 遍历 `scheduledNodes` 调 `player.stop(node)` 并清空数组
6. 写单测：mock AudioContext（currentTime 固定）、mock instrument（play 返回 fake node），验证不同 BPM 下 startSec 计算正确、stop 后 scheduledNodes 为空、isPlaying 状态切换

**验证**：
- `node src/audio/__tests__/midiPlayer.test.mjs` 退出码 0
- 浏览器实际加载一条 manifest url 听到钢琴音色播放（手工走查记录到 review.md）

**Definition of Done**：
- 引擎单测通过
- 浏览器手工走查能听到真实钢琴音色播放 MIDI 进行
- 音色加载失败 fallback 不阻塞训练流程

---

## Task 3: 难度配置与出题逻辑（依赖：T1）

**目标**：在乐理层与 generator 层加入进行训练难度配置与出题纯函数，对接既有 generator 与错题加权体系。

**依赖**：T1（manifest 已生成，解析与 hash 函数已存在）。

**文件清单**：
- 新增（在 T1 已建文件中追加）：`src/music/progression.js` —— `PROGRESSION_DIFFICULTIES` 4 级配置、`getProgressionPoolByLevel(level)`（从已加载 manifest 过滤）、`MODE_NAMES` 中文名
- 修改：`src/music/index.js` —— re-export progression 相关常量与函数
- 修改：`src/quiz/generator.js` —— 新增 `generateProgressionQuestion(opts)`，并在 `generateQuestion` dispatch `'progression'`
- 修改：`src/quiz/__tests__/quiz.test.mjs` —— 加 progression 出题结构 + 干扰项策略 + 错题加权 + 错题模式出题范围用例
- 修改：`src/music/__tests__/music.test.mjs` —— 加难度池划分断言

**步骤**：
1. 在 progression.js 定义 `PROGRESSION_DIFFICULTIES`：
   - L1 `{ id:1, name:'大调三和弦', mode:'major', style:'baseline', pureTriadOnly:true, optionCount:4, timeLimit:20 }`
   - L2 `{ id:2, name:'大调七和弦', mode:'major', style:'baseline', hasExtendedChord:true, optionCount:4, timeLimit:18 }`
   - L3 `{ id:3, name:'小调进行', mode:'minor', style:'baseline', optionCount:4, timeLimit:16 }`
   - L4 `{ id:4, name:'Modal 进行', mode:'modal', style:'baseline', optionCount:4, timeLimit:14 }`
2. 实现 `getProgressionPoolByLevel(level, manifest)`：按 level.mode + style 过滤；L1 进一步过滤 progressionTokens 全为无后缀纯三和弦（正则匹配）；L2 过滤至少含 1 个后缀 token；返回数组（含 url/key/tokenHash/progressionTokens/mood）
3. 实现 `getBpmForStyle(style)`：baseline=90、pop=90、pop2=90、soul=70、hiphop2=115、其他=90；纯函数可单测
4. 在 generator.js 实现 `generateProgressionQuestion({ level, manifest, wrongQuestions, customProgressions })`：
   - 调 `getProgressionPoolByLevel`，按错题加权（错题 tokenHash 50% 优先）抽 1 条候选
   - 正确答案为该进行 progressionTokens 用 `' · '` join 后的字符串（如 `I · V · vi · IV`），存储到 `correctAnswer`；tokenHash 存到 `id`
   - 干扰项策略：顺序调换、token 替换（替换 1-2 个为同 mode 内其他合法级数，需先按 mode 抽样合法 token 池）、同 mode 其他进行（tokenHash 不同的另一条）；生成 ≥3 个候选后取 4 个 tokenHash 两两不同的作为干扰项
   - 4 选项 shuffle，correctIndex 指向正确项
   - promptText 为「请听这段 <mode 中文名> 和弦进行，调性：<Key>」
   - explanation 为正确进行字符串 + 可选 mood 文案
5. `generateQuestion` dispatch：加 `case 'progression'` 分支调 `generateProgressionQuestion`
6. 写单测：
   - 难度池断言（L1 全 pureTriadOnly、L2 全 hasExtendedChord、L3 全 minor、L4 全 modal、非 baseline 全过滤掉）
   - 出题结构（type/id/options[4]/correctIndex/explanation/promptText）
   - 选项 tokenHash 两两不同
   - 干扰项至少含 1 个顺序调换或 token 替换
   - 错题加权：传入 wrongQuestions 时 50% 命中错题 tokenHash
   - 错题模式：customProgressions 限定 tokenHash 集合

**验证**：
- `node src/music/__tests__/music.test.mjs` 与 `node src/quiz/__tests__/quiz.test.mjs` 退出码 0
- 批量生成 200 题，结构断言全部通过

**Definition of Done**：
- 4 级难度池均非空且符合规则
- 出题纯函数单测通过
- generator dispatch 正常

---

## Task 4: game store 集成（依赖：T3）

**目标**：扩展 game store 支持 progression 题型，包括 type 校验、延迟计时模式、错题本写入。

**依赖**：T3（出题逻辑、难度配置、tokenHash 已存在）。

**文件清单**：
- 修改：`src/stores/game.js` —— `start()` type 校验加 `'progression'`、新增 `startProgressionTimer()` action、`answerQuestion` 中 progression 分支错题写入字段、`extractScopeFromWrong` 支持 progression
- 修改：`src/stores/__tests__/game.test.mjs` —— 加 progression 全流程用例（含延迟计时/超时/对/错）

**步骤**：
1. `start()` 中 type 校验扩展为 `['scale','chord','circle','progression'].includes(type)`；progression 题型走同一状态机流程，但单题计时起点延迟
2. 新增 action `startProgressionTimer()`：
   - 仅 progression 题型生效（其他题型调用为 noop）
   - 记录 `questionStartTime = Date.now()`，启动单题倒计时 interval
   - 防止重复调用（如已在计时不重复启动）
3. `nextQuestion()` 中：progression 题型生成下一题时重置计时起点状态（等待视图再次调 `startProgressionTimer`）
4. `answerQuestion(index)` 中 progression 分支：
   - 计算对错（`index === correctQuestion.correctIndex`）→ 同既有
   - 分数连击 → 同既有
   - 写错题：`{ type:'progression', mode, key, tokenHash, promptText, correctAnswer, userAnswer: options[index], createdAt: Date.now() }`
5. `extractScopeFromWrong(wrong)`：增加 progression 分支，解析 id `progression:<mode>:<key>:<tokenHash>`，返回 `{ mode, key, tokenHash }`；写入 `config.customProgressions`
6. 错题模式开始训练：`start({ type:'progression', trainMode:'wrong' })`，generator 接收 `customProgressions` 限定 tokenHash 集合
7. 写单测：
   - 完整流程：渲染题→调 startProgressionTimer→用户点选项→feedback 态→nextQuestion
   - 不调 startProgressionTimer：questionRemainingMs 不递减
   - 超时：未点选项时间到 → selectedIndex=-1、reactionMs=限时、连击清零、入错题本
   - 错题字段：mode/key/tokenHash/promptText/correctAnswer/userAnswer 齐全
   - extractScopeFromWrong：解析正确

**验证**：
- `node src/stores/__tests__/game.test.mjs` 退出码 0
- 既有 scale/chord/circle 用例无回归

**Definition of Done**：
- progression 全流程测试通过
- 既有题型无回归
- 状态机保持「作答后停留、用户主动 nextQuestion」语义

---

## Task 5: 其他 store 扩展（依赖：T4）

**目标**：wrongbook / stats / settings 三个 store 扩展 progression 维度。

**依赖**：T4（错题记录格式、stats 维度命名约定已确定）。

**文件清单**：
- 修改：`src/stores/wrongbook.js` —— `progressionCount` getter、`clearAll('progression')` 分支、`getByType('progression')` 已自动支持
- 修改：`src/stores/stats.js` —— 已自动支持 `progression_<level>` 维度（keyOf 泛型，仅校验不回归）
- 修改：`src/stores/settings.js` —— `DEFAULT_SETTINGS` 增 `progressionLevel:1`、`progressionTrainMode:'count'`；reset 覆盖
- 修改：`src/stores/__tests__/storage.test.mjs`（如有，否则加 progression 错题本/设置/统计维度用例）

**步骤**：
1. wrongbook.js：`progressionCount` 实现 `wrongList.filter(w => w.type === 'progression').length`；`clearAll(type)` 中 progression 分支调既有 filter 移除
2. settings.js：DEFAULT_SETTINGS 增字段；reset / loadSettings 覆盖
3. stats.js：确认 keyOf 与 recordSession 对 progression 维度自动支持（无须改代码，仅写用例验证）
4. 写测试：错题本 progression 计数/清空/不影响其他类型；settings 持久化 progressionLevel；stats recordSession `progression_1` 等 key 正确累加

**验证**：
- storage 测试套退出码 0
- 既有 wrongbook/stats/settings 用例无回归

**Definition of Done**：
- 三 store progression 维度全部就绪
- 既有功能无回归

---

## Task 6: HomeView 首页入口卡片（依赖：T5）

**目标**：首页新增「和弦进行训练」卡片，交互与既有卡片一致。

**依赖**：T5（settings 默认项 progressionLevel / progressionTrainMode 已可读）。

**文件清单**：
- 修改：`src/views/HomeView.vue` —— CARDS 数组新增第 4 张卡片，难度 chips、模式选择、错题模式禁用态、开始训练跳转

**步骤**：
1. 复用既有卡片组件结构（如 CARDS 数组项），新增一项 type='progression'
2. 难度 chips：复用既有样式，展示 L1-L4 名称（'大调三和弦'/'大调七和弦'/'小调进行'/'Modal 进行'）
3. 模式选择：count/limited 选项，错题模式禁用判断（错题本无 progression 错题时禁用并显示「暂无错题」）
4. 开始训练按钮：跳转 `/train?type=progression&level=<n>&mode=<count|limited>&trainMode=...`

**验证**：
- 浏览器走查首页第 4 张卡片显示正确、难度切换/模式选择/跳转生效
- 错题模式在无 progression 错题时禁用

**Definition of Done**：
- 卡片视觉与交互与既有卡片一致
- 跳转 URL 正确

---

## Task 7: TrainView 训练页 UI（依赖：T6）

**目标**：训练页实现 progression 题型 UI 分支：题干区播放按钮+进度+调性提示、4 选项罗马数字序列按钮、feedback 态复听。

**依赖**：T6（首页可跳转进入）、T2（音频引擎）、T4（store 延迟计时）。

**文件清单**：
- 修改：`src/views/TrainView.vue` —— progression 分支题干渲染、播放按钮、选项按钮、反馈区
- 新增：`src/composables/useProgressionAudio.js` —— 组合式函数封装音色加载 + playProgression 调用 + 控制器状态（playing/loading/error）
- 修改：`src/router/index.js`（如有 query 参数解析扩展） —— 确认 query.type=progression 路由参数已支持

**步骤**：
1. 在 `useProgressionAudio` 中：
   - onMounted 调 `loadInstrument(ctx)`，状态：loading/error/ready
   - 暴露 `play(midiUrl, style)`、`stop()`、`replay()`、`isPlaying`、`isLoading`、`loadError`、`duration`
   - play 调 `playProgression({ midiUrl, bpm: getBpmForStyle(style), ctx, instrument })`
   - onUnmounted 调 stop 释放
2. TrainView template v-if 分支（`currentQuestion.type === 'progression'`）：
   - 题干区：显示 promptText（含 mode 中文名 + 调性提示）、大型 ▶ 播放按钮、简易播放进度条（基于 controller.duration + isPlaying）、音色加载中/loader、音色加载失败提示
   - 选项区：4 个竖向大按钮，显示 `option.replace(/ · /g, '\n')` 或保持单行（视移动端 375px 宽度而定，4 token 单行可能溢出，建议竖排或自动换行），点击触发 answerQuestion
   - 反馈区：correctIndex 高亮绿色、用户点击项错则红色，正确进行字符串展示，复听按钮（feedback 态可见），「下一题」按钮（既有，feedback 态显示）
3. 计时起点：渲染题目后 onMounted 调 `game.startProgressionTimer()`（仅 progression 分支）；用户首次点击 ▶ 时若未启动则启动（双保险）
4. 进度条：基于 ctx.currentTime - startTime / duration；播放结束自动归零
5. v-if 守卫：currentQuestion 为 null 时显示 loader 或回首页，绝不访问其属性

**验证**：
- 浏览器走查：进入 /train?type=progression → 看到音色加载中 → 加载完看到题干 + 播放按钮 + 4 选项 → 点 ▶ 听到钢琴进行 → 点选项 → 看到对错反馈 + 复听按钮 + 下一题
- 移动端 375px 宽度：播放按钮 ≥ 44px、4 选项按钮 ≥ 44px 高、无水平滚动
- 音色加载失败 mock：fallback 提示显示、训练流程不阻塞

**Definition of Done**：
- 训练页 progression 分支完整可用
- 移动端布局合理
- 音色加载失败 fallback 生效

---

## Task 8: 其他视图集成（依赖：T7）

**目标**：ResultView / WrongBookView / StatsView / SettingsView 加入 progression 维度展示与配置。

**依赖**：T7（训练链路可跑通，错题与统计数据已产生）。

**文件清单**：
- 修改：`src/views/ResultView.vue` —— `scopeText` diffPool 加 `PROGRESSION_DIFFICULTIES`，`typeText` 加「和弦进行识别」
- 修改：`src/views/WrongBookView.vue` —— TABS 增 `{ value:'progression', label:'进行训练' }`
- 修改：`src/views/StatsView.vue` —— TABS 加 progression，`poolOf` 三分支扩展
- 修改：`src/views/SettingsView.vue` —— 默认难度/模式区加 progression 行（默认难度 L1-L4、模式 count/limited）

**步骤**：
1. ResultView：scopeText switch 加 progression case，按 difficultyId 查 PROGRESSION_DIFFICULTIES 名称；typeText 加 progression → 「和弦进行识别」
2. WrongBookView：TABS 增 progression；filterByType 已支持（用 type 字段过滤）；空状态文案
3. StatsView：TABS 增 progression；poolOf 切换为 PROGRESSION_DIFFICULTIES；keyOf 自动支持 `progression_<level>`
4. SettingsView：默认难度下拉加 progression 项（L1-L4）；模式选择 count/limited；持久化到 settings.progressionLevel / progressionTrainMode

**验证**：
- 浏览器走查：
  - 完成一轮 progression 训练 → 结算页显示「和弦进行识别 · L1 大调三和弦」
  - 错题本切换到「进行训练」Tab 看到错题
  - 统计页切到 progression Tab 看到 L1 数据
  - 设置页设置 progression 默认难度为 L2 → 刷新后保持

**Definition of Done**：
- 4 个视图 progression 维度全部就绪
- 既有视图无回归

---

## Task 9: 全链路验证与构建（依赖：T8）

**目标**：跑全部测试、跑构建、跑浏览器全链路走查，确保无回归与交付质量。

**依赖**：T8（全部代码已落地）。

**文件清单**：
- 修改：`review.md` —— 浏览器走查记录、AC-10/AC-11/AC-12 证据
- 不新增其他文件

**步骤**：
1. 跑全部单测：`node src/music/__tests__/music.test.mjs`、`node src/quiz/__tests__/quiz.test.mjs`、`node src/stores/__tests__/game.test.mjs`、`node src/stores/__tests__/storage.test.mjs`、`node src/audio/__tests__/midiPlayer.test.mjs`，全部退出码 0
2. 跑 `npm run build:manifest` 重新生成 manifest.json（确保最新）
3. 跑 `npm run build`，构建成功，dist 产物完整（含 manifest.json、soundfonts/acoustic_grand_piano.js、midi/ 全量）
4. 浏览器走查全链路（AC-10）：
   - 首页 → 进行训练卡片 → 选题量 20 题 → 训练页（音色加载完）→ 答完 20 题（含对/错/超时）→ 结算页
   - 结算页 → 错题本 Tab → 切到进行训练 → 看到错题
   - 错题模式入口 → 开始错题训练 → 出题限定在错题 tokenHash
   - 统计页 → 进行训练 Tab → 看 L1 数据
   - 设置页 → 设 progressionLevel=L2 → 刷新首页默认项生效
5. 移动端视口走查（AC-12）：375px 宽度下训练页布局、按钮点按、对错反馈
6. 既有模块回归走查：跑一轮音级/和弦/五度圈训练，确认无白屏、无控制台错误、数据落库正常
7. 写 review.md：记录走查过程、AC-10/11/12 证据、发现的问题与修复

**验证**：
- 全部测试退出码 0
- `npm run build` 成功
- 浏览器全链路无控制台错误、无白屏
- 既有三模块功能无回归

**Definition of Done**：
- 全部 AC 验证通过
- review.md 记录完整
- 构建产物可静态部署运行
