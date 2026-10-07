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
    fileName: 'VideoVault-Politika-konfidencialnosti',
    fallbackTitle: 'Политика конфиденциальности',
    navTitle: 'Политика конфиденциальности',
    eyebrow: 'Защита данных',
    description: 'Порядок обработки и защиты персональных данных пользователей VideoVault.',
  },
  {
    route: 'terms',
    source: 'terms.md',
    fileName: 'VideoVault-Polzovatelskoe-soglashenie',
    fallbackTitle: 'Пользовательское соглашение',
    navTitle: 'Пользовательское соглашение',
    eyebrow: 'Правила сервиса',
    description: 'Условия законного и безопасного использования возможностей VideoVault.',
  },
  {
    route: 'consent',
    source: 'consent.md',
    fileName: 'VideoVault-Soglasie-na-obrabotku-personalnyh-dannyh',
    fallbackTitle: 'Согласие на обработку персональных данных',
    navTitle: 'Согласие на обработку ПДн',
    eyebrow: 'Согласие субъекта',
    description: 'Согласие на обработку персональных данных в соответствии со статьей 9 Федерального закона № 152-ФЗ.',
  },
  {
    route: 'cookies',
    source: 'cookies.md',
    fileName: 'VideoVault-Ispolzovanie-cookie',
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
    title: 'Скачать документы',
    description: 'Копии правовых документов для офлайн-просмотра, печати и архива.',
    links: [
      { href: '/legal/download/privacy.html', label: 'Политика конфиденциальности', note: 'HTML для скачивания', download: 'VideoVault-Politika-konfidencialnosti.html' },
      { href: '/legal/download/consent.html', label: 'Согласие на обработку ПДн', note: 'HTML для скачивания', download: 'VideoVault-Soglasie-na-obrabotku-personalnyh-dannyh.html' },
      { href: '/legal/download/terms.html', label: 'Пользовательское соглашение', note: 'HTML для скачивания', download: 'VideoVault-Polzovatelskoe-soglashenie.html' },
      { href: '/legal/download/cookies.html', label: 'Использование файлов cookie', note: 'HTML для скачивания', download: 'VideoVault-Ispolzovanie-cookie.html' },
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

/**
 * Download block shown on every document page.
 *
 * "Скачать HTML" points at a self-contained copy (styles inlined) so the saved
 * file still renders correctly offline; "Сохранить в PDF" uses the browser's
 * own print-to-PDF, which produces a proper Cyrillic PDF without shipping a
 * font binary or a headless-browser dependency in the image.
 */
const downloadBlock = (doc) => `<section class="legal-download" aria-labelledby="download-title">
            <div>
              <h2 id="download-title">Скачать документ</h2>
              <p>Сохраните документ для офлайн-просмотра, печати или архива.</p>
            </div>
            <div class="legal-download__actions">
              <a class="legal-download__button legal-download__button--primary" href="/legal/download/${doc.route}.html" download="${doc.fileName}.html">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
                Скачать HTML
              </a>
              <button class="legal-download__button" type="button" onclick="window.print()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 19H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 15h10v6H7z" /></svg>
                Сохранить в PDF
              </button>
              <a class="legal-download__button" href="/legal/${doc.source}" download="${doc.fileName}.md">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5" /></svg>
                Markdown
              </a>
            </div>
          </section>`;

const layout = ({ route, title, description, body, robots = 'index, follow' }) => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — VideoVault</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${robots}" />
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

          ${downloadBlock(doc)}

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

/**
 * Self-contained copy of a document for download: no external stylesheet, no
 * fonts and no scripts, so the saved file stays readable offline and prints
 * cleanly straight from disk.
 */
const renderDownloadableDocument = (doc) => {
  const markdown = fs.readFileSync(path.join(LEGAL_DIR, doc.source), 'utf8');
  const parsed = parseDocument(markdown, doc.fallbackTitle);

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(doc.fallbackTitle)} — VideoVault</title>
    <meta name="robots" content="noindex" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body {
        max-width: 820px;
        margin: 0 auto;
        padding: 48px 24px 72px;
        font-family: "Manrope", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        font-size: 16px;
        line-height: 1.75;
        color: #16202f;
        background: #fff;
      }
      header { padding-bottom: 22px; margin-bottom: 34px; border-bottom: 2px solid #0a84ff; }
      .brand { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.02em; color: #0b1220; }
      .brand span { color: #6b7a90; font-weight: 700; }
      h1 { margin: 16px 0 10px; font-size: 1.7rem; line-height: 1.25; letter-spacing: -0.02em; }
      .meta { font-size: 0.85rem; color: #6b7a90; }
      .meta a { color: #0a84ff; }
      h2 { margin: 34px 0 12px; font-size: 1.2rem; line-height: 1.3; }
      h3 { margin: 22px 0 8px; font-size: 1rem; }
      p { margin: 0 0 14px; }
      ul { margin: 8px 0 18px; padding-left: 22px; }
      li { margin-bottom: 6px; }
      strong { font-weight: 700; }
      a { color: #0a84ff; }
      footer { margin-top: 44px; padding-top: 20px; border-top: 1px solid #dfe5ee; font-size: 0.85rem; color: #6b7a90; }
      @page { margin: 18mm 16mm; }
      @media print {
        body { padding: 0; font-size: 11.5pt; color: #000; }
        a { color: #000; text-decoration: none; }
        h2, h3 { page-break-after: avoid; }
        p, li { orphans: 3; widows: 3; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">VideoVault · <span>ВидеоВолт</span></div>
      <h1>${escapeHtml(parsed.title)}</h1>
      <p class="meta">
        ${parsed.revision ? `${escapeHtml(parsed.revision)}<br />` : ''}
        Источник: <a href="${ORIGIN}/${doc.route}">${ORIGIN}/${doc.route}</a>
      </p>
    </header>

    <main>
      ${parsed.blocks.join('\n      ')}
    </main>

    <footer>
      <p>
        Оператор персональных данных: Кузнецов Дмитрий Владимирович, ИНН 614024581040,
        Российская Федерация, г. Енакиево. Электронная почта:
        <a href="mailto:kud3544@gmail.com">kud3544@gmail.com</a>.
      </p>
      <p>Актуальная редакция документа доступна на <a href="${ORIGIN}/${doc.route}">${ORIGIN}/${doc.route}</a>.</p>
    </footer>
  </body>
</html>
`;
};

const renderSitemapPage = () => {
  const cards = SITEMAP_SECTIONS.map((section) => `<section class="sitemap-card">
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.description)}</p>
          <ul>
            ${section.links.map((link) => {
    const download = link.download ? ` download="${escapeHtml(link.download)}"` : '';
    return `<li><a href="${escapeHtml(link.href)}"${download}>${escapeHtml(link.label)}<span>${escapeHtml(link.note)}</span></a></li>`;
  }).join('\n            ')}
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

/**
 * Служебная страница выгрузки реестра согласий. Пароль проверяет только
 * backend (/api/registry/export); страница лишь отправляет его и сохраняет
 * полученный Excel-файл. Не индексируется и не входит в карту сайта.
 */
const renderRegistryPage = () => {
  const script = `
(function () {
  var form = document.getElementById('registry-form');
  var button = document.getElementById('registry-submit');
  var status = document.getElementById('registry-status');

  function show(message, kind) {
    status.textContent = message;
    status.className = 'registry-status' + (kind ? ' registry-status--' + kind : '');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    button.disabled = true;
    show('Формируем файл…');

    fetch('/api/registry/export', { method: 'POST', body: new FormData(form), credentials: 'same-origin' })
      .then(function (response) {
        if (response.status === 401) throw new Error('Неверный пароль.');
        if (response.status === 429) {
          var minutes = Math.ceil((parseInt(response.headers.get('Retry-After'), 10) || 900) / 60);
          throw new Error('Слишком много попыток. Повторите через ' + minutes + ' мин.');
        }
        if (!response.ok) throw new Error('Реестр временно недоступен. Попробуйте позже.');

        var disposition = response.headers.get('Content-Disposition') || '';
        var match = disposition.match(/filename="([^"]+)"/);
        var count = response.headers.get('X-Registry-Count');
        return response.blob().then(function (blob) {
          return { blob: blob, name: match ? match[1] : 'videovault-registry.xlsx', count: count };
        });
      })
      .then(function (file) {
        var url = URL.createObjectURL(file.blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        form.reset();
        show('Файл загружен' + (file.count !== null ? ': записей — ' + file.count : '') + '.', 'success');
      })
      .catch(function (error) {
        show(error.message, 'error');
      })
      .then(function () {
        button.disabled = false;
      });
  });
})();`;

  const body = `    <main id="legal-content" class="legal-main">
      <section class="legal-hero">
        <div class="container legal-hero__inner">
          <span class="legal-eyebrow">Служебный раздел</span>
          <h1>Реестр согласий</h1>
          <p>Выгрузка всех зафиксированных согласий пользователей в формате Excel. Доступ только по паролю оператора.</p>
        </div>
      </section>

      <div class="container registry-wrap">
        <form id="registry-form" class="registry-card" autocomplete="off">
          <label for="registry-password">Пароль доступа</label>
          <input id="registry-password" name="password" type="password" required autocomplete="current-password" spellcheck="false" />
          <button id="registry-submit" type="submit" class="legal-download__button legal-download__button--primary">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
            Скачать реестр (.xlsx)
          </button>
          <p id="registry-status" class="registry-status" role="status" aria-live="polite"></p>
          <p class="registry-note">Файл содержит персональные данные (IP-адреса). Храните его в соответствии с Политикой конфиденциальности и не передавайте третьим лицам.</p>
        </form>
      </div>
    </main>
    <script>${script}</script>`;

  return layout({
    route: 'registry',
    title: 'Реестр согласий',
    description: 'Служебная выгрузка реестра согласий.',
    body,
    robots: 'noindex, nofollow',
  });
};

/** Редакции документов — передаются вместе с каждым согласием в реестр. */
const writeLegalVersions = () => {
  const versions = {};
  DOCUMENTS.forEach((doc) => {
    const markdown = fs.readFileSync(path.join(LEGAL_DIR, doc.source), 'utf8');
    versions[doc.route] = parseDocument(markdown, doc.fallbackTitle).revision.replace(/^Редакция от\s*/, '');
  });
  const target = path.join(__dirname, '..', 'src', 'generated', 'legalVersions.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(versions, null, 2)}\n`, 'utf8');
  return 'src/generated/legalVersions.json';
};

const main = () => {
  const written = [];
  const lastmod = new Date().toISOString().slice(0, 10);

  DOCUMENTS.forEach((doc) => {
    written.push(writeFile(path.join(doc.route, 'index.html'), renderDocumentPage(doc)));
    written.push(writeFile(path.join('legal', 'download', `${doc.route}.html`), renderDownloadableDocument(doc)));
  });

  written.push(writeFile(path.join('sitemap', 'index.html'), renderSitemapPage()));
  written.push(writeFile('sitemap.xml', renderSitemapXml(lastmod)));
  written.push(writeFile(path.join('registry', 'index.html'), renderRegistryPage()));

  written.forEach((file) => console.log(`  legal: generated public/${file}`));
  console.log(`  legal: generated ${writeLegalVersions()}`);
};

main();
