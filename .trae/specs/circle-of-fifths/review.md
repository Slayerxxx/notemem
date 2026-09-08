# 五度圈训练模块 - 评审记录（review.md）

## 评审范围

对「五度圈训练（circle）」模块的全部变更做独立只读审查，对照 spec.md 的 AC-1 ~ AC-8 逐条核验，并执行测试、构建与浏览器复验。

变更文件：

- 新增：`src/music/circle.js`（乐理层）
- 修改：`src/music/difficulty.js`、`src/music/index.js`、`src/quiz/generator.js`、`src/quiz/index.js`、`src/stores/game.js`、`src/stores/wrongbook.js`、`src/stores/settings.js`、`src/stores/stats.js`、`src/views/HomeView.vue`、`src/views/TrainView.vue`、`src/views/ResultView.vue`、`src/views/WrongBookView.vue`、`src/views/StatsView.vue`、`src/views/SettingsView.vue`、`package.json`
- 测试：`src/music/__tests__/music.test.mjs`、`src/quiz/__tests__/quiz.test.mjs`、`src/stores/__tests__/game.test.mjs`、`src/stores/__tests__/storage.test.mjs`

## 首轮独立审查结论：PASS WITH ISSUES

核心乐理、出题、状态机、集成面均正确；发现 1 个 Major、6 个 Minor。

### Major 问题与修复

| 编号 | 问题 | 修复 |
| --- | --- | --- |
| M-1 | 错题模式下单一中心音（同一 questionId 多条错题）时，生成器排除上一题后候选池为空会回退，导致**连续题目 id 相同**（如 3 题全是 `circle:B♭`）。TrainView 的 watch 源是 `currentQuestion?.id`，id 不变则不触发，两空本地状态（slotPicks/activeSlot）不重置——新题空位残留上题音名、选项错误禁用 | watch 源改为题目对象引用 `() => game.currentQuestion`（每题均为新对象，id 相同也触发重置），见 [TrainView.vue:219-225](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/views/TrainView.vue#L219-L225) |

### Minor 问题与修复

| 编号 | 问题 | 修复 |
| --- | --- | --- |
| m-1 | 超时由 store 计时器触发，拿不到视图半填状态，五度圈题超时错题一律记「超时未答」，与反馈页展示不一致 | 新增 store action `setCircleSlots(slots)`，训练页 watch slotPicks 实时同步；`handleQuestionTimeout` 对 circle 半填情况用 `circleAnswerText` 记录「下行 X · 上行 未填」，全空仍记「超时未答」（[game.js:510-522](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/stores/game.js#L510-L522)、[game.js:318-339](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/stores/game.js#L318-L339)、[TrainView.vue:227-235](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/views/TrainView.vue#L227-L235)） |
| m-2 | 错空红色槽只显示用户错选音，FR-5 字面要求「错误空位红色并展示正确音名」 | 错空下方新增绿色小字「✓ 正确音名」（`slotCorrectNote` + `.slot-correct` 样式），未填空位仍绿闪显示正确音（[TrainView.vue:63-65](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/views/TrainView.vue#L63-L65)、[TrainView.vue:316-323](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/views/TrainView.vue#L316-L323)） |
| m-3 | 反馈横幅「你的答案」用「下行五度/上行五度」，错题本用「下行/上行」，文案不统一 | 横幅统一为「下行 X · 上行 Y（未填）」格式（[TrainView.vue:268-277](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/views/TrainView.vue#L268-L277)） |
| m-4 | customNotes 仅做 normalizeNoteName，若未来传入升号拼写（如 F#）题面会出现 ♯ | 新增 `toFlatName(note)` 乐理函数（任意拼写→降号拼写），`resolveNotePool` 对 customNotes 统一映射；已从 music/index.js 导出（[circle.js:82-95](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/music/circle.js#L82-L95)、[generator.js:430-436](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/quiz/generator.js#L430-L436)） |
| m-5 | 既有 flaky 测试：音级 L1-L12 各 50 题覆盖 7 音级的统计断言偶发失败（整轮概率约 3.5%），与本次变更无关但影响 `npm test` 稳定性 | 样本量 50 → 200（漏抽概率降至可忽略），并注释说明（[quiz.test.mjs:103-114](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/quiz/__tests__/quiz.test.mjs#L103-L114)） |
| m-6 | stats.js recordSession JSDoc 类型仍写 `'scale'|'chord'` | 改为 `'scale'|'chord'|'circle'`（[stats.js:67](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/stores/stats.js#L67)） |

### 审查特别确认项

- **升号字符排查**：circle 模块所有用户可见路径（题干/选项/反馈/explanation/错题文案/各视图）均无 ♯ 字符；数据链路全部源自 `CIRCLE_NOTES_FLAT` 或 `flatNameAt` 输出。grep 命中的 ♯ 仅存在于音级/和弦模块的既有合法内容（F♯ 大调等）与代码注释。
- **回归面**：`answerQuestion` 数组载荷仅在 circle 分支生效，scale/chord 单选路径 `answer === q.correctIndex` 原样保留；`extractWrongIds` 的 `questionId ?? id` 对旧简写形态有回退；wrongbook.clearAll 无参全清行为不变。

## 修复后复验

### 自动化验证

- `npm test`（music / quiz / game / storage 四套）：**全部通过**；quiz 测试连续 5 轮独立运行全部 PASS（flaky 已消除）。
- `npm run build`：**成功**（Vite 构建无错误）。
- 新增测试覆盖：半填超时错题文案、setCircleSlots 非 circle 守卫、toFlatName 归一化（含 F#→G♭、C#→D♭）、customNotes 升号输入题面无 ♯。

### 浏览器复验（375px 视口，全部 PASS）

1. **M-1 复验**：注入 3 条同中心音（B♭）错题 → 错题模式连出 3 题 id 均为 `circle:B♭` → 每题进入答题态后两空均重置为「？」、6 选项全部恢复可点，无残留禁用；可正常走到结算页。
2. **m-2 复验**：故意两空全错，反馈态两个红色空位下方各显示绿色「✓ 正确音名」（实测「✓ E」「✓ G♭」），正确选项绿闪，explanation 正常。
3. **m-3 复验**：反馈横幅文案为「你的答案：下行 X · 上行 Y」，与错题本格式一致。
4. 全程控制台无 error 级别消息。

### 首轮全链路走查结论（修复前已通过，修复后未回归）

首页 3 卡片 / 五度圈 L1-L2 chips 与 3 模式 / 训练页空位板与 3×2 选项 / 填空-跳焦-禁用-改选-反馈着色 / 答对计分连击 / 结算页「五度圈相邻音」范围文案与再练一轮 / 错题本 4 Tab 与练错题入口 / 统计页五度圈 Tab 与绿点 / 设置页五度圈分组与 L2 刷新持久化 / 非法 URL（level=9）回首页。

## AC 终验

| AC | 结论 | 证据 |
| --- | --- | --- |
| AC-1 邻居计算与降号拼写 | PASS | music.test.mjs 12 音双向断言 + 无 ♯ 断言 + toFlatName 用例 |
| AC-2 难度音池 | PASS | music.test.mjs L1 七白键 / L2 十二音 / 非法等级抛错 |
| AC-3 出题结构 | PASS | quiz.test.mjs 200 题×2 等级结构校验、干扰项含两步外音 |
| AC-4 作答判定与错题记录 | PASS | game.test.mjs 全对/半错/全错/超时（含半填超时）/防抖 |
| AC-5 错题模式与加权 | PASS | game.test.mjs 错题范围限定、storage.test.mjs circleCount/clearAll |
| AC-6 全链路页面 | PASS | 两轮浏览器走查全部 PASS，无控制台错误 |
| AC-7 无回归 | PASS | 四套测试通过、build 成功、quiz 5 轮连跑稳定 |
| AC-8 交互与视觉质量（rubric） | PASS（5/5） | 空位结构直观、按钮 ≥60px 拇指友好、激活/已选/对错状态清晰、风格与既有模块统一；错空正确音名提示进一步提升反馈可读性 |

## 最终结论

**PASS** — 全部 AC 达标，审查发现的 1 个 Major 与 6 个 Minor 均已修复并经自动化测试与浏览器复验确认。
