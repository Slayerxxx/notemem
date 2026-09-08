# 五度圈训练模块 - 产品需求文档（spec.md）

## Overview
- **Summary**：在 NoteMem 现有「音级训练」「和弦训练」两个模块基础上，新增第三个训练模块「五度圈训练」。每题给出五度圈上的一个中心音，用户通过点击选项（非键盘输入）填出其左右两个相邻音——即上行纯五度（顺时针）与下行纯五度（逆时针）音。模块完整复用现有游戏框架（题量/限时/错题模式、分数连击、即时反馈、错题本、统计、设置）。
- **Purpose**：帮助用户快速记忆五度圈上 12 个音的相邻关系，为调号、调关系与和弦进行学习打基础。
- **Target Users**：正在学习乐理、需要快速反应五度圈相邻音的移动端/PC 端用户。

## Goals
- 给定任一中心音，用户能快速选出其上行五度音与下行五度音。
- 新模块与现有两个模块拥有一致的训练流程、反馈机制与数据体系。
- 所有带升降号的音在本模块中统一以降号拼写显示（如 G♭ 而非 F♯）。

## Non-Goals
- 不做升号拼写切换（本期所有升降号音一律降号显示）。
- 不做小调五度圈、关系大小调、调号升降数记忆等扩展玩法。
- 不引入自定义模式 UI（store 层保留 customNotes 透传能力，与现有 customKeys/customRoots 对齐，UI 不暴露）。
- 不改动音级训练「一次只练一个调」的既有约束；五度圈每题以一个中心音为锚点，难度按白键音/全 12 音分 2 级（与和弦训练按根音池扩展同构）。

## Background & Context
- 现有架构：乐理纯函数在 `src/music/`（scales.js / chords.js / difficulty.js），出题纯函数在 `src/quiz/generator.js`，游戏状态机在 `src/stores/game.js`（idle → answering → feedback → finished，作答后停留 feedback 态，用户点「下一题」才继续，不自动跳转），错题本/统计/设置分别在 `src/stores/wrongbook.js`、`stats.js`、`settings.js`，页面为 HomeView / TrainView / ResultView / WrongBookView / StatsView / SettingsView。
- 题型现状：scale 题为单选（7 选 1），chord 题为单选（4 选 1）；game store 的 `answerQuestion(index)` 以 `index === correctIndex` 判定。五度圈题为「一题两空」，需要扩展作答载荷为两个选项索引。
- 五度圈乐理（降号拼写体系，半音位置 0-11，升五度 = +7 半音，降五度 = +5 半音）：
  - 顺时针（上行五度）序列：C → G → D → A → E → B → G♭ → D♭ → A♭ → E♭ → B♭ → F → C
  - 12 音降号拼写表：C(0)、D♭(1)、D(2)、E♭(3)、E(4)、F(5)、G♭(6)、G(7)、A♭(8)、A(9)、B♭(10)、B(11)
- 既有硬约束（项目记忆）：训练页作答后不得自动跳转；v-if 守卫防止 currentQuestion 为 null 时白屏；难度按常用度（升降号数量）排序。
- 测试约定：`src/**/__tests__/*.test.mjs` 使用 node:assert 纯脚本，可直接 `node <file>` 运行。

## Functional Requirements

- **FR-1 乐理层**：新增五度圈乐理模块，提供 12 个音（降号拼写）及任一音的上行/下行纯五度邻居计算；输入支持归一化音名。
- **FR-2 难度分级**：五度圈训练设 2 个等级，按中心音是否带升降号（白键/黑键）划分：
  - L1 白键音：中心音为 C、D、E、F、G、A、B 共 7 个无升降号音。注意：白键中心音的答案仍可能是降号音（如 F 的下行五度是 B♭、B 的上行五度是 G♭），这属于五度圈本身的规律。
  - L2 全部 12 音：在 L1 基础上增加 D♭、E♭、G♭、A♭、B♭ 共 5 个黑键音。
- **FR-3 出题逻辑**：
  - 从当前等级音池（或 customNotes / 错题范围）中以错题加权方式抽取 1 个中心音（id 粒度 `circle:<中心音>`，避免连续重复同题）。
  - 题干为中心音；两个空位固定为：左 = 下行五度（逆时针）、右 = 上行五度（顺时针）。
  - 选项池共 6 个音：2 个正确答案（左/右邻居）+ 4 个干扰项。干扰项必含 2 个「两步外」音（顺/逆时针各再走一步的音，即 +2 / +10 半音），另 2 个从其余音中随机选取；6 个选项两两不同且不含中心音，顺序随机打乱。
- **FR-4 作答交互（纯点击，无键盘输入）**：
  - 题干区横向展示「[左空] ← [中心音] → [右空]」，空位上方标注「下行五度」「上行五度」。
  - 选项区为 6 个大尺寸音名按钮（移动端拇指友好，建议 3 列 × 2 行）。
  - 默认左空激活；点击选项即填入当前激活空位，随后激活焦点跳到未填的另一空；两个空都填好后立即判定，无需提交按钮。
  - 判定前允许改选：点击已填的空位可将其重新激活（该空已填音退回选项池），再点其他选项替换；同一音不能同时填入两个空（已被选用的选项按钮置为不可选态）。
- **FR-5 判定与反馈**：
  - 两个空全部填对方判为正确；任一空填错（或超时）判为错误。
  - 反馈态：正确空位/选项绿色高亮，错误空位红色并展示正确音名；反馈文案说明「<中心音> 的上行五度是 X，下行五度是 Y」。
  - 作答/超时后停留在反馈态，用户点击「下一题」才继续（复用既有状态机，不自动跳转）；超时按既有规则计错、连击清零、入错题本。
  - 音效、分数、连击、速度奖励完全复用既有规则。
- **FR-6 训练模式**：支持题量模式（20/50/100 题）、限时模式（1/3/5 分钟）、错题模式（仅出五度圈错题相关中心音）；入口与配置方式同现有两张卡片。
- **FR-7 错题本集成**：五度圈错题类型为 `circle`，记录中心音、题干文案、正确答案（下行 X · 上行 Y）、用户答案；错题本新增「五度圈」Tab、对应计数、单条移除、按模块清空、错题模式入口。
- **FR-8 统计集成**：按 `circle_<level>` 维度记录最高分/正确率/反应时长/轮次；统计页新增「五度圈」Tab 与 L1-L2 难度选择。
- **FR-9 设置集成**：新增持久化默认项 `circleLevel`（默认 1）、`circleTrainMode`（默认 count）；设置页提供五度圈默认难度与默认模式选择；重置设置覆盖新字段。
- **FR-10 首页入口**：首页新增第三张训练卡片「五度圈训练」，含难度 chips、模式选择、错题模式禁用态、开始训练跳转，与现有卡片交互一致。
- **FR-11 拼写规范**：本模块所有界面音名（题干、选项、反馈、错题、统计相关文案）一律使用降号拼写（D♭、E♭、G♭、A♭、B♭），不得出现升号音名。

## Non-Functional Requirements
- **NFR-1**：乐理与出题逻辑为纯函数、无 Vue/副作用，放在 `src/music/` 与 `src/quiz/`，具备单元测试。
- **NFR-2**：移动端布局以 375px 宽度为基准可用，选项按钮最小点击区域 ≥ 44px；PC 端浏览器正常显示。
- **NFR-3**：不破坏现有音级/和弦模块的任何功能与测试（新增代码以扩展为主，既有测试需全部通过）。
- **NFR-4**：所有数据继续走 localStorage（notemem_ 前缀），纯前端无后端；localStorage 异常时静默降级。
- **NFR-5**：TrainView 等页面继续遵守 v-if 守卫，currentQuestion 为 null 时不访问其属性。

## Constraints
- **Technical**：Vue 3 + Pinia + vue-router + Vite；不引入新依赖；测试用 node:assert 脚本。
- **Business**：升号拼写本期不做；交互遵循「不自动跳转、点下一题继续」的既定产品约束。
- **Dependencies**：复用 scales.js 的 NOTE_TO_POSITION / normalizeNoteName、generator 的 pickWeighted/shuffle、game store 状态机、sound 模块、storage 封装。

## Assumptions
- 「左右两个音」按五度圈常规图示方向：左 = 逆时针 = 下行纯五度，右 = 顺时针 = 上行纯五度；界面会明确标注方向，避免歧义。
- 一题两空以「整题」为计分/错题单位（两空全对才得分），与现有单题计分模型一致；错题粒度为中心音。
- 难度采用白键/黑键 2 级方案：L1 中心音为 7 个白键音（C D E F G A B），L2 为全部 12 音；用户已确认该分级方式。
- 选项池固定 6 个音（2 正确 + 4 干扰）。

## Acceptance Criteria

### AC-1: 五度圈邻居计算正确且全部降号拼写
- **Type**: `rule`
- **Given**: 五度圈乐理模块
- **When**: 对 12 个音逐一查询上行/下行五度音
- **Then**: 上行序列为 C→G→D→A→E→B→G♭→D♭→A♭→E♭→B♭→F→C；下行序列为 C→F→B♭→E♭→A♭→D♭→G♭→B→E→A→D→G→C；所有返回值为降号拼写且无升号字符
- **Pass Condition**: 12 个音的两个方向断言全部通过
- **Evidence**: `node src/music/__tests__/music.test.mjs` 中五度圈用例输出

### AC-2: 难度等级音池正确
- **Type**: `rule`
- **Given**: CIRCLE_DIFFICULTIES / getCircleNotesByLevel
- **When**: 查询 L1、L2 音池
- **Then**: L1 恰为 7 个白键音 [C,D,E,F,G,A,B]（均无升降号）；L2 恰为全部 12 个降号拼写音（L1 + D♭、E♭、G♭、A♭、B♭）；非法等级（0、3）抛错
- **Pass Condition**: 断言全部通过
- **Evidence**: music.test.mjs 难度用例输出

### AC-3: 出题结构正确
- **Type**: `rule`
- **Given**: generateCircleQuestion
- **When**: 生成一道五度圈题
- **Then**: 题目 type 为 'circle'，id 为 `circle:<中心音>`；options 为 6 个两两不同的音且不含中心音；slots[0] 为下行五度、slots[1] 为上行五度；correctIndices 指向 options 中对应答案；干扰项包含两个「两步外」音；explanation 含两个正确音名
- **Pass Condition**: 批量生成 200 题，结构断言全部成立
- **Evidence**: `node src/quiz/__tests__/quiz.test.mjs` 五度圈用例输出

### AC-4: 作答判定与错题记录正确
- **Type**: `rule`
- **Given**: game store 以 type 'circle' 开始训练
- **When**: 分别提交全对 [leftIdx,rightIdx]、半错、全错答案，以及模拟超时
- **Then**: 全对判正确并计分/加连击；任一错判错误、连击清零、wrongItems 新增一条 type='circle' 记录（含 center、promptText、correctAnswer「下行 X · 上行 Y」）；超时 selectedIndex=-1 且入错题；feedback 态后需 nextQuestion 才继续
- **Pass Condition**: store 测试断言全部通过
- **Evidence**: `node src/stores/__tests__/game.test.mjs` 五度圈用例输出

### AC-5: 错题模式与错题加权生效
- **Type**: `rule`
- **Given**: 错题本中存在 circle 错题
- **When**: 以 trainMode 'wrong' 开始五度圈训练；普通模式下传入 wrongQuestions
- **Then**: 错题模式出题中心音限定在错题涉及的中心音集合内；普通模式以 50% 概率优先抽错题中心音；wrongbook.clearAll('circle') 仅清五度圈错题、circleCount 计数正确
- **Pass Condition**: 断言全部通过
- **Evidence**: game.test.mjs / storage 相关用例输出

### AC-6: 全链路页面可用
- **Type**: `rule`
- **Given**: 应用启动
- **When**: 首页选择五度圈卡片 → 选题量/限时/错题模式 → 训练页作答多题（含对/错/超时）→ 结算页 → 错题本 Tab → 统计 Tab → 设置页
- **Then**: 各页五度圈入口、跳转、展示、数据落库均正常；非法 level（<1 或 >2）直达 /train 时回首页；刷新结算页无数据时回首页
- **Pass Condition**: 浏览器走查全程无控制台错误、无白屏
- **Evidence**: 构建成功 + 浏览器走查记录（review.md）

### AC-7: 现有模块无回归
- **Type**: `rule`
- **Given**: 新增五度圈模块后的代码库
- **When**: 运行全部既有单元测试并执行 vite build
- **Then**: music/quiz/game/storage 全部测试通过，构建成功无报错
- **Pass Condition**: 所有测试退出码 0，build 成功
- **Evidence**: 测试与构建命令输出

### AC-8: 训练页交互与视觉质量
- **Type**: `rubric`
- **Dimension**: 五度圈训练页的移动端交互可用性与视觉一致性
- **Scale**: 1-5
- **Anchors**: 1 = 布局错乱/按钮难以点按/反馈看不懂；3 = 功能可用但布局或反馈有明显瑕疵；5 = 空位-中心音-空位结构直观，6 选项拇指友好，激活/已选/对错状态清晰，与现有页面视觉风格统一
- **Pass Threshold**: >= 4
- **Evidence**: 浏览器移动端视口走查截图/记录（review.md）
