# 和弦进行识别训练模块 - 验证检查清单（checklist.md）

## 文件名解析与 manifest 构建
- [ ] Checkpoint 1: `parseProgressionFilename('A - I I7 Idom7 I7 - Relaxed Playful.mid')` 返回 `{ key:'A', mode:'major', progressionTokens:['I','I7','Idom7','I7'], mood:['Relaxed','Playful'], style:'baseline' }`
- [ ] Checkpoint 2: 子目录文件 `Major/pop style/A - I V vi IV - Hopeful.mid` 解析 style 为 `'pop'`、mode 为 `'major'`
- [ ] Checkpoint 3: Modal 类含 `#`/`b` 前缀 token（如 `#IVdim`、`bVIIM`）原样保留到 progressionTokens
- [ ] Checkpoint 4: 缺 `-` 分隔的非法文件名抛 `Error`
- [ ] Checkpoint 5: `npm run build:manifest` 生成 `public/midi/manifest.json`，三数组 record 数 ≥ 11,400（major≥3000, minor≥3480, modal≥4920）
- [ ] Checkpoint 6: manifest.json 抽样 10 条，每条 url 以 `/midi/` 开头、对应文件确实存在

## MIDI 播放引擎与音色加载
- [ ] Checkpoint 7: `getBpmForStyle('baseline')`=`90`、`('soul')`=`70`、`('hiphop2')`=`115`、未知=`90`
- [ ] Checkpoint 8: `playProgression({ midiUrl, bpm, ctx, instrument })` 按 BPM 重算 startSec/durSec 正确（mock AudioContext 验证）
- [ ] Checkpoint 9: 控制器 `stop()` 后 `isPlaying()` 为 false 且 scheduledNodes 清空
- [ ] Checkpoint 10: 浏览器实际加载一条 manifest url 听到钢琴音色播放（无「数字感」合成声）
- [ ] Checkpoint 11: 音色加载失败时 fallback 到 `src/sound/index.js` 合成提示音、不阻塞训练流程、UI 显示提示

## 乐理与出题逻辑
- [ ] Checkpoint 12: L1 难度池全部 mode=major、style=baseline、progressionTokens 均为无后缀纯三和弦
- [ ] Checkpoint 13: L2 难度池全部 mode=major、style=baseline、至少含 1 个后缀 token
- [ ] Checkpoint 14: L3 全 mode=minor、L4 全 mode=modal，均为 baseline
- [ ] Checkpoint 15: 非法 level（0、5）抛错
- [ ] Checkpoint 16: `generateProgressionQuestion` 输出 type='progression'、id=`progression:<mode>:<key>:<tokenHash>`、4 个 tokenHash 两两不同的 options
- [ ] Checkpoint 17: 干扰项至少含 1 个顺序调换或 token 替换策略
- [ ] Checkpoint 18: promptText 形如「请听这段大调和弦进行，调性：C 大调」（major→大调、minor→小调、modal→Modal 进行）
- [ ] Checkpoint 19: 传入 wrongQuestions 时 50% 命中错题 tokenHash；customProgressions 限定出题 tokenHash 集合

## 游戏状态机
- [ ] Checkpoint 20: `start({ type:'progression' })` 不报错；其他非法 type 报错
- [ ] Checkpoint 21: 渲染题目后未调 `startProgressionTimer`，questionRemainingMs 不递减
- [ ] Checkpoint 22: 调 `startProgressionTimer` 后倒计时启动；超时入错题本，selectedIndex=-1、reactionMs=限时、连击清零
- [ ] Checkpoint 23: 答对计分+连击增加；答错连击清零入错题本
- [ ] Checkpoint 24: feedback 态后需用户点「下一题」才继续，不自动跳转
- [ ] Checkpoint 25: 错题记录字段齐全：type/mode/key/tokenHash/promptText/correctAnswer/userAnswer/createdAt
- [ ] Checkpoint 26: `extractScopeFromWrong` 对 progression 错题解析 id 三元组正确，写入 config.customProgressions

## 其他 store 集成
- [ ] Checkpoint 27: wrongbook.progressionCount 计数正确；clearAll('progression') 仅清进行错题、不影响其他类型
- [ ] Checkpoint 28: settings 持久化 progressionLevel（默认 1）与 progressionTrainMode（默认 'count'）；reset 覆盖
- [ ] Checkpoint 29: stats recordSession `progression_<level>` 维度正确累加（keyOf 泛型自动支持）

## 视图与交互
- [ ] Checkpoint 30: 首页第 4 张卡片「和弦进行训练」展示正确，难度 chips 切换 L1-L4、模式选择 count/limited、错题模式禁用态生效
- [ ] Checkpoint 31: 训练页 progression 分支题干显示 promptText + 调性提示 + ▶ 播放按钮 + 进度条 + 4 选项罗马数字序列
- [ ] Checkpoint 32: 点击 ▶ 调用 startProgressionTimer 并播放真实钢琴音色；首次点击触发计时起点
- [ ] Checkpoint 33: 点击选项后进入 feedback，正确项绿色高亮、错选项红色、正确进行字符串展示、复听按钮可用
- [ ] Checkpoint 34: 移动端 375px 宽度下播放按钮 ≥ 44px、4 选项按钮 ≥ 44px 高、无水平滚动
- [ ] Checkpoint 35: PC 端浏览器训练页布局正常，无白屏、无控制台错误
- [ ] Checkpoint 36: ResultView 显示「和弦进行识别 · L1 大调三和弦」等正确文案
- [ ] Checkpoint 37: WrongBookView「进行训练」Tab 显示 progression 错题
- [ ] Checkpoint 38: StatsView「进行训练」Tab 显示 L1-L4 难度数据
- [ ] Checkpoint 39: SettingsView 设置 progressionLevel=L2 → 刷新后保持；设置模式为 limited → 生效

## 全链路与回归
- [ ] Checkpoint 40: 全链路：首页 → 进行训练卡片 → 选题量 20 → 训练页（音色加载）→ 答完 20 题（含对/错/超时）→ 结算页 → 错题本 → 统计 → 设置，全程无控制台错误、无白屏
- [ ] Checkpoint 41: 错题模式入口 → 出题限定在错题 tokenHash 集合
- [ ] Checkpoint 42: 既有音级/和弦/五度圈三模块全部单元测试通过，无回归
- [ ] Checkpoint 43: 既有三模块浏览器走查功能正常（跑一轮训练无白屏、数据落库）
- [ ] Checkpoint 44: `npm run build:manifest` 重新生成 manifest.json 成功
- [ ] Checkpoint 45: `npm run build` 构建成功，dist 产物完整（含 manifest.json、soundfonts/acoustic_grand_piano.js、midi/ 全量）
- [ ] Checkpoint 46: 构建后 dist/index.html 静态部署可完整运行，进行训练模块功能齐全
