# 吉他指板记忆工具 - Independent Review

- [x] CP-R1: 主页独立「练习工具」栏目与路由导航 — **PASS（R1）**
  - **Type**: `rule`
  - **Covers**: AC-1, FR-1, FR-2, TR-6.1, TR-6.2
  - **Evidence**: R1 独立实测：工具区在 `.card-list` 之外（训练卡片区内工具入口计数=0），真实点击进入 `/tools/fretboard` 并可返回；懒加载独立 chunk（14.77kB）。

- [x] CP-R2: 单弦单选 / 调性选择 / 选择持久化 — **PASS（R1）**
  - **Type**: `rule`
  - **Covers**: AC-2（配置部分）, FR-3, FR-4, FR-5, TR-5.1
  - **Evidence**: R1 实测默认 ⑥E2 + 不限调，13 个调性 chip 顺序与 MAJOR_KEYS 一致，切换后唯一选中；localStorage 持久 `fretboardString/fretboardKey`，重进保持。

- [x] CP-R3: 指板乐理纯函数正确性 — **PASS（R1）**
  - **Type**: `rule`
  - **Covers**: AC-3, AC-4, FR-6~9, TR-1.1~1.5, NFR-4
  - **Evidence**: R1 独立执行 `node --test fretboard.test.mjs` exit 0；代码审查确认纯函数仅依赖 scales.js、无 DOM、越界抛错；浏览器实测 G 大调 F♯ 拼写、不限调降号拼写（G♭）正确。

- [x] CP-R4: 12 拍自动节奏编排、节拍器与英文 TTS 行为 — **PASS（R1）**
  - **Type**: `rule`
  - **Covers**: AC-5, AC-6, FR-10~14, TR-2.1~2.3, TR-3.1/3.2/3.4/3.5, NFR-1/2
  - **Evidence**: R1 注入探针实测拍间隔 998–1003ms；重音 2200Hz 严格落在 beat 0/4/8/12，其余 1568Hz；speak 文本 `["F sharp","E","A","E"]`、lang=en-US、rate≈1.05；连续 4 组自动推进；20×200ms 采样未揭示槽恒为「?」（泄题修复有效）；思考阶段无 SVG。

- [x] CP-R5: 三阶段暂停 / 继续 / 退出与卸载清理 — **PASS（R1）**
  - **Type**: `rule`
  - **Covers**: AC-7, FR-15~17, TR-3.3, TR-5.3, TR-5.4
  - **Evidence**: R1 在 recite/think/reveal 三阶段实测 T0 与 T+2.5s 状态逐项完全一致、speaking/pending=false；继续后念题当前拍重读；退出后 0.5s/3.5s 计数冻结；路由卸载后 3.3s 无声。

- [x] CP-R6: 6×12 SVG 指板与答案点正确性 / 窄屏适配 — **PASS（R1）**
  - **Type**: `rule`
  - **Covers**: AC-8, FR-18~20, TR-4.1~4.3
  - **Evidence**: R1 多组答案点位手工核验全部正确（含 ①弦 8/7/5 品与空弦点 cx=14 琴枕左侧）；3/5/7/9 单品记+12 双品记、琴枕、弦名让位、同品位 badge 环绕均验证；360×740 视口 body.scrollWidth=360 无横向溢出，答案点全部落在 SVG 内。

- [x] CP-R7: 工具不产生任何学习数据 — **PASS（R1）**
  - **Type**: `rule`
  - **Covers**: AC-9, TR-7.3, Non-Goals
  - **Evidence**: R1 哨兵字符串练习前后逐字节不变；5 个指板源文件 grep `wrongbook|stats|game|STATS|WRONGBOOK` 零匹配；新字段仅落 settings。

- [ ] CP-R8: 测试纳入 npm test、零新依赖与生产构建 — **FAIL（R1，pre-existing 无关项）**
  - **Type**: `rule`
  - **Covers**: AC-10, TR-1.6, TR-2.3, TR-7.1, NFR-3
  - **Evidence**: R1 仲裁——fretboard 测试 exit 0、`npm run build` exit 0、零新依赖（lockfile mtime 9-14 早于功能开发）；但全量 `npm test` exit 1，唯一失败为 [progression.test.mjs#L248-L249](file:///Users/sunmengchuan/Documents/trae_projects/NoteMem/src/music/__tests__/progression.test.mjs#L248-L249) 哨兵断言（minor 期望 3480 实际 3526、modal 期望 4920 实际 5024）。R1 独立裁定其为 pre-existing 语料计数漂移（磁盘 .mid 与 manifest 一致，全部相关文件 mtime ≤9-14，指板源码 grep 零关联），与本 spec 无代码/数据/依赖关系；按 AC-10 字面如实记 FAIL，是否更新哨兵或回溯语料由用户裁决。

- [x] CP-U1: 指板图视觉质量 — **PASS（R1，4/5）**
  - **Type**: `rubric`
  - **Covers**: AC-U1, TR-4.4, TR-7.4
  - **Scale**: 1-5；**Pass Threshold**: >= 4
  - **Evidence**: R1 独立打 **4**：木质渐变、琴枕、金属品丝、3/5/7/9+12 双品记、六弦粗细递减、选弦高亮、答案点音名+序号 badge、同品位环绕与空弦左置专业，足以支撑肌肉记忆训练；未满分：教学示意风格而非照片级拟真、相邻品位圆点轻微相切。

- [x] CP-U2: 抱琴 / 无琴场景练习体验 — **PASS（R1，4/5）**
  - **Type**: `rubric`
  - **Covers**: AC-U2, TR-3.5, TR-5.5, TR-7.4
  - **Scale**: 1-5；**Pass Threshold**: >= 4
  - **Evidence**: R1 独立打 **4**：阶段卡片+脉冲+倒计时一眼可读；360px 下槽位 34px、暂停钮 60px；遮罩按钮层级清晰；窄屏无溢出；拍间隔 998–1003ms。未满分：360px 下指板上下留白偏多。

## Review History

### Review R1
- **Result**: `fail`
- **Evidence**: 全新只读评审代理独立执行（源码精读、全量测试、生产构建、CDP headless 移动视口 6 场景实测、14 张独立截图）；CP-R1~R7 全部 PASS，CP-U1=4、CP-U2=4 均过阈值；唯一 FAIL 为 CP-R8，且经独立专项仲裁确认失败项是 pre-existing 的 progression MIDI 语料计数哨兵漂移，与本 spec 无任何关联，指板功能范围内 **0 条 actionable finding**。
- **Actionable Findings（本 spec 范围）**: 无 → 无需返工的实现问题。
- **Advisory Findings**:
  1. `[pre-existing, 非本 spec]` progression 测试哨兵计数过期（minor +46、modal +104），需用户裁决更新断言或回溯 MIDI 语料；这是仓库级 `npm test` 非全绿的唯一原因。
  2. `[UX 轻微]` 相邻品位答案点边缘相切约 3px（点半径 15 / 品中心间距 27），音名与 badge 仍完全可读；可在后续迭代按碰撞缩点。
  3. `[兼容性]` iOS speechSynthesis 长会话偶发停说为系统已知问题；本工具每拍新建 utterance + 暂停即 cancel，风险低，建议真机上线前补测一次 iPhone。
- **Blocked By**: 无（环境/权限无缺失项；360px 窄屏已由 R1 用 CDP 实测，非 blocked）。
- **Resume When**: 不适用；是否将 CP-R8 对应的 pre-existing 哨兵问题纳入处理，等待用户裁决（不属本 spec 实现范围）。
