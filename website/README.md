# rabbit-skills 官网

本项目官网（GitHub Pages 单页静态站）：**https://john-walks-slow.github.io/rabbit-skills/**

## 架构

- **Vite + 原生 TypeScript**，无框架。动效由 GSAP（ScrollTrigger / SplitText / DrawSVG）驱动，Hero 背景为 Canvas 2D 粒子流场。
- **内容物预览自动化**：`scripts/generate-content.mjs` 在构建期扫描仓库的 `.apm/`（skills / agents / instructions / hooks）与 `Readme.md`、`apm.yml`，生成 `src/generated/content.json`。CI 每次 push 自动重建，官网内容与仓库文件始终一致。
- 深链支持 `?motion=reduced` 强制关闭动效（无障碍）。

## 开发

```bash
cd website
npm install
npm run dev      # 本地开发（自动重新生成内容数据）
npm run build    # 产出 dist/
npm run preview  # 本地预览构建产物
```

单独重新生成内容数据：`npm run generate`。

## 部署

由 `.github/workflows/website.yml` 驱动：push 到 master（触及 `website/`、`.apm/`、`Readme.md`、`apm.yml`）时自动构建并发布到 GitHub Pages。无需手动操作。

## 目录

```
website/
├── scripts/generate-content.mjs   # 构建期内容生成（扫描项目文件）
├── index.html                     # 页面骨架
├── public/favicon.svg             # 星座兔 mark
└── src/
    ├── main.ts                    # 入口
    ├── boot.ts                    # 首屏入场编排
    ├── hero-canvas.ts             # 三泳道粒子流场
    ├── rabbit.ts                  # 星座兔（lucide rabbit 路径，ISC）
    ├── reveal.ts                  # 滚动动效
    ├── browser.ts                 # 内容物浏览器 + 模态
    ├── copy.ts                    # 复制 + toast
    ├── motion.ts / svg.ts / data.ts
    └── scenes/                    # 三大工作流专属动效场景
        ├── research.ts            # 星图收敛 + 95% 仪表
        ├── troubleshoot.ts        # 日志捕获 + 因果链 + 诊断盖章
        └── implement.ts           # 六站流水线 + commit 芯片
```
