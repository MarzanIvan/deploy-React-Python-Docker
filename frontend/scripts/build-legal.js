#!/usr/bin/env node
/**
 * Generates static, JavaScript-free HTML for the legal documents, the HTML
 * sitemap and sitemap.xml.
 *
 * Why static: videovault.ru is a single-page app, so a crawler that does not
 * execute JavaScript (including the automated 152-ФЗ / Roskomnadzor checks that
 * run "наблюдение без взаимодействия") only sees an empty <div id="root">.
 * Pre-rendering these pages means the documents are readable straight from the
 * HTTP response, with no JS and no client-side routing involved.
 *
 * Source of truth stays public/legal/*.md — this script only renders it.
 * Wired to npm "prebuild"/"prestart", so output cannot drift from the markdown.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const LEGAL_DIR = path.join(PUBLIC_DIR, 'legal');
const ORIGIN = 'https://videovault.ru';

const DOCUMENTS = [
  {
    route: 'privacy',
    source: 'privacy.md',
    fallbackTitle: 'Политика конфиденциальности',
    navTitle: 'Политика конфиденциальности',
    eyebrow: 'Защита данных',
    description: 'Порядок обработки и защиты персональных данных пользователей VideoVault.',
  },
  {
    route: 'terms',
    source: 'terms.md',
    fallbackTitle: 'Пользовательское соглашение',
    navTitle: 'Пользовательское соглашение',
    eyebrow: 'Правила сервиса',
    description: 'Условия законного и безопасного использования возможностей VideoVault.',
  },
  {
    route: 'consent',
    source: 'consent.md',
    fallbackTitle: 'Согласие на обработку персональных данных',
    navTitle: 'Согласие на обработку ПДн',
    eyebrow: 'Согласие субъекта',
    description: 'Согласие на обработку персональных данных в соответствии со статьей 9 Федерального закона № 152-ФЗ.',
  },
  {
    route: 'cookies',
    source: 'cookies.md',
    fallbackTitle: 'Использование файлов cookie',
    navTitle: 'Использование cookie',
    eyebrow: 'Ваш выбор',
    description: 'Какие технологии хранения применяет VideoVault и как ими управлять.',
  },
];

const SITEMAP_SECTIONS = [
  {
    title: 'Основные разделы',
    description: 'Страницы и разделы сервиса VideoVault.',
    links: [
      { href: '/', label: 'Главная', note: 'Загрузка видео по ссылке' },
      { href: '/#features', label: 'Возможности', note: 'Качество, форматы, приватность' },
      { href: '/#instructions', label: 'Помощь', note: 'Установка видеоплееров' },
      { href: '/#about', label: 'О сервисе', note: 'Информация о VideoVault' },
      { href: '/#contact', label: 'Контакты', note: 'Связь с оператором' },
    ],
  },
  {
    title: 'Правовые документы',
    description: 'Документы, обязательные в соответствии с Федеральным законом № 152-ФЗ.',
    links: [
      { href: '/privacy', label: 'Политика конфиденциальности', note: 'Обработка и защита персональных данных' },
      { href: '/consent', label: 'Согласие на обработку персональных данных', note: 'Статья 9 Федерального закона № 152-ФЗ' },
      { href: '/terms', label: 'Пользовательское соглашение', note: 'Условия использования сервиса' },
      { href: '/cookies', label: 'Использование файлов cookie', note: 'Технологии хранения и управление выбором' },
    ],
  },
  {
    title: 'Служебные ресурсы',
    description: 'Технические файлы для поисковых систем и проверяющих систем.',
    links: [
      { href: '/sitemap.xml', label: 'sitemap.xml', note: 'Карта сайта в формате XML' },
      { href: '/robots.txt', label: 'robots.txt', note: 'Правила обхода для роботов' },
    ],
  },
];

/**
 * nginx serves /legal/legal.css with `immutable, max-age=604800`, and the file
 * name carries no build hash. Without a version query a styling fix would not
 * reach returning visitors for a week, so the URL is keyed to the file content.
 */
const stylesheetUrl = () => {
  const css = fs.readFileSync(path.join(LEGAL_DIR, 'legal.css'));
  const hash = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);
  return `/legal/legal.css?v=${hash}`;
};

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** Renders **bold** and [label](href) inside an already-trusted text run. */
const renderInline = (text) => text
  .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  .filter(Boolean)
  .map((token) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return `<strong>${renderInline(token.slice(2, -2))}</strong>`;
    }

    const link = token.match(/^\[([^\]]+)]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      const external = /^https?:/i.test(href);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${escapeHtml(href)}"${attrs}>${renderInline(label)}</a>`;
    }

    return escapeHtml(token);
  })
  .join('');

const parseDocument = (markdown, fallbackTitle) => {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const titleLine = lines.find((line) => line.startsWith('# '));
  const revisionLine = lines.find((line) => /^\*\*Редакция/.test(line));
  const title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : fallbackTitle;
  const revision = revisionLine ? revisionLine.replace(/^\*\*|\*\*$/g, '').trim() : '';

  const blocks = [];
  const sections = [];
  let sectionIndex = 0;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line || lines[index] === titleLine || lines[index] === revisionLine) {
      index += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      sectionIndex += 1;
      const text = line.replace(/^##\s+/, '');
      const id = `section-${sectionIndex}`;
      blocks.push(`<h2 id="${id}">${renderInline(text)}</h2>`);
      sections.push({ id, title: text });
      index += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(`<h3>${renderInline(line.replace(/^###\s+/, ''))}</h3>`);
      index += 1;
      continue;
    }

    if (line.startsWith('* ')) {
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith('* ')) {
        items.push(`<li>${renderInline(lines[index].trim().replace(/^\*\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>\n${items.map((item) => `    ${item}`).join('\n')}\n  </ul>`);
      continue;
    }

    const paragraph = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current || current.startsWith('#') || current.startsWith('* ')) break;
      paragraph.push(renderInline(current));
      index += 1;
    }
    blocks.push(`<p>${paragraph.join('<br />')}</p>`);
  }

  return { title, revision, blocks, sections };
};

const THEME_BOOTSTRAP = `<script>(function(){try{if(localStorage.getItem('theme')==='dark'){document.body.classList.add('dark-theme');}}catch(e){}})();</script>`;

const THEME_TOGGLE = `<button class="legal-theme-button" type="button" aria-label="Переключить тему" onclick="(function(){var d=document.body.classList.toggle('dark-theme');try{localStorage.setItem('theme',d?'dark':'light');}catch(e){}})()">
            <svg class="icon-light" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>
            <svg class="icon-dark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
          </button>`;

const COOKIE_RESET = `<button type="button" onclick="(function(){try{localStorage.removeItem('videovault_cookie_consent');}catch(e){}location.href='/';})()">Настройки cookie</button>`;

const header = () => `<header class="legal-header">
      <div class="container legal-header__inner">
        <a class="legal-brand" href="/" aria-label="VideoVault — на главную">
          <img src="/favicon-32x32.png" width="32" height="32" alt="" />
          <span>VideoVault</span>
          <span class="legal-brand__ru">ВидеоВолт</span>
        </a>
        <div class="legal-header__actions">
          <a class="legal-back-link" href="/">На главную</a>
          ${THEME_TOGGLE}
        </div>
      </div>
    </header>`;

const footer = () => `<footer class="legal-footer">
      <div class="container legal-footer__inner">
        <p>© 2026 VideoVault · ВидеоВолт</p>
        <div>
          <a href="/">Главная</a>
          <a href="/sitemap">Карта сайта</a>
          ${COOKIE_RESET}
        </div>
      </div>
    </footer>`;

const relatedNav = (currentRoute) => `<nav class="legal-related" aria-label="Другие правовые документы">
            ${DOCUMENTS.map((doc) => {
    const current = doc.route === currentRoute ? ' class="is-current"' : '';
    return `<a href="/${doc.route}"${current}>${escapeHtml(doc.navTitle)}</a>`;
  }).join('\n            ')}
          </nav>`;

const layout = ({ route, title, description, body }) => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — VideoVault</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${ORIGIN}/${route}" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${stylesheetUrl()}" />
  </head>
  <body>
    ${THEME_BOOTSTRAP}
    <a class="skip-link" href="#legal-content">Перейти к документу</a>
    ${header()}
${body}
    ${footer()}
  </body>
</html>
`;

const renderDocumentPage = (doc) => {
  const markdown = fs.readFileSync(path.join(LEGAL_DIR, doc.source), 'utf8');
  const parsed = parseDocument(markdown, doc.fallbackTitle);

  const toc = parsed.sections.length
    ? `<aside class="legal-toc">
          <p class="legal-toc__title">Содержание</p>
          <nav aria-label="Содержание документа">
            ${parsed.sections.map((s) => `<a href="#${s.id}">${escapeHtml(s.title)}</a>`).join('\n            ')}
          </nav>
        </aside>`
    : '';

  const body = `    <main id="legal-content" class="legal-main">
      <section class="legal-hero">
        <div class="container legal-hero__inner">
          <span class="legal-eyebrow">${escapeHtml(doc.eyebrow)}</span>
          <h1>${escapeHtml(parsed.title)}</h1>
          <p>${escapeHtml(doc.description)}</p>
          ${parsed.revision ? `<span class="legal-revision">${escapeHtml(parsed.revision)}</span>` : ''}
        </div>
      </section>

      <div class="container legal-layout">
        ${toc}
        <article class="legal-document">
          ${parsed.blocks.join('\n          ')}

          ${relatedNav(doc.route)}
        </article>
      </div>
    </main>`;

  return layout({
    route: doc.route,
    // Tab title uses the friendly name; the <h1> keeps the document's formal
    // (upper-case) legal title as written in the markdown.
    title: doc.fallbackTitle,
    description: doc.description,
    body,
  });
};

const renderSitemapPage = () => {
  const cards = SITEMAP_SECTIONS.map((section) => `<section class="sitemap-card">
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.description)}</p>
          <ul>
            ${section.links.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}<span>${escapeHtml(link.note)}</span></a></li>`).join('\n            ')}
          </ul>
        </section>`).join('\n        ');

  const body = `    <main id="legal-content" class="legal-main">
      <section class="legal-hero">
        <div class="container legal-hero__inner">
          <span class="legal-eyebrow">Навигация</span>
          <h1>Карта сайта</h1>
          <p>Полный перечень страниц VideoVault, включая правовые документы и служебные ресурсы.</p>
        </div>
      </section>

      <div class="container sitemap-grid">
        ${cards}
      </div>
    </main>`;

  return layout({
    route: 'sitemap',
    title: 'Карта сайта',
    description: 'Полный перечень страниц и правовых документов сервиса VideoVault.',
    body,
  });
};

const renderSitemapXml = (lastmod) => {
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/privacy', priority: '0.8', changefreq: 'monthly' },
    { loc: '/consent', priority: '0.8', changefreq: 'monthly' },
    { loc: '/terms', priority: '0.8', changefreq: 'monthly' },
    { loc: '/cookies', priority: '0.7', changefreq: 'monthly' },
    { loc: '/sitemap', priority: '0.5', changefreq: 'monthly' },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${ORIGIN}${url.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
};

const writeFile = (relativePath, contents) => {
  const target = path.join(PUBLIC_DIR, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
  return relativePath;
};

const main = () => {
  const written = [];
  const lastmod = new Date().toISOString().slice(0, 10);

  DOCUMENTS.forEach((doc) => {
    written.push(writeFile(path.join(doc.route, 'index.html'), renderDocumentPage(doc)));
  });

  written.push(writeFile(path.join('sitemap', 'index.html'), renderSitemapPage()));
  written.push(writeFile('sitemap.xml', renderSitemapXml(lastmod)));

  written.forEach((file) => console.log(`  legal: generated public/${file}`));
};

main();
