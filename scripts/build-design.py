"""Build the public planning pages from reviewed Markdown and document metadata."""
from pathlib import Path
from html import escape
from urllib.parse import quote
import json
import re
import markdown

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / "design"
CURRENT = json.loads((DESIGN / "current.json").read_text())
CATALOG = json.loads((DESIGN / "catalog.json").read_text())
DATE = CURRENT["updatedAt"]


def slugify(value, separator):
    value = re.sub(r"[^\w\s-]", "", value.lower())
    return re.sub(r"[\s-]+", separator, value).strip(separator)


def header(nested=False):
    prefix = "../" if nested else ""
    portfolio = "../../" if nested else "../"
    return f'''<a class="skip" href="#main">跳到正文</a>
<header class="site-header"><a class="archive-identity" href="{portfolio}index.html"><strong>司靖波 <span>SYMBOL</span></strong></a>
<nav aria-label="主导航"><a href="{prefix}index.html">策划文档</a><a href="{prefix}history.html">历史资料</a><a href="{portfolio}index.html">作品集</a></nav></header>'''


def page(title, body, classes, nested=False):
    prefix = "../" if nested else ""
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0c0e12"><title>{escape(title)} · 司靖波游戏策划</title>
<meta name="description" content="《子时已到》游戏策划、系统设计、开发规范与历史资料。">
<link rel="icon" href="{prefix}../favicon.svg"><link rel="stylesheet" href="{prefix}archive.css?v=20261114"><link rel="stylesheet" href="{prefix}planning.css?v=20261114">
<script src="{prefix}archive.js?v=20261114" defer></script><script src="{prefix}archive-flow.js?v=planning-flow-20261114" defer></script></head><body class="{classes}"><canvas class="archive-flow" aria-hidden="true" role="presentation"></canvas>{header(nested)}
<main id="main">{body}</main><footer class="site-footer"><div><strong>司靖波 / Symbol</strong><p>游戏策划与系统设计</p></div><p>文档更新：{DATE}<br><a href="{prefix}index.html">策划文档</a> · <a href="{prefix}history.html">历史资料</a></p></footer></body></html>'''


def flow_table(match):
    source = match[1]
    labels = dict(re.findall(r'([A-Za-z]\w*)[\[{]"([^"\n]+)"[\]}]', source))
    rows = []
    for line in source.splitlines():
        edge = re.search(r'([A-Za-z]\w*)(?:[\[{]"[^"\n]+"[\]}])?\s*(?:-->|-\.->)\s*(?:\|([^|]+)\|)?\s*([A-Za-z]\w*)', line)
        if edge:
            start, condition, end = edge.groups()
            rows.append(f"<tr><td>{escape(labels.get(start, start))}</td><td>{escape(condition or '完成当前步骤')}</td><td>{escape(labels.get(end, end))}</td></tr>")
    return '<table><thead><tr><th>当前页面或状态</th><th>条件</th><th>后续页面或状态</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table>'


def build_reader(document, position):
    source = (DESIGN / "sources" / f'{document["slug"]}.md').read_text()
    source = re.sub(r'^# .+\n', '', source, count=1, flags=re.M)
    source = re.sub(r'```mermaid\n(.*?)```', flow_table, source, flags=re.S)
    renderer = markdown.Markdown(extensions=["tables", "fenced_code", "toc"], extension_configs={"toc": {"slugify": slugify, "permalink": False}})
    content = renderer.convert(source)
    content = re.sub(r'<table>(.*?)</table>', r'<div class="table-scroll" tabindex="0" role="region" aria-label="数据表格，可横向滚动"><table>\1</table></div>', content, flags=re.S)
    content = re.sub(r'<p>(<img[^>]+src="([^"]+)"[^>]*>)</p>', r'<figure class="planning-diagram"><div tabindex="0" role="region" aria-label="游戏循环图，可横向滚动">\1</div><figcaption><a href="\2" target="_blank" rel="noopener">查看完整循环图 ↗</a></figcaption></figure>', content)
    toc = renderer.toc.replace('<div class="toc">', '<div class="toc-links">')
    previous = CURRENT["documents"][position - 1] if position else None
    following = CURRENT["documents"][position + 1] if position + 1 < len(CURRENT["documents"]) else None
    adjacent = ''.join(f'<a href="{item["slug"]}.html"><small>{label}</small>{escape(item["title"])}</a>' if item else '<span></span>' for item, label in [(previous, '上一篇'), (following, '下一篇')])
    body = f'''<div class="doc-top"><a class="back-link" href="../index.html">← 策划文档</a>
<div class="doc-tags"><span>子时已到</span><span>{escape(document['group'])}</span><span>{escape(document['status'])}</span></div>
<h1>{escape(document['title'])}</h1><p class="doc-intro">{escape(document['summary'])}</p>
<div class="doc-metadata"><span>规则依据：{CURRENT['rulesAsOf']}</span><span>文字修订：{DATE}</span><a href="../sources/{document['slug']}.md" download>下载 Markdown</a></div></div>
<div class="doc-layout"><aside class="toc"><details open><summary>本文目录</summary><nav aria-label="本文目录">{toc}</nav></details><a class="to-top" href="#main">返回顶部 ↑</a></aside>
<div class="doc-reading"><p class="version-note">{escape(document['scope'])}</p><article class="prose">{content}</article>
<nav class="adjacent" aria-label="相邻文档">{adjacent}</nav></div></div>'''
    (DESIGN / "docs" / f'{document["slug"]}.html').write_text(page(document['title'], body, 'document-page midnight design-reader planning-reader', True))


def document_list(documents):
    return '<ol class="planning-list">' + ''.join(f'''<li><a href="docs/{d['slug']}.html"><span class="list-number">{i:02d}</span><div><h3>{escape(d['title'])}</h3><p>{escape(d['summary'])}</p></div><span class="list-open" aria-hidden="true">↗</span></a></li>''' for i, d in enumerate(documents, 1)) + '</ol>'


def build_home():
    documents = CURRENT['documents']
    overview = documents[0]
    secondary = documents[1]
    body = f'''<section class="planning-intro"><p class="eyebrow">GAME DESIGN / SYMBOL</p><h1>游戏策划文档</h1><p>《子时已到》正式 Unity 版本的玩法与系统设计，包含设计依据、功能规则和验证方案。</p><div class="intro-meta"><span>{len(documents)} 份文档</span><span>现行规则依据：{CURRENT['rulesAsOf']}</span><span>更新：{DATE}</span></div></section>
<section class="planning-section" id="overview"><div class="planning-heading"><span>01</span><h2>策划总览</h2></div>
<div class="overview-feature"><div><p class="eyebrow">子时已到 / UNITY</p><h3>{escape(overview['title'])}</h3><p>{escape(overview['summary'])}</p><a class="read-button" href="docs/{overview['slug']}.html">阅读策划案 <span aria-hidden="true">→</span></a></div>
<dl><dt>核心玩法</dt><dd>自动攻击、子弹时间锁敌、破绽连击、超载与主动技能</dd><dt>系统范围</dt><dd>局内选卡、关卡推进、结算、强化、皮肤、技能与商城</dd><dt>项目职责</dt><dd>司靖波独立主导设计与迭代，AI 辅助实现</dd></dl></div>
<a class="overview-secondary" href="docs/{secondary['slug']}.html"><strong>{escape(secondary['title'])}</strong><span>{escape(secondary['summary'])}</span><span aria-hidden="true">↗</span></a></section>
<section class="planning-section" id="systems"><div class="planning-heading"><span>02</span><h2>系统设计</h2><p>规则、状态、数值及系统关系</p></div>{document_list([d for d in documents if d['group']=='系统设计'])}</section>
<section class="planning-section" id="workflow"><div class="planning-heading"><span>03</span><h2>开发规范与验证</h2><p>立项、功能交接、界面与测试</p></div>{document_list([d for d in documents if d['group']=='开发规范'])}</section>
<section class="history-entry" id="history"><div><h2>历史资料</h2><p>早期原型、设计复盘、独立试验及《远行商人》资料统一保留在档案页。</p></div><a href="history.html">浏览历史资料 →</a></section>'''
    (DESIGN / 'index.html').write_text(page('游戏策划文档', body, 'planning-home'))


def build_history():
    documents = [d for d in CATALOG['documents'] if d['slug'] not in {c['slug'] for c in CURRENT['documents']}]
    categories = sorted({d['category'] for d in documents})
    options = ''.join(f'<option value="{escape(c)}">{escape(c)}</option>' for c in categories)
    rows = []
    for d in sorted(documents, key=lambda d:d.get('date',''), reverse=True):
        project_name = '子时已到' if d['project']=='midnight' else '远行商人'
        query = ' '.join([d['title'], d['summary'], project_name, d['category']]).lower()
        rows.append(f'''<article class="document-row" data-project="{d['project']}" data-category="{escape(d['category'])}" data-search="{escape(query, quote=True)}"><div class="row-date"><time>{escape(d.get('dateDisplay',d.get('date','')))}</time><small>历史资料</small></div><div class="row-main"><div class="row-tags"><span>{project_name}</span><span>{escape(d['category'])}</span></div><h3><a href="docs/{d['slug']}.html">{escape(d['title'])}</a></h3><p>{escape(d['summary'])}</p></div><span class="row-arrow" aria-hidden="true">↗</span></article>''')
    body = f'''<section class="planning-intro history-intro"><p class="eyebrow">DESIGN ARCHIVE</p><h1>历史资料</h1><p>保留开发时的版本与判断，供查阅设计演变。当前《子时已到》规则请阅读<a href="index.html">策划文档</a>。</p></section>
<section id="catalog"><h2 class="catalog-heading">文档检索</h2><form class="catalog-controls" role="search"><label>关键词<input id="search" type="search" placeholder="搜索标题、系统或设计主题"></label><label>项目<select id="project-filter"><option value="all">全部项目</option><option value="midnight">子时已到</option><option value="merchant">远行商人</option></select></label><label>分类<select id="category-filter"><option value="all">全部分类</option>{options}</select></label><button type="button" id="reset-filters">清除筛选</button></form>
<p id="result-count" aria-live="polite">共 {len(documents)} 份历史文档</p><div class="document-list">{''.join(rows)}</div><div class="empty-state" id="empty-state" hidden><h3>没有匹配文档</h3><p>请调整关键词或筛选条件。</p><button type="button" data-reset>清除筛选</button></div></section>'''
    (DESIGN / 'history.html').write_text(page('历史资料', body, 'planning-home history-home'))


for position, document in enumerate(CURRENT['documents']):
    build_reader(document, position)
build_home()
build_history()
print(f"Built {len(CURRENT['documents'])} documents, planning home and history catalog.")
