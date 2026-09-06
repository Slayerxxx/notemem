# NoteMem - 实现计划任务清单

## [x] Task 1: 项目初始化 - Vue 3 + Vite 脚手架搭建
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 使用 Vite 初始化 Vue 3 项目，配置基础项目结构
  - 安装并配置 Vue Router（页面路由管理）
  - 配置移动端视口 meta、基础 CSS reset、全局样式变量
  - 配置 Pinia（状态管理，可选，如不用则使用 Composition API + provide/inject）
  - 项目可通过 `npm run dev` 启动，显示空白首页
- **Acceptance Criteria Addressed**: AC-1（基础入口页面框架）
- **Test Requirements**:
  - `programmatic` TR-1.1: 运行 `npm run dev` 后服务正常启动，无报错，浏览器访问 localhost 可看到 Vue 应用
  - `programmatic` TR-1.2: 路由配置至少包含 3 个路径：/ (模式选择)、/train (训练页，带 query 参数区分模块)、/result (结算页)、/wrongbook (错题本)、/stats (统计)、/settings (设置)
  - `human-judgement` TR-1.3: 移动端视口下 html/body 无默认外边距，字体大小合适，无水平滚动
- **Notes**: 推荐使用 Vue 3 + Vite + Pinia + Vue Router 4 组合

## [x] Task 2: 乐理核心逻辑模块 - 音阶与和弦计算库
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 实现 12 大调定义与音级生成函数：按「全全半全全全半」生成每个调的 7 个自然音级，正确处理升降号显示
  - 实现音名规范化工具：统一音名表示（如区分 C♯ 与 D♭，按调式选择对应等音）
  - 实现大三和弦组成音计算：输入根音，返回按规范显示的组成音数组 [根音, 大三度, 纯五度]
  - 定义难度等级配置：
    - 音级训练 L1-L12：每个等级对应一个大调，按常用度（升降号数量升序）排序：L1=C(0)→L2=G(1#)→L3=F(1b)→L4=D(2#)→L5=B♭(2b)→L6=A(3#)→L7=E♭(3b)→L8=E(4#)→L9=A♭(4b)→L10=B(5#)→L11=D♭(5b)→L12=F♯(6#)；每个等级只训练该一个调，不混合
    - 和弦训练 L1-L3 根音池
    - 单题限时默认宽松（音级训练 15 秒/和弦训练 15 秒），可在自定义模式调整
  - 导出纯函数接口，独立于 Vue 组件，便于单元测试
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-15
- **Test Requirements**:
  - `programmatic` TR-2.1: C 大调音阶返回 [C, D, E, F, G, A, B]，对应音级 I-VII 正确
  - `programmatic` TR-2.2: A 大调音阶返回 [A, B, C♯, D, E, F♯, G♯]（升号显示正确），F 大调返回 [F, G, A, B♭, C, D, E]（降号显示正确）
  - `programmatic` TR-2.3: 12 大调全部可正确生成，验证 B、F♯、B♭、E♭、A♭、D♭ 等调的升降号显示
  - `programmatic` TR-2.4: C 大三和弦返回 [C, E, G]，B♭ 大三和弦返回 [B♭, D, F]，B 大三和弦返回 [B, D♯, F♯]，音程距离正确（大三度 4 半音、纯五度 7 半音）
  - `programmatic` TR-2.5: 音级难度配置：L1-L12 分别对应 C、G、F、D、B♭、A、E♭、E、A♭、B、D♭、F♯ 共 12 个调，每个等级仅一个调；默认单题限时 15 秒
- **Notes**: 这是项目的核心基础模块，务必确保乐理规则正确

## [x] Task 3: 题目生成器模块 - 出题与选项生成逻辑
- **Priority**: high
- **Depends On**: Task 2
- **Description**: 
  - 实现大调音级题目生成器：根据难度等级直接确定唯一的调（如 L6 → A 大调），从该调 7 音级中随机选 1 个音名，返回题干 + 正确答案索引（7 个固定选项 I-VII）。**注意：每个等级只训练一个固定调，不做调间随机混合**
  - 实现和弦题目生成器：从难度池随机选根音，生成大三和弦题目，返回题干 + 正确选项 + 3 个干扰项
  - 干扰项生成策略：实现相邻根音和弦、小三变体、音程错误组合 3 种干扰项构造函数，随机组合选取 3 个不重复干扰项
  - 实现错题强化权重：传入错题记录，提高对应题目（调+音级 / 根音和弦）的抽取概率
  - 导出统一题目生成接口，模块类型可扩展
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-5, AC-15
- **Test Requirements**:
  - `programmatic` TR-3.1: 音级训练生成 100 道 L1 题，调式均为 C，音级分布大致均匀（各音级出现 10-20 次）
  - `programmatic` TR-3.2: 和弦训练生成题目，正确选项的组成音与 Task 2 计算结果一致
  - `programmatic` TR-3.3: 和弦题目的 4 个选项互不相同，3 个干扰项不完全来自同一种策略（检查足够多样本）
  - `programmatic` TR-3.4: 传入错题权重后，对应题目的出现频率显著高于未加权时（可通过统计验证）
- **Notes**: 干扰项设计直接影响训练效果，确保干扰项具有迷惑性但不违反乐理

## [x] Task 4: 游戏状态管理 Store - Pinia 全局状态
- **Priority**: high
- **Depends On**: Task 1, Task 3
- **Description**: 
  - 定义游戏状态结构：当前模式（音级/和弦）、难度、训练模式（限时/题量/错题/自定义）、题目生成历史
  - 实现单题流程状态机：待出题 → 计时中 → 已作答（反馈展示，等待用户点击「下一题」）→ 下一题。**不自动跳转**，作答后进入「反馈展示」状态并停留，直到用户主动点击下一题按钮
  - 实现分数与连击计算：基础分 10 + 速度奖励（按限时比例）+ 连击加成（5连+2，10连+5），答错连击清零
  - 实现计时管理：单题计时 startTimer/stopTimer，限时模式总倒计时
  - 实现本轮训练统计收集：总题数、正确数、反应时长数组、错题列表、最快反应
  - 状态变更响应式，UI 层自动同步
- **Acceptance Criteria Addressed**: AC-6, AC-7, AC-8, AC-9, AC-10, AC-13
- **Test Requirements**:
  - `programmatic` TR-4.1: 调用 answer(isCorrect, reactionTime, timeLimit) 后分数计算正确，验证 t=0.2T→+20，t=0.4T→+15，t=0.6T→+10
  - `programmatic` TR-4.2: 连续答对 11 次，第 1-4 次各 +10（无连击），第 5-9 次 +12（+2），第 10-11 次 +15（+5）（假设无速度奖励）；第 12 次答错后下一题分数回归基础 10
  - `programmatic` TR-4.3: 限时模式 60 秒倒计时结束后，状态变为 finished，不再生成新题
  - `programmatic` TR-4.4: 题量模式 20 题完成后，状态变为 finished
- **Notes**: 此模块是游戏核心循环的大脑，确保状态转换逻辑严谨，边界 case 覆盖

## [x] Task 5: 数据持久化层 - localStorage 封装
- **Priority**: medium
- **Depends On**: Task 1
- **Description**: 
  - 封装 localStorage 操作工具：safeGet / safeSet / safeRemove，处理 JSON 序列化异常与存储容量限制
  - 定义存储键名规范：notemem_wrongbook（错题本）、notemem_stats（历史统计）、notemem_settings（用户设置）
  - 实现错题本 CRUD：添加错题、移除单条、清空全部、按模块查询
  - 实现统计数据更新：按 {模块}_{难度} 维度累积最高分、平均正确率、平均反应时间
  - 实现用户设置存取：当前选择难度、训练模式偏好、自定义配置
  - 应用启动时自动读取 localStorage 初始化状态
- **Acceptance Criteria Addressed**: AC-11, AC-12
- **Test Requirements**:
  - `programmatic` TR-5.1: 添加错题后刷新页面，错题本读取到相同数量和内容
  - `programmatic` TR-5.2: 移除单条错题后，该条不再出现在列表中
  - `programmatic` TR-5.3: 清空错题本后列表为空，但统计数据与设置不受影响
  - `programmatic` TR-5.4: localStorage 不可用时（如隐私模式）降级处理，应用不崩溃，仅数据不持久化
  - `human-judgement` TR-5.5: 关闭浏览器重新打开后，上次的设置、统计、错题依然存在
- **Notes**: 存储键加前缀避免与同域其他应用冲突；所有操作加 try-catch

## [/] Task 6: 页面组件 - 模式选择页（首页）
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 页面布局：顶部 Logo 标题，中部两大训练入口卡片（大调音级反应训练 / 和弦组成音训练），底部功能入口行（错题本、统计、设置）
  - 「大调音级反应训练」入口卡片：展示当前选择难度（L1-L12，每个等级标注对应调名，如 L6 = A 大调）、训练模式按钮组（限时/题量/错题/自定义）、开始按钮。难度选择器需支持 12 个等级，可横向滑动或下拉选择
  - 「和弦组成音训练」入口卡片：同上结构，独立的难度/模式选择（L1-L3）
  - 功能入口：错题本入口显示当前错题数量角标，统计入口，设置入口
  - 卡片点击交互：卡片可展开/收起配置，开始按钮跳转训练页并携带配置参数
  - 样式：移动端优先，卡片圆角、阴影，按钮尺寸大，配色简洁
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-6.1: 首页布局清晰，两个训练入口明显，功能入口可达
  - `human-judgement` TR-6.2: 移动端 375px 宽下按钮可点击区域 ≥ 44x44px，无重叠无横向滚动
  - `programmatic` TR-6.3: 点击开始训练后正确跳转到 /train 路由，query 参数包含 mode=scale/chord、difficulty、trainMode 等信息
- **Notes**: 参考移动端 App 首页设计，主操作按钮突出

## [ ] Task 7: 页面组件 - 统一训练页
- **Priority**: high
- **Depends On**: Task 4, Task 6
- **Description**: 
  - 页面三区域布局：顶部状态栏、中部题干区、底部选项区
  - 状态栏：返回按钮、当前分数、🔥连击数、剩余时间/题量进度条（根据训练模式）
  - 题干区：大字显示当前问题
    - 音级模式：「A 大调中，F♯ 是第几级？」
    - 和弦模式：「C 大三和弦的组成音是？」
    - 下方显示单题倒计时进度条或剩余秒数
  - 选项区：
    - 音级模式：7 个大按钮，固定顺序 I II III IV V VI VII（两排或弧形布局）
    - 和弦模式：4 个竖向排列大选项，每个选项内显示 3 个音名（按从低到高）
  - 反馈效果：点击后正确选项绿色背景 + 正确音效，错误选项红色背景，正确答案高亮闪烁 + 错误音效，分数飘字动画；同时显示正确答案的音程关系解析（如：根音 C、大三度 E、纯五度 G）
  - **不自动跳转**：作答后页面底部出现「下一题」大按钮，用户主动点击后才进入下一题；超时未作答也进入反馈态（标记错误），同样等待用户点击「下一题」
- **Acceptance Criteria Addressed**: AC-6, AC-14
- **Test Requirements**:
  - `human-judgement` TR-7.1: 训练页布局在移动端合理，题干清晰，选项按钮易于拇指点击
  - `human-judgement` TR-7.2: 点击选项后视觉反馈明确（绿/红/高亮闪烁 + 音程解析），页面停留反馈态，底部出现「下一题」按钮，点击后才进入下一题（不会自动跳转）
  - `human-judgement` TR-7.3: 状态栏分数、连击、倒计时/进度实时更新，数值与 Store 一致
  - `programmatic` TR-7.4: 连续完成 5 道题后，正确跳转到 /result 结算页（题量模式设 5 题测试）
- **Notes**: 选项布局是 UX 关键，7 按钮可采用 4+3 两行排列；反馈动效不超过 100ms 响应

## [ ] Task 8: 页面组件 - 结果结算页
- **Priority**: medium
- **Depends On**: Task 4, Task 7
- **Description**: 
  - 页面结构：成绩概览卡片 + 详细数据列表 + 操作按钮
  - 成绩概览：大号显示本轮得分 + 评价文案（如 S/A/B/C 级），正确率百分比大圆环/进度条
  - 详细数据：平均反应时长（毫秒）、错题数量、最快反应记录、最长连击数
  - 操作按钮：「再练一轮」（同样配置）、「查看错题」（跳转错题本并筛选本轮）、「返回首页」
  - 数据同步：完成训练后自动更新历史统计（最高分、累积正确率等）
- **Acceptance Criteria Addressed**: AC-13
- **Test Requirements**:
  - `human-judgement` TR-8.1: 结算页显示的得分、正确率、错题数、反应时长与训练过程实际值一致（可手动记录对比）
  - `programmatic` TR-8.2: 训练结束后历史统计数据正确更新（新高分覆盖旧记录，正确率重新加权平均）
  - `human-judgement` TR-8.3: 三个操作按钮跳转正确，「再练一轮」使用与本轮相同的配置启动
- **Notes**: 可适当加入数据可视化（简单 SVG 柱状图/圆环）提升体验

## [x] Task 9: 页面组件 - 错题本页
- **Priority**: medium
- **Depends On**: Task 5, Task 8
- **Description**: 
  - 页面结构：顶部 Tab 切换（全部 / 音级训练 / 和弦训练）、错题列表、底部操作栏
  - 错题卡片：显示题目（调+音级 / 和弦名）、正确答案、用户错选答案、添加日期
  - 单条操作：卡片右滑或点击「...」可移除单条错题
  - 底部操作：「清空全部」（带二次确认）、「开始错题模式训练」（直接跳转训练页并设置 trainMode=wrong）
  - 空状态：无错题时显示插画 + 提示文案 + 返回首页按钮
- **Acceptance Criteria Addressed**: AC-11, AC-12
- **Test Requirements**:
  - `human-judgement` TR-9.1: 答错的题出现在错题本列表中，题干和答案正确显示
  - `human-judgement` TR-9.2: 移除单条后列表正确更新，刷新后依然移除
  - `human-judgement` TR-9.3: 清空全部后列表为空，刷新后依然为空
  - `programmatic` TR-9.4: 点击「开始错题模式」跳转训练页，query 参数中 trainMode=wrong，且生成题目优先来自错题本
- **Notes**: 列表项信息要足够丰富，用户看到错题能回忆起当时错在哪

## [x] Task 10: 页面组件 - 统计页 & 设置页
- **Priority**: medium
- **Depends On**: Task 5
- **Description**: 
  - 统计页：
    - 按模块 Tab 切换（音级 / 和弦）
    - 按难度分块展示：音级训练 L1-L12（每块标注对应调名）、和弦训练 L1-L3，展示历史最高分、平均正确率、平均反应时间、累计训练题数
    - 简单图表：最近 10 轮得分趋势折线
  - 设置页：
    - 难度默认设置（每个模块独立默认难度）
    - 默认训练模式（限时/题量/自定义）
    - 音效开关
    - 数据管理：清空错题本、清空统计数据、重置所有设置（各带二次确认）
    - 版本信息 / 关于
- **Acceptance Criteria Addressed**: AC-10, AC-12
- **Test Requirements**:
  - `human-judgement` TR-10.1: 统计页显示的数据与实际训练累积一致（可手动计算验证）
  - `human-judgement` TR-10.2: 更改设置后返回首页，再进入设置页，设置依然保持
  - `human-judgement` TR-10.3: 音效开关生效后训练页反馈音效相应开启/关闭
  - `human-judgement` TR-10.4: 清空数据功能有二次确认，确认后数据被清除
- **Notes**: 统计图表可用原生 SVG 或轻量库（如 chart.js 迷你版）实现，避免引入过大依赖

## [x] Task 11: 音效系统 - Web Audio API 合成
- **Priority**: low
- **Depends On**: Task 4
- **Description**: 
  - 正确音效：短促高频上升音（约 200ms，两个音阶跳跃）
  - 错误音效：低频短促下降音（约 200ms）
  - 连击里程碑音效：5 连、10 连时播放小段特殊提示音
  - 使用 Web Audio API 的 OscillatorNode 合成，不引入外部音频文件
  - 统一音效管理器，支持全局开关（设置页控制），首次用户交互后再初始化 AudioContext（浏览器策略）
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgement` TR-11.1: 答对时听到清晰正确音效，答错时听到不同的错误音效，两者可明显区分
  - `human-judgement` TR-11.2: 设置中关闭音效后，训练中不再播放任何声音
  - `programmatic` TR-11.3: AudioContext 在用户首次点击页面后才创建，不提前触发浏览器自动播放限制
- **Notes**: 此任务优先级低，可最后实现；如时间紧张可先跳过，仅保留视觉反馈

## [ ] Task 12: 移动端响应式优化 & PC 端兼容
- **Priority**: medium
- **Depends On**: Task 6, Task 7, Task 8, Task 9, Task 10
- **Description**: 
  - 全局响应式：最大宽度 480px 居中，PC 端两侧留白，模拟手机尺寸
  - 适配各种屏幕宽度：320px (iPhone SE 1代)、375px、390px、428px
  - 按钮尺寸与间距微调：小屏下减小 padding 但保持 ≥ 44px 点击区
  - 题干字体自适应：使用 vw 单位或 clamp() 在极窄屏下缩小
  - 安全区域适配：iPhone 底部 Home Indicator 区域留白（env(safe-area-inset-bottom)）
  - 触摸反馈：按钮 :active 状态缩放/暗色，提升触感
  - 防止双击缩放：设置 touch-action: manipulation 或禁用手势缩放
- **Acceptance Criteria Addressed**: AC-14, NFR-1, NFR-2
- **Test Requirements**:
  - `human-judgement` TR-12.1: Chrome DevTools 设备模拟 iPhone SE (375x667)、iPhone 14 Pro (393x852)、iPad 各尺寸查看训练页，布局无错乱
  - `human-judgement` TR-12.2: PC 端 1920px 宽屏幕下应用居中显示，内容不拉伸，卡片最大宽度限制合理
  - `human-judgement` TR-12.3: 所有页面无水平滚动条，无内容被截断
  - `human-judgement` TR-12.4: iPhone 底部安全区域不遮挡底部按钮/内容
- **Notes**: 此任务可在各页面组件开发过程中同步进行，但最后统一集中过一遍

## [ ] Task 13: 自定义模式与自由练习配置
- **Priority**: medium
- **Depends On**: Task 3, Task 6
- **Description**: 
  - 在首页训练入口展开配置时，增加「自定义模式」Tab
  - 音级训练自定义：多选要练习的调式（至少支持 12 调单独勾选）、单题限时（滑杆 2-15 秒）、题量（10-200 或无限）、是否启用错题强化
  - 和弦训练自定义：多选要练习的根音、单题限时（3-15 秒）、题量、是否启用小三/变体（预留，首期仅大三）
  - 自定义配置保存为预设，下次可快速选择
  - 生成题目时根据自定义配置过滤调式/根音池、调整限时
- **Acceptance Criteria Addressed**: FR-12, AC-10
- **Test Requirements**:
  - `human-judgement` TR-13.1: 自定义勾选仅 C 和 G 大调后，训练中出现的调只有 C 和 G
  - `programmatic` TR-13.2: 自定义限时设为 10 秒后，单题限时和速度奖励阈值按 10 秒计算
  - `human-judgement` TR-13.3: 保存预设后下次进入自定义模式可看到已保存预设并快速加载
- **Notes**: 固定难度等级为单调训练（L1-L12 各一个调）；自定义模式用于用户想要多调混合练习的场景，与固定等级逻辑并存不冲突。单题限时自定义范围 3-30 秒

## [ ] Task 14: 集成测试与整体联调
- **Priority**: high
- **Depends On**: Task 1-13（至少 1-10 完成）
- **Description**: 
  - 端到端走查：从首页 → 开始训练 → 答完 20 题 → 结算 → 查看统计 → 查看错题 → 错题模式训练 → 返回首页，完整流程无异常
  - 边界 case 测试：
    - 训练中途刷新页面（状态恢复或确认丢失提示）
    - 错题本为空时进入错题模式（友好提示）
    - localStorage 满时（降级处理）
    - 快速连点选项（防抖，每题只记录第一次作答）
    - 页面切到后台再切回（计时暂停/恢复处理）
  - 性能检查：训练过程页面流畅，切换题目不卡顿，内存不持续增长
  - 修正发现的所有 Bug，保证主流程零阻断 Bug
- **Acceptance Criteria Addressed**: 全部 AC 回归
- **Test Requirements**:
  - `human-judgement` TR-14.1: 完整走查 3 遍（两个训练模块各一遍 + 错题模式一遍），无任何阻断 Bug
  - `human-judgement` TR-14.2: 快速连点选项时，仅第一下判定有效，分数/连击不重复计算
  - `human-judgement` TR-14.3: 训练中途刷新页面后，应用不崩溃，给出合理提示（重新开始或返回首页）
  - `human-judgement` TR-14.4: 构建 `npm run build` 成功，产物可直接静态部署运行
- **Notes**: 这是交付前的最后一道关，务必认真执行所有走查和边界测试
