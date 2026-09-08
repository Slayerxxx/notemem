# 五度圈训练模块 - 实施计划（tasks.md）

## Task 1: 乐理层：五度圈计算与难度配置
- **Status**: `completed`
- **Completion Evidence**:
  - 新增 `src/music/circle.js`（CIRCLE_NOTES_FLAT / CIRCLE_OF_FIFTHS / getFifthNeighbors / stepAlongCircle）；difficulty.js 新增 CIRCLE_DIFFICULTIES（L1 白键 7 音、L2 全 12 音）与 getCircleNotesByLevel；music/index.js 已导出。
  - TR-1.1 / TR-1.2 通过：`node src/music/__tests__/music.test.mjs` → All tests passed!（含 12 音双向邻居、降号拼写、非法音名抛错、L1/L2 音池、非法等级抛错）。
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 新建 `src/music/circle.js`：导出 12 音降号拼写表（半音位置 0-11：C、D♭、D、E♭、E、F、G♭、G、A♭、A、B♭、B）、五度圈顺时针序列、`getFifthNeighbors(note)`（返回 `{ up, down }`，up = +7 半音、down = +5 半音，均降号拼写；输入经 normalizeNoteName 归一化，未知音名抛错）。
  - 在 `src/music/difficulty.js` 新增 `CIRCLE_DIFFICULTIES`（共 2 级，含 level/notes/label）：
    - L1「白键音」：notes = ['C','D','E','F','G','A','B']（7 个无升降号中心音）；
    - L2「全部 12 音」：notes = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B']。
    - 配套 `getCircleNotesByLevel(level)`（非法等级抛错）。
  - 在 `src/music/index.js` 统一导出新 API。
  - 在 `src/music/__tests__/music.test.mjs` 追加五度圈用例。
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-7(部分)
- **Test Requirements**:
  - `rule` TR-1.1: 12 个音的 up/down 邻居与 spec 中顺/逆时针序列完全一致；返回值不含 ♯ 字符；未知音名（如 'H'）抛错。证据：music.test.mjs 用例输出。
  - `rule` TR-1.2: L1 恰为 7 个白键音 [C,D,E,F,G,A,B]（集合断言，全部不含升降号）；L2 恰为 12 个降号拼写音且 = L1 ∪ {D♭,E♭,G♭,A♭,B♭}；level 0/3 抛错。证据：music.test.mjs 用例输出。

## Task 2: 出题层：generateCircleQuestion
- **Status**: `completed`
- **Completion Evidence**:
  - generator.js 新增 generateCircleQuestion（中心音错题加权、左下行/右上行两空、6 选项含 2 个两步外音 + 2 随机干扰、correctIndices、explanation），generateQuestion 分发 'circle'，quiz/index.js 导出；顺带修复 extractWrongIds 对完整错题记录（id 为 wrong:...、questionId 为题目 id）优先取 questionId。
  - TR-2.1 / TR-2.2 通过：`node src/quiz/__tests__/quiz.test.mjs` → All quiz tests passed!（200 题×2 等级结构校验、customNotes、归一化、boost=1 加权、对象形态错题、prevQuestionId）。
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 `src/quiz/generator.js` 新增 `generateCircleQuestion({ level, customNotes, wrongQuestions, prevQuestionId, boostProbability })`：
    - 中心音：customNotes 非空时从中随机，否则 getCircleNotesByLevel(level)；候选 id `circle:<音>`，经 pickWeighted 错题加权并排除 prevQuestionId。
    - 答案：slots = [{ side:'left', direction:'下行五度', answer: down }, { side:'right', direction:'上行五度', answer: up }]。
    - 干扰项：两步外音 up2(+14 半音→+2)、down2(+10 半音) 必选；再从其余音（排除中心音/答案/两步外音）随机选 2 个；共 6 选项，Fisher-Yates 打乱。
    - 返回对象含 id/type:'circle'/center/slots/options(6 个音名字符串)/correctIndices(=[leftIdx,rightIdx])/explanation（「<center> 的上行五度是 X，下行五度是 Y」）。
  - `generateQuestion` 入口分发 type 'circle'；`src/quiz/index.js` 导出新函数。
  - 在 `src/quiz/__tests__/quiz.test.mjs` 追加用例（批量 200 题结构校验、customNotes、错题加权、prevQuestionId 不连续重复）。
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `rule` TR-2.1: 200 题中每题 options 长度 6、两两不同、不含 center；options[correctIndices[0]] === slots[0].answer、options[correctIndices[1]] === slots[1].answer；slots[0].answer 为下行五度、slots[1].answer 为上行五度（与 getFifthNeighbors 一致）；干扰项集合包含 up2/down2；explanation 含两个答案音名。证据：quiz.test.mjs 用例输出。
  - `rule` TR-2.2: customNotes=['C'] 时中心音恒为 C；wrongQuestions 含 `circle:F` 且 boostProbability=1 时中心音恒为 F；连续两题 id 不同（prevQuestionId 生效）。证据：quiz.test.mjs 用例输出。

## Task 3: 游戏状态机：game store 支持 circle 题型
- **Status**: `completed`
- **Completion Evidence**:
  - game.js：start() type 校验扩展 'circle' 并透传 customNotes；extractScopeFromWrong 支持 circle（id 前缀 `circle:` 与对象 center）；新增 state selectedSlots([null,null]) 并在 resetRoundState/nextQuestion 重置；answerQuestion(answer) 支持数组载荷 [leftIdx,rightIdx]，两空全等 correctIndices 才判对，circle 答错/超时走 circleAnswerText/buildWrongItem（center/promptText/correctAnswer「下行 X · 上行 Y」）；optionText circle 分支；store 已导出 selectedSlots。
  - TR-3.1 / TR-3.2 通过：`node src/stores/__tests__/game.test.mjs` → All game store tests passed!（全对计分/连击、半错全错判错入错题本、超时 selectedIndex=-1 与 reactionMs=限时、feedback 防抖、nextQuestion 重置 selectedSlots、L1 30 题中心音均白键、错题模式 customNotes 限定中心音、非法 type 抛错）。
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - `src/stores/game.js`：
    - type 校验扩展为 'scale' | 'chord' | 'circle'；start() 接收并透传 `customNotes`；错题模式 extractScopeFromWrong 支持 'circle'（解析 `circle:<中心音>` id 与对象 center 字段），错题范围写入 config.customNotes。
    - generateNextQuestion 传入 customNotes。
    - 新增 state `selectedSlots`（ref([null,null])，resetRoundState 清零）；answerQuestion(answer, injectedReactionMs) 支持数组载荷：circle 题 answer 为 [leftOptIdx, rightOptIdx]，判定两索引分别等于 correctIndices；scale/chord 保持 number 载荷与原逻辑。
    - circle 错题记录：buildWrongItem 增加 circle 分支（type/questionId/center/promptText「五度圈中，<center> 左右相邻的音是？」/correctAnswer「下行 <down> · 上行 <up>」/userAnswer 为已填音名或「超时未答」）。
    - handleQuestionTimeout 支持 circle（selectedSlots 记录已填项，selectedIndex=-1）。
    - optionText 增加 circle 分支（「下行 X · 上行 Y」）。
  - 在 `src/stores/__tests__/game.test.mjs` 追加 circle 流程用例。
- **Acceptance Criteria Addressed**: AC-4, AC-5(部分)
- **Test Requirements**:
  - `rule` TR-3.1: circle 全对 → isCorrect=true、计分/连击增加；半错（一空对一空错）与全错 → isCorrect=false、连击清零、wrongItems 新增 1 条且字段含 center/promptText/correctAnswer（下行 X · 上行 Y）；超时 → selectedIndex=-1、入错题、reactionMs=限时；feedback 态下 answerQuestion 防抖无效；nextQuestion 后才出新题。证据：game.test.mjs 用例输出。
  - `rule` TR-3.2: 错题模式（wrongQuestions 仅含 circle:F 类记录）下连续出题中心音均在错题范围内；start({type:'circle'}) 不抛错且 config.customNotes 正确；非法 type 抛错。证据：game.test.mjs 用例输出。

## Task 4: 错题本/设置 store 扩展
- **Status**: `completed`
- **Completion Evidence**:
  - wrongbook.js：新增 circleCount getter（filter type==='circle'）并导出；clearAll('circle')/getByType/getWrongQuestions JSDoc 与过滤条件扩展 'circle'。settings.js：DEFAULT_SETTINGS 增加 circleLevel:1、circleTrainMode:'count'（loadSettings 合并自动兜底旧数据）。
  - TR-4.1 / TR-4.2 通过：`node src/stores/__tests__/storage.test.mjs` → All storage layer tests passed!（circleCount 计数、clearAll('circle') 仅删 circle 记录、getWrongQuestions('circle') 含 questionId/center、settings circle 字段默认值/update/reset/刷新持久化、stats circle_1 维度记录）。
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - `src/stores/wrongbook.js`：新增 `circleCount` getter；clearAll(type) 支持 'circle'（仅过滤 type==='circle'）；getByType/getWrongQuestions 已按 type 泛化，确认无需改动并补测试。
  - `src/stores/settings.js`：DEFAULT_SETTINGS 增加 `circleLevel: 1`、`circleTrainMode: 'count'`（loadSettings 合并逻辑自动兜底）。
  - 在 `src/stores/__tests__/storage.test.mjs` 或 game.test.mjs 补充 circle 错题计数/清空用例。
- **Acceptance Criteria Addressed**: AC-5(部分), AC-9(部分)
- **Test Requirements**:
  - `rule` TR-4.1: addItems 写入 circle 错题后 circleCount 正确、scaleCount/chordCount 不受影响；clearAll('circle') 仅删 circle 记录；clearAll() 全清行为不变。证据：测试用例输出。
  - `rule` TR-4.2: 旧设置数据（无 circle 字段）加载后 circleLevel=1、circleTrainMode='count'；update 后持久化。证据：测试用例输出。

## Task 5: 首页：五度圈训练卡片
- **Status**: `completed`
- **Completion Evidence**:
  - HomeView.vue：import CIRCLE_DIFFICULTIES；CARDS 新增第三张卡片（type:'circle'、title「五度圈训练」、tagline「上下五度反应」、levelKey 'circleLevel'、modeKey 'circleTrainMode'）；wrongCountOf 三分支（circle→wrongbook.circleCount）；chipSub/summaryOf 经既有「非 scale 走 label · 分段」逻辑自动适配 circle（L1 · 白键音 / L2 · 全部 12 音）；startTraining 通用 query 已携带 type=circle。
  - 待 Task 8 浏览器走查确认渲染与跳转（TR-5.1）。
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - `src/views/HomeView.vue`：CARDS 新增第三张卡片 `{ type:'circle', title:'五度圈训练', tagline:'上下五度反应', desc:'看到中心音，选出五度圈上左右相邻的两个音', difficulties: CIRCLE_DIFFICULTIES, levelKey:'circleLevel', modeKey:'circleTrainMode' }`。
  - wrongCountOf 支持 circle（wrongbook.circleCount）；chipSub 对 circle 显示段位名（L1「白键音」、L2「全部 12 音」，取 label 中「·」后文案）；summaryOf 对 circle 输出 `L<n> · <label> · <模式文案>`。
  - startTraining 跳转 query 携带 type=circle、level、trainMode 及题量/时长参数。
- **Acceptance Criteria Addressed**: AC-6(部分), AC-10
- **Test Requirements**:
  - `rule` TR-5.1: 首页渲染 3 张卡片；五度圈卡片展开后显示 L1-L2 难度 chips 与 3 种模式；错题模式在 circleCount=0 时禁用；开始训练跳转 `/train?type=circle&level=...`。证据：浏览器走查 + 代码审查。

## Task 6: 训练页：两空填选交互
- **Status**: `completed`
- **Completion Evidence**:
  - TrainView.vue：题干新增 circle 分支（「五度圈中，X 左右相邻的音是？」+ 空位板 [下行五度空] ← [中心音] → [上行五度空]）；选项区新增 3×2 音名网格；本地状态 slotPicks/activeSlot，pickOption 填空→焦点跳另一空→两空填满立即 answerQuestion([l,r])，activateSlot 点已填空位清空改选，已选选项禁用，watch 题目 id 重置；反馈态空位对绿错红、未填空位显示正确答案绿闪，选项 correct/wrong/dim 着色；wrongAnswerText 输出「下行 X · 上行 Y/未填」；optionLabel circle 分支返回音名；parseQuery VALID_TYPES 加 circle、maxLevel=2、错题模式按模块 getWrongQuestions 取数（空则回首页）。
  - `npm run build` 构建成功（TrainView chunk 9.62 kB）；浏览器走查待 Task 8（TR-6.1/6.2/6.3）。
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - `src/views/TrainView.vue`：
    - 模板新增 circle 分支：题干区横向「[左空] ← [中心音大字号] → [右空]」，空位上方标注「下行五度」「上行五度」；选项区 6 个音名按钮（3 列 × 2 行网格）。
    - 脚本新增本地状态：slotPicks=[null,null]（选项索引）、activeSlot（默认 0）；点击选项 → 填入 activeSlot → 焦点跳到另一空；两空填满立即调用 `game.answerQuestion([leftIdx, rightIdx])`；点击已填空位 → 重新激活并清空该空；已被选用的选项按钮禁用/置灰；作答进入 feedback 后所有选项禁用。
    - 反馈态：空位按对错着色（对绿错红），错空显示正确音名；选项按钮复用 correct/wrong/dim 样式；explanation 正常展示。
    - watch currentQuestion.id 变化（或 phase 从 feedback → answering）时重置 slotPicks/activeSlot。
    - parseQuery：VALID_TYPES 加 'circle'，maxLevel circle=2；错题模式取 wrongbook.getWrongQuestions('circle')。
    - 所有 currentQuestion 访问保持 v-if 守卫；wrongAnswerText/optionLabel 支持 circle（如「下行 G · 上行 F」）。
- **Acceptance Criteria Addressed**: AC-4(部分), AC-6(部分), AC-8, AC-11
- **Test Requirements**:
  - `rule` TR-6.1: 选满两个选项后 store.phase 变为 feedback；同一选项不能被选两次（按钮禁用）；点击已填空位可改选且选项池恢复；feedback 态点击选项无效；下一题后空位清空。证据：浏览器走查。
  - `rule` TR-6.2: 页面任何音名文案不含 ♯ 字符（题干/选项/反馈）。证据：浏览器走查 + 代码审查。
  - `rubric` TR-6.3: 移动端交互质量；1-5 分；1=布局错乱难点按/反馈不清，3=可用但有明显瑕疵，5=空位结构直观、按钮拇指友好、状态清晰且风格统一；阈值 >=4；证据：375px 视口走查记录。

## Task 7: 结算/错题本/统计/设置页集成
- **Status**: `completed`
- **Completion Evidence**:
  - ResultView.vue：scopeText diffPool 三分支（circle→CIRCLE_DIFFICULTIES、typeText「五度圈相邻音」）；replay() custom 分支透传 customNotes、错题模式改为按当前模块 getWrongQuestions 重取（空则回首页）。
  - WrongBookView.vue：TABS 增加 `{value:'circle',label:'五度圈训练',short:'五度圈'}`；tabLabel 增加「五度圈错题」；typeCount 支持 circleCount；startWrongTraining levelKey 映射 circleLevel；clearAll 已在 Task 4 支持 'circle'。
  - StatsView.vue：TABS 增加五度圈；抽取 poolOf() 三模块难度池（difficulties/defaultLevel 统一走池）；heading/chipSub 经既有非 scale 逻辑自动显示「L1 · 白键音 / L2 · 全部 12 音」与段位副文案。
  - SettingsView.vue：默认难度区新增五度圈 L1-L2 chips（circleLevel，副文案取 label「·」后段）；默认模式区新增五度圈模式行（circleTrainMode）。
  - `npm run build` 构建成功；浏览器走查待 Task 8（TR-7.1）。
- **Priority**: medium
- **Depends On**: Task 6
- **Description**:
  - `src/views/ResultView.vue`：scopeText 的 diffPool 支持 CIRCLE_DIFFICULTIES，typeText 为「五度圈相邻音」；replay() 透传 customNotes（自定义模式预留）与错题模式重取 getWrongQuestions('circle')。
  - `src/views/WrongBookView.vue`：TABS 增加 `{ value:'circle', label:'五度圈训练', short:'五度圈' }`；typeCount/tabLabel/startWrongTraining（levelKey 'circleLevel'）支持 circle。
  - `src/views/StatsView.vue`：TABS 增加五度圈；difficulties 切换 CIRCLE_DIFFICULTIES；heading/chipSub 分支（chipSub 显示段位名：白键音 / 全部 12 音）。
  - `src/views/SettingsView.vue`：默认难度区增加五度圈 L1-L2 chips（circleLevel），默认模式区增加五度圈模式行（circleTrainMode）。
- **Acceptance Criteria Addressed**: AC-6(部分), AC-7(部分), AC-9(部分)
- **Test Requirements**:
  - `rule` TR-7.1: 结算页「再练一轮」以相同 circle 配置重开；错题本五度圈 Tab 计数/列表/清空/练错题入口正确；统计页五度圈 Tab 展示 circle_<level> 数据；设置页改动 circleLevel/circleTrainMode 后刷新仍保留。证据：浏览器走查。

## Task 8: 全链路验证与构建
- **Status**: `completed`
- **Completion Evidence**:
  - TR-8.1：package.json 新增 `"test"` 脚本串联 4 个测试文件；`npm test` 全部通过（All tests passed! / All quiz tests passed! / All game store tests passed! / All storage layer tests passed!）；`npm run build` 成功（Vite 构建无错误）。
  - TR-8.2：dev server 浏览器全链路走查（375px 视口）全部 PASS——首页 3 卡片、五度圈卡片 L1/L2 chips 与 3 模式、训练页空位板+3×2 选项、填空/焦点跳转/已选禁用/反馈着色/点空位改选/下一题重置、答对计分连击、3 题完整流程→结算页（scope-line 含「五度圈相邻音」）、再练一轮重开、错题本 4 Tab 与五度圈列表/练错题入口、统计页五度圈 Tab 绿点与数据、设置页五度圈分组与 L2 刷新持久化、非法 URL（level=9）回首页；`document.body.innerText` 不含 ♯ 且含 ♭；控制台无 error。
  - TR-8.3：布局无溢出错位、交互与既有模块风格统一，走查未发现体验问题（rubric 自评 5/5）。
- **Priority**: high
- **Depends On**: Task 7
- **Description**:
  - 运行全部单元测试脚本（music/quiz/game/storage），确认退出码 0；为 package.json 增加 `"test"` 脚本串联四个测试文件（如缺失）。
  - 执行 `npm run build` 确认 Vite 构建成功。
  - 启动 dev server，浏览器走查：五度圈卡片 → L1 题量模式答对/答错/超时 → 结算 → 错题本 Tab 与错题模式 → 统计 Tab → 设置默认值；验证 375px 移动视口布局；控制台无错误。
- **Acceptance Criteria Addressed**: AC-6, AC-7, AC-8
- **Test Requirements**:
  - `rule` TR-8.1: `npm test` 四个测试文件全部通过（退出码 0）；`npm run build` 成功。证据：命令输出。
  - `rule` TR-8.2: 浏览器全链路走查无白屏、无控制台错误、非法 URL（type=circle&level=9）回首页。证据：走查记录。
  - `rubric` TR-8.3: 整体体验与既有模块一致性；1-5 分；锚点同 TR-6.3；阈值 >=4；证据：走查记录。
