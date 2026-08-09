#!/usr/bin/env python3
"""
code-deep-dive: md2html 转换脚本
将遵循约定格式的 markdown 深度长文转换为单文件、完全自包含的 HTML
（CSS/JS 全内联，无 CDN，离线可用）。

用法：
  python md2html.py <input.md> [output.html]

转换器识别的"约定格式"（写文章时使用，见 references/html-format.md）：
  1. 章节：## / ### 自动生成 TOC、锚点、时长徽章
  2. 预计时长：标题文本内「（约 X 分钟）」或标题下「> 约 X 分钟」引用块
  3. 测验：:::quiz ... :::/quiz → 可交互问答卡片
  4. 折叠块：:::details 「标题」... :::/details → <details>
  5. 流程图：:::flow ... :::/flow → SVG 流程图（Mermaid 简版语法）
  6. 时序图：:::seq ... :::/seq → SVG 时序图
  7. 图标：{{icon:name}} → 内联 SVG 图标（内置 lucide 风格图标集）
  8. 表格、代码块：增强样式 + Pygments 语法高亮
"""
import argparse
import html
import re
import sys
from pathlib import Path

try:
    import markdown as md
    from pygments import highlight
    from pygments.formatters import HtmlFormatter
    from pygments.lexers import get_lexer_by_name
except ImportError as e:
    print(f"缺少依赖：{e}。请先安装：python -m pip install markdown pygments")
    sys.exit(1)


# =====================================================================
# 图标：lucide（CDN 加载，不内嵌 SVG）
# 约定：{{icon:name}} → <i data-lucide="name">，页面加载后由
# lucide.createIcons() 替换为 SVG。
# =====================================================================

ICON_RE = re.compile(r"\{\{icon:([a-z0-9-]+)\}\}")


def render_icon(name: str, size: int = 16) -> str:
    name = name.strip().lower().replace("_", "-")
    return (
        f'<i class="cdd-icon" data-lucide="{html.escape(name)}" '
        f'width="{size}" height="{size}" aria-hidden="true"></i>'
    )


def replace_icons(text: str) -> str:
    return ICON_RE.sub(lambda m: render_icon(m.group(1)), text)


# =====================================================================
# 图表：:::mermaid 包裹的标准 Mermaid 语法 → 客户端渲染
# 约定：文章中使用标准 Mermaid（flowchart / sequenceDiagram / gantt 等），
# 转换时保留原文，由 mermaid.js 在浏览器端渲染。
# =====================================================================

# Each named block may be closed by either ":::/name" (explicit) or a bare
# ":::" (generic close). The bare ":::" must not be followed by a word char
# or "/" (so it does not eat the start of ":::/name" or another ":::xxx" block).
_CLOSE_MERMAID = r"(?:::/mermaid|:::(?![/\w]))"
MERMAID_RE = re.compile(
    rf":::mermaid[ \t]*\n\s*\n?(.*?)\n\s*\n?{_CLOSE_MERMAID}[ \t]*\n?",
    re.DOTALL,
)


def render_mermaid(spec: str) -> str:
    code = html.escape(spec.strip())
    return (
        '<div class="diagram-wrap mermaid-box">'
        f'<pre class="mermaid">{code}</pre>'
        "</div>"
    )


# =====================================================================
# 约定的特殊块解析（quiz / details）
# =====================================================================

_CLOSE_QUIZ = r"(?:::/quiz|:::(?![/\w]))"
_CLOSE_DETAILS = r"(?:::/details|:::(?![/\w]))"
QUIZ_RE = re.compile(rf":::quiz[ \t]*\n\s*\n?(.*?)\n\s*\n?{_CLOSE_QUIZ}[ \t]*\n?", re.DOTALL)
DETAILS_RE = re.compile(
    rf":::details[ \t]+(.+?)[ \t]*\n\s*\n?(.*?)\n\s*\n?{_CLOSE_DETAILS}[ \t]*\n?",
    re.DOTALL,
)


def parse_quiz(block: str) -> str:
    """解析 :::quiz 块。

    两种格式：
    1. 问答：Q: 问题 / A: 答案（可多条 A）
    2. 选择题：Q: 问题 / - 选项... / 答案: X / 解说: ...
    解说（可省略）：以「解说:」或「E:」开头，回答后展示。
    """
    lines = block.split("\n")
    entries = []
    cur = None
    for line in lines:
        s = line.strip()
        m = re.match(r"^Q:\s*(.+)$", s)
        if m:
            if cur:
                entries.append(cur)
            cur = {"q": m.group(1).strip(), "opts": [], "ans": [], "correct": None, "expl": None}
            continue
        if not cur:
            continue
        m = re.match(r"^答案[:：]\s*(.+)$", s)
        if m:
            cur["correct"] = m.group(1).strip()
            continue
        m = re.match(r"^(?:解说|解释)[:：]\s*(.+)$", s)
        if m:
            cur["expl"] = m.group(1).strip()
            continue
        m = re.match(r"^A:\s*(.+)$", s)
        if m:
            cur["ans"].append(m.group(1).strip())
            continue
        m = re.match(r"^[-*]\s*(.+)$", s)
        if m and not cur["ans"]:
            cur["opts"].append(m.group(1).strip())
    if cur:
        entries.append(cur)
    if not entries:
        return '<div class="quiz"><p class="muted">（测验未按格式填写）</p></div>'

    def expl_html(expl):
        if not expl:
            return ""
        return (
            f'<div class="quiz-expl"><span class="quiz-expl-label">解说</span>'
            f'<div class="quiz-expl-body">{html.escape(expl)}</div></div>'
        )

    cards = []
    for idx, e in enumerate(entries):
        kind = "choice" if e["opts"] else "qa"
        num = f'<span class="quiz-num">Q{idx+1}</span>'
        question = f'<span class="quiz-text">{html.escape(e["q"])}</span>'
        if kind == "qa":
            ans = "".join(f"<li>{html.escape(x)}</li>" for x in e["ans"]) or "<li>（无答案）</li>"
            body = (
                f'<div class="quiz-q" role="button" tabindex="0" aria-expanded="false">'
                f'{num}{question}'
                f'<svg class="quiz-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">'
                f'<path d="m6 9 6 6 6-6"/></svg></div>'
                f'<div class="quiz-a" hidden><div class="quiz-a-label">答案</div><ul>{ans}</ul>'
                f'{expl_html(e["expl"])}</div>'
            )
        else:
            correct = e["correct"]
            correct_idx = None
            for oi, o in enumerate(e["opts"]):
                if correct and (correct == o or correct == str(oi + 1)):
                    correct_idx = oi
                    break
            opts = ""
            for oi, o in enumerate(e["opts"]):
                opts += (
                    f'<button type="button" class="quiz-opt" data-correct="{1 if oi == correct_idx else 0}">'
                    f'<span class="quiz-opt-letter">{chr(65+oi)}</span>'
                    f'<span class="quiz-opt-text">{html.escape(o)}</span>'
                    f'<span class="quiz-opt-mark"></span></button>'
                )
            # Choice quiz: explanation is hidden until the user answers.
            # expl_html already renders the visible inner block; we only add
            # the hidden toggle wrapper here.
            if e["expl"]:
                expl_block = f'<div class="quiz-expl-wrap" hidden>{expl_html(e["expl"])}</div>'
            else:
                expl_block = ""
            body = (
                f'<div class="quiz-q-static">{num}{question}</div>'
                f'<div class="quiz-opts">{opts}</div>'
                f'<div class="quiz-feedback" hidden></div>'
                f'{expl_block}'
            )
        cards.append(f'<div class="quiz-item" data-kind="{kind}">{body}</div>')
    return '<div class="quiz">' + "".join(cards) + "</div>"


def parse_details(title: str, body: str) -> str:
    return f'<details class="collapsible"><summary>{html.escape(title)}</summary>{body}</details>'


# =====================================================================
# 代码块 → pygments
# =====================================================================

# 文件扩展名 → 语法高亮语言名（pygments lexer 名）。当文章里用代码引用
# 格式（```startLine:endLine:filepath）时，从 filepath 推断语言。
_EXT_LEXERS = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".rs": "rust",
    ".py": "python",
    ".go": "go",
    ".java": "java",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".css": "css",
    ".scss": "scss",
    ".html": "html",
    ".xml": "xml",
    ".md": "markdown",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".sql": "sql",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".dart": "dart",
    ".gradle": "gradle",
}


def _lang_from_path(path: str) -> str:
    p = path.strip().lower()
    for ext in sorted(_EXT_LEXERS, key=len, reverse=True):
        if p.endswith(ext):
            return _EXT_LEXERS[ext]
    return ""


def render_code(code: str, lang: str, *, filepath: str = "", start: int = 0) -> str:
    """渲染一个代码块。

    - ``lang``：显式语言名（用于普通 ```lang 代码块）。
    - ``filepath``：当代码来自项目源文件时，传入源文件路径，头部展示该
      路径，并按扩展名推断语法高亮语言。
    - ``start``：源文件起始行号。> 0 时启用行号显示。
    """
    disp = filepath or lang or "text"
    hl_lang = ""
    if filepath:
        hl_lang = _lang_from_path(filepath)
    if not hl_lang:
        hl_lang = (lang or "").strip().lower()
    out = ""
    if hl_lang:
        try:
            lexer = get_lexer_by_name(hl_lang)
            fmter = HtmlFormatter(
                style="github-dark",
                nowrap=False,
                linenos=start > 0,
                linenostart=start or 1,
            )
            out = highlight(code, lexer, fmter)
        except Exception:
            out = ""
    if not out:
        out = f'<pre><code class="plain">{html.escape(code)}</code></pre>'
    head = (
        f'<div class="code-head"><span class="code-lang">{html.escape(disp)}</span>'
        f'<span class="code-spacer"></span>'
        f'<button type="button" class="code-action wrap-toggle" title="软换行">'
        f'{render_icon("text-wrap", 14)}<span>软换行</span></button>'
        f'<button type="button" class="code-action copy-btn" title="复制代码">'
        f'{render_icon("copy", 14)}<span>复制</span></button></div>'
    )
    return f'<div class="code-block">{head}{out}</div>'


CODE_RE = re.compile(r"```([\w+-]*)\s*\n(.*?)```", re.DOTALL)

# 代码引用格式：```startLine:endLine:filepath (可选备注)
# 优先于普通 CODE_RE 处理——避免引用信息里的 ":" "/" "." 被普通 fence
# 正则当成无效语言名而漏掉。
CODE_REF_RE = re.compile(
    r"```(\d+):(\d+):(\S+)(?:[ \t]+([^\n]*))?\s*\n(.*?)```",
    re.DOTALL,
)


def preprocess_code(md_text: str):
    placeholders = {}

    def repl_ref(m):
        start, end, path = int(m.group(1)), int(m.group(2)), m.group(3)
        code = m.group(5)
        # Strip a single trailing newline (common when author leaves blank line
        # before the closing fence) but preserve internal blank lines.
        if code.endswith("\n"):
            code = code[:-1]
        ph = f"@@CODE{len(placeholders)}@@"
        placeholders[ph] = render_code(code, "", filepath=path, start=start)
        return ph

    md_text = CODE_REF_RE.sub(repl_ref, md_text)

    def repl(m):
        lang, code = m.group(1), m.group(2)
        ph = f"@@CODE{len(placeholders)}@@"
        placeholders[ph] = render_code(code, lang)
        return ph

    return CODE_RE.sub(repl, md_text), placeholders


# =====================================================================
# 阅读时长：自动估算（基于中文字数与代码量），不依赖手动标注
# =====================================================================

# 阅读速度假设（碎片时间手机阅读，略保守）
CJK_WPM = 300          # 中文正文 字/分钟
CODE_LPM = 20          # 代码 行/分钟
TABLE_WPM = 150        # 表格文字 字/分钟

# 清理旧文章中可能残留的「（约 X 分钟）」标注
TIME_IN_TITLE_RE = re.compile(r"（\s*约\s*\d+\s*分钟\s*）")


def _text_minutes(seg: str) -> float:
    """统计一段 HTML 的阅读分钟数：中文字数 + 表格字数 + 代码行数。"""
    no_code = re.sub(r"<div class=\"highlight\">.*?</div>", "", seg, flags=re.DOTALL)
    no_code = re.sub(r"<pre.*?</pre>", "", no_code, flags=re.DOTALL)
    cjk = sum(1 for ch in no_code if "\u4e00" <= ch <= "\u9fff")
    table_part = "".join(re.findall(r"<table>.*?</table>", seg, flags=re.DOTALL))
    table_cjk = sum(1 for ch in table_part if "\u4e00" <= ch <= "\u9fff")
    code_lines = 0
    for cm in re.finditer(r"<div class=\"highlight\">.*?</div>|<pre.*?</pre>", seg, flags=re.DOTALL):
        code_lines += cm.group(0).count("\n")
    return cjk / CJK_WPM + table_cjk / TABLE_WPM + code_lines / CODE_LPM


def estimate_reading_minutes(body: str, heading_id: str, next_heading_id=None) -> int:
    """按章节切分正文，估算该章节阅读分钟数。heading_id 为该节 h2/h3 的 id。"""
    seg_start = body.find(f'id="{heading_id}"')
    if seg_start == -1:
        return None
    seg_start = body.find(">", seg_start) + 1
    if next_heading_id:
        seg_end = body.find(f'id="{next_heading_id}"')
    else:
        seg_end = len(body)
    if seg_end == -1:
        seg_end = len(body)
    seg = body[seg_start:seg_end]
    return max(1, round(_text_minutes(seg)))


def estimate_total_minutes(body: str, toc_tokens) -> int:
    """整篇文章总阅读分钟数（含引言部分）。"""
    total = 0.0
    ids = [t["id"] for t in toc_tokens]
    if ids:
        first = body.find(f'id="{ids[0]}"')
        if first != -1:
            total += _text_minutes(body[:first])
    for i, tid in enumerate(ids):
        nid = ids[i + 1] if i + 1 < len(ids) else None
        total += _text_minutes(
            body[body.find(f'id="{tid}"') + len(f'id="{tid}"') + 1:
                  (body.find(f'id="{nid}"') if nid else len(body))]
        ) or 0
    return max(1, round(total))


def build_toc(toc_tokens) -> str:
    """渲染 TOC。目录不显示每节时长（整体时长在页脚）。"""
    out = []

    def walk(tokens, depth):
        for t in tokens:
            clean = TIME_IN_TITLE_RE.sub("", t["name"]).strip()
            icon = t.get("icon")
            icon_svg = f'<span class="toc-icon">{render_icon(icon, 14)}</span>' if icon else ""
            lv = t.get("level", 2)
            cls = "toc-l2" if depth == 0 else "toc-l3"
            out.append(
                f'<a class="{cls}" href="#{t["id"]}">{icon_svg}'
                f'<span class="toc-label">{html.escape(clean)}</span></a>'
            )
            walk(t.get("children", []), depth + 1)

    walk(toc_tokens, 0)
    return "".join(out)


def decorate_body(body: str) -> str:
    """清理标题中残留的「（约 X 分钟）」标注、渲染标题内图标，
    并自动为每个标题估算并插入阅读时长徽章。"""
    ids = re.findall(r'<h[23][^>]*id="([^"]+)"', body)

    def _clean_title(m):
        tag, inner = m.group(1), m.group(2)
        inner = TIME_IN_TITLE_RE.sub("", inner)
        inner = replace_icons(inner)
        # 自动估算本节时长
        idm = re.search(r'id="([^"]+)"', tag)
        minutes = None
        if idm:
            hid = idm.group(1)
            if hid in ids:
                idx = ids.index(hid)
                nid = ids[idx + 1] if idx + 1 < len(ids) else None
                minutes = estimate_reading_minutes(body, hid, nid)
        badge = f'<span class="time-badge">约 {minutes} 分钟</span>' if minutes else ""
        return f"{tag}{inner}{badge}{m.group(3)}"

    return re.sub(r"(<h[23][^>]*>)(.*?)(</h[23]>)", _clean_title, body)


# =====================================================================
# markdown 转换
# =====================================================================

def _make_slugger():
    counter = {}

    def slug(value, sep):
        h = re.match(r"^(h\d)$", value or "")
        key = value or "h"
        counter[key] = counter.get(key, 0) + 1
        return f"{key}-{counter[key]}"

    return slug


def convert_md(md_text: str):
    # 抽取所有约定的块，原位替换成占位符
    placeholders = {}
    counter = {"i": 0}

    def ph(key, fn):
        counter["i"] += 1
        tag = f"@@{key}{counter['i']}@@"
        placeholders[tag] = fn
        return tag

    def sub_quiz(m):
        return ph("QUIZ", lambda b=m.group(1): parse_quiz(b))

    def sub_details(m):
        return ph("DETAILS", lambda t=m.group(1), b=m.group(2): parse_details(t, b))

    def sub_mermaid(m):
        return ph("MERMAID", lambda b=m.group(1): render_mermaid(b))

    md_text = QUIZ_RE.sub(sub_quiz, md_text)
    md_text = DETAILS_RE.sub(sub_details, md_text)
    md_text = MERMAID_RE.sub(sub_mermaid, md_text)
    md_text, code_placeholders = preprocess_code(md_text)
    for tag, code_html in code_placeholders.items():
        placeholders[tag] = (lambda h=code_html: h)

    md_converter = md.Markdown(
        extensions=["tables", "fenced_code", "attr_list", "def_list", "toc"],
        extension_configs={"toc": {"toc_depth": "2-3", "slugify": _make_slugger()}},
    )
    body = md_converter.convert(md_text)
    body = re.sub(r"<p>(@@(?:QUIZ|DETAILS|MERMAID|CODE)\d+@@)</p>", r"\1", body)

    # 回填
    for tag, fn in placeholders.items():
        body = body.replace(tag, fn())

    body_for_estimate = body  # 未装饰的 body，供时长估算统一基准
    body = decorate_body(body)
    body = replace_icons(body)
    toc_tokens = md_converter.toc_tokens

    # 给 toc token 补充图标信息（从标题原文提取 {{icon:name}}）
    def enrich(tokens):
        for t in tokens:
            m = ICON_RE.search(t["name"])
            t["icon"] = m.group(1) if m else None
            enrich(t.get("children", []))
    enrich(toc_tokens)

    toc_html = build_toc(toc_tokens)
    return body, toc_html, toc_tokens


# =====================================================================
# HTML 模板
# =====================================================================

PYGMENTS_CSS = HtmlFormatter(style="github-dark").get_style_defs(".highlight")

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%%TITLE%%</title>
<script>
  (function () {
    var t = "light";
    try {
      t = localStorage.getItem("cdd-theme") ||
        (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch (e) {}
    document.documentElement.dataset.theme = t;
  })();
</script>
<style>
/* ================= 设计 Token（shadcn 风格） ================= */
:root {
  --background: hsl(48 25% 97%);
  --foreground: hsl(240 12% 14%);
  --card: hsl(0 0% 100%);
  --card-hover: hsl(48 20% 94%);
  --muted: hsl(240 6% 46%);
  --muted-foreground: hsl(240 5% 34%);
  --border: hsl(240 8% 87%);
  --border-strong: hsl(240 7% 78%);
  --accent: hsl(243 72% 56%);
  --accent-hover: hsl(243 72% 48%);
  --accent-soft: hsl(243 70% 96%);
  --accent-fg: hsl(0 0% 100%);
  --ring: hsl(243 72% 56% / 0.35);
  --code-bg: #0d1117;
  --mono: "JetBrains Mono", "Cascadia Code", "SF Mono", Consolas, Menlo, monospace;
  --shadow-sm: 0 1px 2px rgb(24 24 27 / 0.05);
  --shadow-md: 0 4px 16px -4px rgb(24 24 27 / 0.12);
  --radius: 10px;
}
html[data-theme="dark"] {
  --background: hsl(240 14% 7%);
  --foreground: hsl(240 8% 92%);
  --card: hsl(240 10% 11%);
  --card-hover: hsl(240 9% 14%);
  --muted: hsl(240 5% 62%);
  --muted-foreground: hsl(240 5% 78%);
  --border: hsl(240 6% 20%);
  --border-strong: hsl(240 5% 30%);
  --accent: hsl(243 76% 66%);
  --accent-hover: hsl(243 76% 74%);
  --accent-soft: hsl(243 40% 17%);
  --accent-fg: hsl(240 20% 8%);
  --ring: hsl(243 76% 66% / 0.4);
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.4);
  --shadow-md: 0 4px 16px -4px rgb(0 0 0 / 0.5);
}

/* ================= 基础 ================= */
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  background: var(--background);
  color: var(--foreground);
  line-height: 1.8;
  font-size: 16px;
  transition: background-color .25s ease, color .25s ease;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; transition: color .15s ease; }
a:hover { color: var(--accent-hover); text-decoration: underline; }
a:focus-visible, button:focus-visible, summary:focus-visible {
  outline: 2px solid var(--ring); outline-offset: 2px; border-radius: 4px;
}

/* ================= 滚动条（modern） ================= */
* { scrollbar-width: thin; scrollbar-color: rgb(148 163 184 / .5) transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgb(148 163 184 / .45);
  border-radius: 999px;
  border: 2.5px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover { background: rgb(148 163 184 / .7); background-clip: padding-box; }
::-webkit-scrollbar-corner { background: transparent; }

/* ================= 进度条 ================= */
#progress {
  position: fixed; top: 0; left: 0; height: 3px; width: 0;
  background: linear-gradient(90deg, var(--accent), #a855f7);
  z-index: 200; transition: width .1s linear;
}

/* ================= 顶栏 ================= */
.topbar {
  position: sticky; top: 0; z-index: 100;
  display: flex; align-items: center; gap: 8px;
  padding: 9px 18px;
  background: color-mix(in srgb, var(--background) 82%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; letter-spacing: .2px; min-width: 0; }
.brand svg { color: var(--accent); flex-shrink: 0; }
.brand > span:last-child {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.spacer { flex: 1; }
.topbar-actions { display: flex; align-items: center; gap: 6px; }
.topbar .btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: 1px solid transparent; color: var(--muted-foreground);
  padding: 6px 12px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 500;
  transition: background-color .15s ease, color .15s ease;
}
.topbar .btn:hover { background: var(--card-hover); color: var(--foreground); }
.topbar .btn svg { color: var(--muted-foreground); }
.topbar .btn:hover svg { color: var(--foreground); }
.topbar .btn.active { background: var(--accent-soft); color: var(--accent); }
.topbar .btn.active svg { color: var(--accent); }

/* ================= 布局 ================= */
.layout { display: flex; max-width: 1240px; margin: 0 auto; align-items: flex-start; }

/* ================= 目录 ================= */
.toc {
  position: sticky; top: 58px; flex-shrink: 0;
  width: 268px; padding: 22px 14px;
  max-height: calc(100vh - 76px); overflow-y: auto;
}
.toc-title {
  font-size: 11px; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: var(--muted);
  padding: 0 10px 10px;
}
.toc-nav { display: flex; flex-direction: column; gap: 2px; }
.toc-nav a {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: 7px;
  color: var(--muted-foreground); font-size: 13.5px; line-height: 1.45;
  border-left: 2px solid transparent;
  transition: background-color .15s ease, color .15s ease, border-color .15s ease;
}
.toc-nav a:hover { background: var(--card); color: var(--foreground); text-decoration: none; }
.toc-nav a.active {
  background: var(--accent-soft); color: var(--accent);
  border-left-color: var(--accent); font-weight: 600;
}
.toc-nav a.toc-l3 { padding-left: 24px; font-size: 13px; }
.toc-icon { display: inline-flex; flex-shrink: 0; color: var(--muted); }
.toc-label { flex: 1; min-width: 0; }
.toc-hidden { display: none; }

/* ================= 正文 ================= */
main {
  flex: 1; min-width: 0; padding: 40px 44px 90px;
  max-width: 800px; margin: 0 auto;
}
article h1 {
  font-size: 34px; line-height: 1.3; margin-bottom: 10px;
  letter-spacing: -.5px; font-weight: 800;
}
.article-meta {
  color: var(--muted); font-size: 14px; margin-bottom: 8px;
  display: flex; flex-wrap: wrap; gap: 6px 16px;
}
.article-meta span { display: inline-flex; align-items: center; gap: 5px; }
article h2 {
  font-size: 25px; font-weight: 700; margin-top: 60px; margin-bottom: 14px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border);
  scroll-margin-top: 72px; letter-spacing: -.3px;
}
article h3 {
  font-size: 19px; font-weight: 600; margin-top: 34px; margin-bottom: 10px;
  scroll-margin-top: 72px;
}
article h4 { font-size: 16px; font-weight: 600; margin-top: 26px; margin-bottom: 8px; }
article p { margin: 14px 0; color: var(--foreground); }
article ul, article ol { margin: 14px 0 14px 26px; }
article li { margin: 7px 0; }
article li::marker { color: var(--accent); }
article blockquote {
  margin: 18px 0; padding: 12px 18px;
  background: var(--accent-soft); border-left: 4px solid var(--accent);
  border-radius: 0 var(--radius) var(--radius) 0; color: var(--foreground);
}
article blockquote p { margin: 4px 0; }
article table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  margin: 18px 0; font-size: 14px; border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden;
}
article th, article td {
  padding: 9px 13px; border-bottom: 1px solid var(--border); text-align: left;
}
article thead th {
  background: var(--card); font-weight: 600; color: var(--muted-foreground);
  font-size: 13px;
}
article tr:last-child td { border-bottom: none; }
article tbody tr { transition: background-color .12s ease; }
article tbody tr:hover { background: var(--card-hover); }
strong { font-weight: 650; }
:not(pre) > code {
  font-family: var(--mono);
  font-size: .82em; background: var(--accent-soft); color: var(--accent-hover);
  padding: 2px 6px; border-radius: 5px;
  transition: background-color .15s ease;
}
:not(pre) > code:hover { background: color-mix(in srgb, var(--accent-soft) 80%, var(--border)); }
hr { border: none; border-top: 1px solid var(--border); margin: 36px 0; }

/* ================= 代码块 ================= */
.code-block {
  margin: 18px 0; border-radius: 12px; overflow: hidden;
  background: var(--code-bg); border: 1px solid #1f2733;
  box-shadow: var(--shadow-sm);
}
.code-head {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px;
  background: #161b22; border-bottom: 1px solid #21262d;
}
.code-lang {
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  color: #8b949e; text-transform: uppercase;
}
.code-spacer { flex: 1; }
.code-action {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px; border: 1px solid #30363d; border-radius: 6px;
  background: transparent; color: #8b949e; cursor: pointer;
  font-size: 11.5px; font-family: inherit;
  transition: color .15s ease, border-color .15s ease, background-color .15s ease;
}
.code-action:hover { color: #e6edf3; border-color: #8b949e; background: #21262d; }
.code-action .cdd-icon { color: currentColor; }
.code-block .highlight { background: var(--code-bg) !important; padding: 14px 16px; overflow-x: auto; }
.code-block pre {
  margin: 0; border: none; border-radius: 0; background: transparent !important;
  box-shadow: none !important; overflow-x: visible;
  font-family: var(--mono); font-size: 12.5px; line-height: 1.65;
}
.code-block pre:hover { box-shadow: none; }
.code-block pre.plain { color: #e6edf3; display: block; }
.code-block.wrapped .highlight pre {
  white-space: pre-wrap; word-break: break-word; overflow-x: visible;
}
/* pygments linenos table (代码引用带行号) */
.code-block .highlight table, .code-block .highlight td, .code-block .highlight th {
  margin: 0; border: none; padding: 0; background: transparent;
}
.code-block .highlight table { border-collapse: collapse; width: 100%; }
.code-block .highlight td.linenos {
  text-align: right; color: #6e7681; user-select: none; white-space: pre;
  padding-right: 12px; min-width: 2.5em; vertical-align: top;
  border-right: 1px solid #21262d; position: sticky; left: 0; background: var(--code-bg);
}
.code-block .highlight td.code { padding-left: 14px; white-space: pre; }
.code-block .highlight pre { white-space: pre; }
/* pygments 生成的 token 配色由 {pygments_css} 提供；此处兜底 base */
.highlight { color: #e6edf3; }
.highlight .c, .highlight .c1, .highlight .cm, .highlight .cs, .highlight .cd { color: #8b949e; font-style: italic; }
.highlight .k, .highlight .kd, .highlight .kn, .highlight .kp, .highlight .kr, .highlight .kt { color: #ff7b72; }
.highlight .s, .highlight .s1, .highlight .s2, .highlight .sb, .highlight .sc, .highlight .si, .highlight .sd { color: #a5d6ff; }
.highlight .nf, .highlight .fm, .highlight .nc, .highlight .na, .highlight .nd, .highlight .ne, .highlight .nn { color: #d2a8ff; }
.highlight .nb, .highlight .bp, .highlight .vc, .highlight .vg, .highlight .vi, .highlight .vm, .highlight .no { color: #79c0ff; }
.highlight .mi, .highlight .mf, .highlight .mh, .highlight .mo, .highlight .il, .highlight .mb, .highlight .mx { color: #79c0ff; }
.highlight .p, .highlight .o, .highlight .w, .highlight .nx { color: #c9d1d9; }
.highlight .nt, .highlight .nv { color: #ffa657; }
.highlight .nl, .highlight .py, .highlight .ow { color: #ff7b72; }
.highlight .gd { color: #ffa198; } .highlight .gi { color: #7ee787; }
.highlight .err { color: #f85149; }

/* ================= 测验解说 ================= */
.quiz-expl {
  margin: 12px 16px 16px; padding: 10px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent-soft) 40%, var(--card));
  border-left: 3px solid var(--accent);
  font-size: 13.5px; line-height: 1.7;
  color: var(--muted-foreground);
}
.quiz-expl-label {
  display: block; font-size: 11px; font-weight: 700; letter-spacing: .08em;
  color: var(--accent); margin-bottom: 4px;
}
.quiz-expl-body { margin: 0; }

/* ================= 测验 ================= */
.quiz { margin: 22px 0; }
.quiz-item {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); margin: 10px 0; overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.quiz-item:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); }
.quiz-q {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 13px 16px; background: none; border: none; cursor: pointer;
  color: var(--foreground); text-align: left; font-size: 14.5px;
  font-family: inherit;
}
.quiz-q:hover { color: var(--accent); }
.quiz-q-static {
  display: flex; align-items: center; gap: 12px;
  padding: 13px 16px 4px;
  font-size: 14.5px; font-weight: 600;
}
.quiz-num {
  flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%;
  background: var(--accent); color: var(--accent-fg); display: flex;
  align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
}
.quiz-text { flex: 1; }
.quiz-chev { flex-shrink: 0; color: var(--muted); transition: transform .2s ease; }
.quiz-item.open .quiz-chev { transform: rotate(180deg); }
.quiz-a {
  padding: 13px 16px 15px; border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--accent-soft) 45%, var(--card));
}
.quiz-a-label { font-size: 11px; color: var(--muted); margin-bottom: 6px; font-weight: 700; letter-spacing: .08em; }
.quiz-a ul { margin: 0 0 0 20px; }
.quiz-a li { font-size: 14px; }

/* 选择题 */
.quiz-opts { padding: 10px 16px 16px; display: flex; flex-direction: column; gap: 8px; }
.quiz-opt {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  background: var(--card); color: var(--foreground); cursor: pointer;
  font-size: 14px; text-align: left; font-family: inherit;
  transition: border-color .15s ease, background-color .15s ease, transform .12s ease;
}
.quiz-opt:hover { border-color: var(--accent); background: var(--accent-soft); }
.quiz-opt-letter {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 6px;
  background: var(--accent-soft); color: var(--accent); display: flex;
  align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
}
.quiz-opt-text { flex: 1; }
.quiz-opt-mark { flex-shrink: 0; font-weight: 700; }
.quiz-opt.correct { border-color: #22c55e; background: color-mix(in srgb, #22c55e 12%, var(--card)); }
.quiz-opt.correct .quiz-opt-letter { background: #22c55e; color: #fff; }
.quiz-opt.wrong { border-color: #ef4444; background: color-mix(in srgb, #ef4444 10%, var(--card)); }
.quiz-opt.wrong .quiz-opt-letter { background: #ef4444; color: #fff; }
.quiz-opt:disabled { cursor: default; opacity: .92; }
.quiz-feedback { padding: 0 16px 14px; font-size: 13.5px; font-weight: 600; }
.quiz-feedback.ok { color: #16a34a; }
.quiz-feedback.bad { color: #dc2626; }

/* ================= 折叠块 ================= */
details.collapsible {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); margin: 18px 0; padding: 0 16px;
  box-shadow: var(--shadow-sm);
  transition: border-color .15s ease;
}
details.collapsible[open] { padding-bottom: 16px; }
details.collapsible:hover { border-color: var(--border-strong); }
details.collapsible summary {
  cursor: pointer; padding: 13px 0; font-weight: 600; font-size: 14.5px;
  user-select: none; list-style: none; display: flex; align-items: center; gap: 8px;
  transition: color .15s ease;
}
details.collapsible summary:hover { color: var(--accent); }
details.collapsible summary::-webkit-details-marker { display: none; }
details.collapsible summary::before {
  content: ""; width: 18px; height: 18px; flex-shrink: 0;
  background: currentColor;
  -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>') center / 18px no-repeat;
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>') center / 18px no-repeat;
  transition: transform .2s ease;
}
details.collapsible[open] summary::before { transform: rotate(180deg); }
details.collapsible > *:not(summary) { margin-bottom: 13px; }

/* ================= 图表（Mermaid） ================= */
.diagram-wrap {
  margin: 22px 0; padding: 16px;
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); overflow-x: auto;
  box-shadow: var(--shadow-sm);
}
.mermaid-box pre.mermaid {
  margin: 0; background: transparent; color: var(--muted);
  font-family: var(--mono); font-size: 12.5px; white-space: pre-wrap;
}
.mermaid svg {
  max-width: 100%; height: auto; display: block; margin: 0 auto;
}
.mermaid svg text { font-family: inherit; }
/* 渲染失败时兜底：把原始 mermaid 源码以等宽字展示，避免白屏 */
.mermaid-box pre.mermaid:not(:empty) { color: var(--muted); }

/* ================= 图标 ================= */
.cdd-icon {
  display: inline-block; vertical-align: -0.18em; color: currentColor;
  flex-shrink: 0;
}
.cdd-icon svg, svg.cdd-icon { color: currentColor; }
h2 .cdd-icon, h3 .cdd-icon { color: var(--accent); margin-right: 4px; }

/* ================= 时长徽章（标题旁） ================= */
.time-badge {
  display: inline-block; margin-left: 10px; vertical-align: middle;
  font-size: 12px; font-weight: 600; color: var(--accent);
  background: var(--accent-soft); padding: 2px 10px; border-radius: 999px;
  white-space: nowrap; letter-spacing: .02em;
}
h2 .time-badge, h3 .time-badge { font-size: 12px; }

/* ================= 滚动渐入 ================= */
.fade-in { opacity: 0; transform: translateY(8px); will-change: opacity, transform; }
.fade-in.visible { animation: fade-up .65s cubic-bezier(.25,.46,.45,.94) forwards; }
@keyframes fade-up { to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .fade-in { opacity: 1; transform: none; animation: none; }
  html { scroll-behavior: auto; }
}

/* ================= 页脚 ================= */
footer {
  margin-top: 70px; padding-top: 22px; border-top: 1px solid var(--border);
  color: var(--muted); font-size: 13px; text-align: center;
}

/* ================= 移动端 ================= */
@media (max-width: 920px) {
  .layout { display: block; }
  .toc {
    display: none; position: fixed; z-index: 150;
    top: 48px; left: 0; right: 0; width: 100%;
    max-height: 60vh; background: var(--background);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-md);
  }
  .toc.toc-open { display: block; }
  main { padding: 22px 18px 70px; max-width: 100%; }
  article h1 { font-size: 27px; }
  article h2 { font-size: 21px; margin-top: 42px; }
  .topbar { padding: 8px 12px; }
  .topbar-actions .btn { padding: 5px 10px; }
  .brand > span:last-child { max-width: 40vw; }
}

/* ================= 打印 ================= */
@media print {
  .topbar, .toc, #progress { display: none !important; }
  main { max-width: 100%; padding: 0; }
  article h2 { margin-top: 26px; }
  .fade-in { opacity: 1 !important; transform: none !important; animation: none !important; }
}
</style>
<style>
%%PYGMENTS_CSS%%
</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js"></script>
</head>
<body>
<div id="progress"></div>

<div class="topbar">
  <span class="brand">%%BRAND_ICON%%<span>%%TITLE%%</span></span>
  <span class="spacer"></span>
  <div class="topbar-actions">
    <button id="tocToggle" class="btn" type="button" aria-label="切换目录">%%TOC_ICON%%<span id="tocBtnLabel">目录</span></button>
    <button id="themeToggle" class="btn" type="button" aria-label="切换深浅色"><span id="themeIconBox">%%MOON_ICON%%</span><span id="themeLabel">暗色</span></button>
  </div>
</div>

<div class="layout">
  <aside class="toc" id="toc" aria-label="目录">
    <div class="toc-title">目录</div>
    <nav class="toc-nav" id="tocNav">
      %%TOC%%
    </nav>
  </aside>

  <main>
    <article>
      %%BODY%%
    </article>
    <footer>全文约 %%TOTAL_TIME%% 分钟 · 由 code-deep-dive 生成 · 适合碎片时间学习</footer>
  </main>
</div>

<script>
(function () {
  // ---------- 阅读进度 ----------
  var progress = document.getElementById("progress");
  function updateProgress() {
    var h = document.documentElement;
    var total = h.scrollHeight - h.clientHeight;
    progress.style.width = (total > 0 ? (h.scrollTop / total) * 100 : 0) + "%";
  }
  document.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  // ---------- 主题 ----------
  var themeToggle = document.getElementById("themeToggle");
  var themeLabel = document.getElementById("themeLabel");
  var SUN_SVG = '%%SUN_ICON%%';
  var MOON_SVG = '%%MOON_ICON%%';
  var themeIconBox = document.getElementById("themeIconBox");
  if (window.lucide) { try { lucide.createIcons(); } catch (e) {} }

  // Mermaid 渲染（初始化与主题切换共用）
  var mermaidBoxes = Array.prototype.slice.call(document.querySelectorAll(".mermaid-box"));
  window.__cddMermaid = mermaidBoxes.map(function (box) {
    return box.querySelector("pre.mermaid").textContent;
  });
  function renderMermaid() {
    if (!window.mermaid || !mermaidBoxes.length) return;
    mermaidBoxes.forEach(function (box, i) {
      box.querySelectorAll("svg").forEach(function (s) { s.remove(); });
      var pre = box.querySelector("pre.mermaid");
      if (!pre) {
        pre = document.createElement("pre");
        pre.className = "mermaid";
        box.appendChild(pre);
      }
      pre.textContent = window.__cddMermaid[i];
    });
    window.mermaid.run({ nodes: mermaidBoxes.map(function (b) { return b.querySelector("pre.mermaid"); }) })
      .catch(function (err) { console.error("Mermaid 渲染失败：", err); });
  }
  var MERMAID_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
  var MERMAID_LIGHT = {
    startOnLoad: false, theme: "base", fontFamily: MERMAID_FONT,
    themeVariables: {
      darkMode: false, fontSize: "14px", fontFamily: MERMAID_FONT,
      primaryColor: "#eef2ff", primaryBorderColor: "#818cf8", primaryTextColor: "#1e1b4b",
      secondaryColor: "#fdf2f8", secondaryBorderColor: "#f9a8d4", secondaryTextColor: "#831843",
      tertiaryColor: "#ecfdf5",
      lineColor: "#94a3b8", textColor: "#1e293b",
      edgeLabelBackground: "#ffffff",
      nodeTextColor: "#1e1b4b",
      actorBkg: "#eef2ff", actorBorder: "#818cf8", actorTextColor: "#1e1b4b", actorLineColor: "#94a3b8",
      signalColor: "#334155", signalTextColor: "#334155",
      labelBoxBkgColor: "#eef2ff", labelBoxBorderColor: "#818cf8", labelTextColor: "#1e1b4b",
      loopTextColor: "#334155", loopLineColor: "#94a3b8",
      noteBkgColor: "#fffbeb", noteBorderColor: "#f59e0b", noteTextColor: "#78350f",
      activationBkgColor: "#e0e7ff", activationBorderColor: "#6366f1"
    }
  };
  var MERMAID_DARK = {
    startOnLoad: false, theme: "base", fontFamily: MERMAID_FONT,
    themeVariables: {
      darkMode: true, fontSize: "14px", fontFamily: MERMAID_FONT,
      primaryColor: "#312e81", primaryBorderColor: "#818cf8", primaryTextColor: "#e0e7ff",
      secondaryColor: "#4a044e", secondaryBorderColor: "#e879f9", secondaryTextColor: "#fae8ff",
      tertiaryColor: "#052e16",
      lineColor: "#64748b", textColor: "#e2e8f0",
      edgeLabelBackground: "#1e293b",
      nodeTextColor: "#e0e7ff",
      actorBkg: "#312e81", actorBorder: "#818cf8", actorTextColor: "#e0e7ff", actorLineColor: "#64748b",
      signalColor: "#94a3b8", signalTextColor: "#e2e8f0",
      labelBoxBkgColor: "#312e81", labelBoxBorderColor: "#818cf8", labelTextColor: "#e0e7ff",
      loopTextColor: "#cbd5e1", loopLineColor: "#64748b",
      noteBkgColor: "#451a03", noteBorderColor: "#f59e0b", noteTextColor: "#fef3c7",
      activationBkgColor: "#3730a3", activationBorderColor: "#818cf8"
    }
  };
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    themeLabel.textContent = t === "dark" ? "亮色" : "暗色";
    themeIconBox.innerHTML = t === "dark" ? SUN_SVG : MOON_SVG;
    if (window.lucide) { try { lucide.createIcons(); } catch (e) {} }
    try { localStorage.setItem("cdd-theme", t); } catch (e) {}
    if (window.mermaid) {
      window.mermaid.initialize(t === "dark" ? MERMAID_DARK : MERMAID_LIGHT);
      renderMermaid();
    }
  }
  var saved = null;
  try { saved = localStorage.getItem("cdd-theme"); } catch (e) {}
  if (!saved) {
    saved = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  applyTheme(saved);
  themeToggle.addEventListener("click", function () {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  // ---------- 目录：桌面折叠 + 移动抽屉 ----------
  var toc = document.getElementById("toc");
  var tocToggle = document.getElementById("tocToggle");
  var tocBtnLabel = document.getElementById("tocBtnLabel");
  var isMobile = function () { return window.innerWidth <= 920; };
  tocToggle.addEventListener("click", function () {
    var open;
    if (isMobile()) {
      toc.classList.toggle("toc-open");
      open = toc.classList.contains("toc-open");
    } else {
      toc.classList.toggle("toc-hidden");
      open = !toc.classList.contains("toc-hidden");
    }
    tocBtnLabel.textContent = open ? "收起" : "目录";
    tocToggle.classList.toggle("active", open);
  });
  // 点击目录链接后在移动端收起
  toc.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      if (isMobile()) {
        toc.classList.remove("toc-open");
        tocBtnLabel.textContent = "目录";
      }
    });
  });

  // ---------- TOC 当前章节高亮 ----------
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll("#tocNav a"));
  var headings = Array.prototype.slice.call(document.querySelectorAll("article h2, article h3"));
  var currentId = null;
  function highlightToc() {
    var next = null;
    for (var i = 0; i < headings.length; i++) {
      var r = headings[i].getBoundingClientRect();
      if (r.top <= 90) next = headings[i];
    }
    var id = next ? "#" + next.id : null;
    if (id === currentId) return;
    currentId = id;
    tocLinks.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === id);
    });
  }
  document.addEventListener("scroll", highlightToc, { passive: true });
  highlightToc();

  // ---------- 测验 ----------
  // 问答：点击展开答案（含解说）
  document.querySelectorAll('.quiz-item[data-kind="qa"]').forEach(function (item) {
    var btn = item.querySelector(".quiz-q");
    var open = function () {
      var ans = item.querySelector(".quiz-a");
      var expanded = !ans.hasAttribute("hidden");
      ans.toggleAttribute("hidden");
      item.classList.toggle("open", expanded);
      btn.setAttribute("aria-expanded", expanded ? "false" : "true");
    };
    btn.addEventListener("click", open);
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
  // 选择题：点击选项给出正确/错误反馈，并展示解说
  document.querySelectorAll('.quiz-item[data-kind="choice"]').forEach(function (item) {
    var opts = item.querySelectorAll(".quiz-opt");
    var feedback = item.querySelector(".quiz-feedback");
    var expl = item.querySelector(".quiz-expl-wrap");
    opts.forEach(function (opt) {
      opt.addEventListener("click", function () {
        if (opt.disabled) return;
        var correct = opt.getAttribute("data-correct") === "1";
        opts.forEach(function (o) {
          o.disabled = true;
          if (o.getAttribute("data-correct") === "1") {
            o.classList.add("correct");
            o.querySelector(".quiz-opt-mark").textContent = "✓";
          }
        });
        if (!correct) {
          opt.classList.add("wrong");
          opt.querySelector(".quiz-opt-mark").textContent = "✗";
        }
        feedback.hidden = false;
        feedback.classList.add(correct ? "ok" : "bad");
        feedback.textContent = correct ? "回答正确" : "回答错误，正确选项已标出";
        if (expl) expl.hidden = false;
      });
    });
  });

  // ---------- 滚动渐入 ----------
  var fadeEls = document.querySelectorAll("article h2, article h3, article h4, table, .code-block, blockquote, .quiz-item, details, .diagram-wrap");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.02, rootMargin: "0px 0px -4% 0px" });
    fadeEls.forEach(function (el) {
      el.classList.add("fade-in");
      io.observe(el);
    });
  } else {
    fadeEls.forEach(function (el) { el.classList.add("visible"); });
  }

  // ---------- 代码块：软换行 / 复制 ----------
  document.querySelectorAll(".code-block").forEach(function (block) {
    var wrapBtn = block.querySelector(".wrap-toggle");
    var wrapLabel = wrapBtn.querySelector("span");
    wrapBtn.addEventListener("click", function () {
      var wrapped = block.classList.toggle("wrapped");
      wrapLabel.textContent = wrapped ? "不换行" : "软换行";
    });
    var copyBtn = block.querySelector(".copy-btn");
    var copyLabel = copyBtn.querySelector("span");
    copyBtn.addEventListener("click", function () {
      var text = block.querySelector("pre").innerText;
      function done() {
        copyLabel.textContent = "已复制";
        setTimeout(function () { copyLabel.textContent = "复制"; }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
      }
    });
  });
})();
</script>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description="code-deep-dive md → 单文件 HTML 转换器")
    parser.add_argument("input", help="输入 markdown 文件")
    parser.add_argument("output", nargs="?", help="输出 HTML 文件（默认同目录同名 .html）")
    parser.add_argument("--title", default="", help="自定义标题（默认用文件名）")
    args = parser.parse_args()

    src = Path(args.input)
    if not src.exists():
        print(f"输入文件不存在：{src}")
        sys.exit(1)

    md_text = src.read_text(encoding="utf-8")
    body, toc_html, toc_tokens = convert_md(md_text)
    total_minutes = estimate_total_minutes(body, toc_tokens)

    title = args.title or src.stem
    replacements = {
        "%%TITLE%%": html.escape(title),
        "%%BODY%%": body,
        "%%TOC%%": toc_html,
        "%%TOTAL_TIME%%": str(total_minutes),
        "%%BRAND_ICON%%": render_icon("book-open", 18),
        "%%TOC_ICON%%": render_icon("layers", 16),
        "%%SUN_ICON%%": render_icon("sun", 16),
        "%%MOON_ICON%%": render_icon("moon", 16),
        "%%PYGMENTS_CSS%%": PYGMENTS_CSS,
    }
    out_html = HTML_TEMPLATE
    for token, value in replacements.items():
        out_html = out_html.replace(token, value)

    out = Path(args.output) if args.output else src.with_suffix(".html")
    out.write_text(out_html, encoding="utf-8")
    print(f"已生成：{out}（{len(out_html) // 1024} KB）")


if __name__ == "__main__":
    main()
