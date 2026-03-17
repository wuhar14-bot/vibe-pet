# Vibe Pet — 实现计划

> 目标：做一个陪伴类型的电子宠物，住在终端旁边，实时渲染，可互动。

---

## 参考项目调研结论

| 项目 | 技术方案 | 启发点 |
|---|---|---|
| `Michaelliv/claude-quest` ⭐163 | Go + Raylib，监听 JSONL 日志，像素 RPG 人物实时响应 Claude 行为 | JSONL 监听机制、状态机设计 |
| `pablodelucca/pixel-agents` ⭐4546 | VS Code 扩展 + Canvas 2D，虚拟办公室 | Canvas 像素渲染、FSM 状态机 |
| 秒秒Guo vibe animation | Claude Code 自定义 skill，生成独立 HTML 文件 | **未开源**，我们自己复刻 |

**核心技术发现**：
- JSONL 日志路径：`C:\Users\harwu\.claude\projects\E--claude-code\*.jsonl`（实时记录所有 Claude 工具调用）
- Canvas 像素画关键：`imageSmoothingEnabled = false` + 整数倍缩放
- 单 HTML 文件方案：Canvas 2D + requestAnimationFrame，无依赖

---

## 两个产品层次

### 层次一：Vibe Animation Skill（复刻秒秒Guo）
**"描述场景 → 秒生成 HTML 动画"**

- 作为 Claude Code skill，文件放在 `E:\claude-data\.claude\skills\vibe-animation\`
- 输入：`/vibe-animation "小螃蟹在水上漂流"`
- 输出：生成 `animation_<timestamp>.html`，自动在浏览器打开
- Claude 自由生成场景，但遵循像素风格约定（16px 网格、限制色板）
- **适合**：随机生成好玩的小场景，和 Claude 互动的「点心」

### 层次二：Live Companion Pet（参考 claude-quest）
**"一直陪着你的小宠物，实时感知 Claude 在干什么"**

- 一个运行在本地 `localhost:5173` 的页面
- Node.js 进程监听 JSONL 日志，通过 WebSocket 推送事件
- HTML Canvas 渲染宠物，根据 Claude 行为切换状态：
  - Claude 在思考 → 宠物皱眉 / 托腮
  - Claude 写文件 → 宠物敲键盘
  - Claude 出错 → 宠物委屈 / 摔倒
  - Claude 成功 → 宠物跳舞 🎉
  - Claude 空闲 → 宠物随机闲逛、打哈欠、玩耍
- **适合**：长期陪伴，增强代码工作的沉浸感

---

## 推荐实施顺序

```
Phase 1 (先做，1-2小时)
└── Vibe Animation Skill
    ├── SKILL.md 定义
    ├── 示例输出 HTML（小螃蟹场景）
    └── 安装到 ~/.claude/skills/

Phase 2 (之后做，半天~1天)
└── Live Companion Pet
    ├── watcher.js     — JSONL 尾读 + WebSocket 推送
    ├── server.js      — Express 静态服务 + WS
    ├── pet.html       — Canvas 2D 宠物渲染
    └── sprites/       — 像素画素材
```

---

## Phase 1 技术规格：Vibe Animation Skill

### SKILL.md 核心约定

Claude 收到场景描述后，生成一个独立 HTML 文件，遵循：

```
画布：400×300px，内部渲染 200×150（2× 缩放）
色板：限制为 16 色以内（像素风感觉）
帧率：目标 24fps（用 requestAnimationFrame + delta time）
风格：8-bit 像素风，无抗锯齿
必须包含：主角色（小螃蟹 / 宠物）+ 背景 + 1个动态元素
文件：单 HTML 文件，零依赖，双击即可运行
```

### 宠物角色规格（主角色）

小螃蟹（Anthropic 吉祥物风格）：
- 尺寸：16×12 像素（原始），渲染时 2× 放大 = 32×24
- 颜色：橙红色身体（#E86A33），米白色腹部（#F5D6A0），黑色眼睛
- 动画帧：至少 4 帧（idle 摇动触角）

---

## Phase 2 技术规格：Live Companion Pet

### 事件映射表

| JSONL tool_use 类型 | 宠物状态 | 动画 |
|---|---|---|
| Read / Glob / Grep | `reading` | 戴眼镜看书 |
| Bash (执行命令) | `working` | 敲键盘 |
| Write / Edit | `writing` | 画画 / 写字 |
| TodoWrite | `planning` | 拿清单 |
| 长时间思考 | `thinking` | 托腮冒泡泡 |
| 出错 / Error | `hurt` | 摔倒 / 委屈脸 |
| 任务成功完成 | `happy` | 跳舞 / 撒花 |
| 空闲 > 30s | `idle` | 随机：打哈欠、散步、玩球 |
| 用户发消息 | `alert` | 竖起触角、挥手 |

### WebSocket 协议

```json
// watcher.js → pet.html
{ "type": "tool_start", "tool": "Bash", "input": "npm test" }
{ "type": "tool_done", "tool": "Write", "success": true }
{ "type": "thinking", "duration_ms": 3200 }
{ "type": "idle" }
```

### 文件结构

```
vibe-pet/
├── PLAN.md                    ← 本文件
├── skill/
│   └── SKILL.md               ← Claude Code skill 定义（Phase 1）
├── examples/
│   └── crab_floating.html     ← 示例输出（小螃蟹漂流）
├── companion/
│   ├── package.json
│   ├── watcher.js             ← JSONL 监听 + WebSocket 推送
│   ├── server.js              ← Express + static + WS
│   ├── pet.html               ← Canvas 2D 宠物主页面
│   └── sprites/
│       └── crab.js            ← 小螃蟹像素数据（2D 色板数组）
└── README.md
```

---

## 下一步行动

- [ ] **Phase 1 Step 1**：创建 `skill/SKILL.md`
- [ ] **Phase 1 Step 2**：生成 `examples/crab_floating.html` 作为示例
- [ ] **Phase 1 Step 3**：安装 skill 到 `E:\claude-data\.claude\skills\vibe-animation\`
- [ ] **Phase 1 Step 4**：测试 `/vibe-animation` 命令
- [ ] **Phase 2 Step 1**：搭建 watcher.js + server.js
- [ ] **Phase 2 Step 2**：实现宠物 Canvas 渲染（idle + 3 种工作状态）
- [ ] **Phase 2 Step 3**：接通 JSONL 实时事件
- [ ] **Phase 2 Step 4**：完整状态机（8 个状态）

---

*计划创建于 2026-03-16*
