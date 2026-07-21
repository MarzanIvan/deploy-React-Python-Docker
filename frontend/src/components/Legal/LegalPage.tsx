import { ReactNode, useEffect, useMemo, useState } from 'react'
import CookieConsent, { openCookieSettings } from '../CookieConsent/CookieConsent'
import './LegalPage.css'

export type LegalDocumentType = 'privacy' | 'terms' | 'cookies'

interface LegalPageProps {
	type: LegalDocumentType
	isDarkMode: boolean
	onToggleTheme: () => void
	logo: string
}

interface LegalBlock {
	type: 'heading-2' | 'heading-3' | 'paragraph' | 'list'
	text?: string
	lines?: string[]
	items?: string[]
	id?: string
}

interface ParsedDocument {
	title: string
	revision: string
	blocks: LegalBlock[]
	sections: Array<{ id: string; title: string }>
}

const pageConfig: Record<LegalDocumentType, {
	source: string
	fallbackTitle: string
	eyebrow: string
	description: string
}> = {
	privacy: {
		source: '/legal/privacy.md',
		fallbackTitle: 'Политика конфиденциальности',
		eyebrow: 'Защита данных',
		description: 'Порядок обработки и защиты персональных данных пользователей VideoVault.',
	},
	terms: {
		source: '/legal/terms.md',
		fallbackTitle: 'Пользовательское соглашение',
		eyebrow: 'Правила сервиса',
		description: 'Условия законного и безопасного использования возможностей VideoVault.',
	},
	cookies: {
		source: '/legal/cookies.md',
		fallbackTitle: 'Использование файлов cookie',
		eyebrow: 'Ваш выбор',
		description: 'Какие технологии хранения применяет VideoVault и как ими управлять.',
	},
}

const parseDocument = (markdown: string, fallbackTitle: string): ParsedDocument => {
	const lines = markdown.replace(/\r/g, '').split('\n')
	const titleLine = lines.find(line => line.startsWith('# '))
	const revisionLine = lines.find(line => /^\*\*Редакция/.test(line))
	const title = titleLine?.replace(/^#\s+/, '').trim() || fallbackTitle
	const revision = revisionLine?.replace(/^\*\*|\*\*$/g, '').trim() || ''
	const blocks: LegalBlock[] = []
	const sections: Array<{ id: string; title: string }> = []
	let sectionIndex = 0
	let index = 0

	while (index < lines.length) {
		const line = lines[index].trim()

		if (!line || line === titleLine || line === revisionLine) {
			index += 1
			continue
		}

		if (line.startsWith('## ')) {
			sectionIndex += 1
			const text = line.replace(/^##\s+/, '')
			const id = `section-${sectionIndex}`
			blocks.push({ type: 'heading-2', text, id })
			sections.push({ id, title: text })
			index += 1
			continue
		}

		if (line.startsWith('### ')) {
			blocks.push({ type: 'heading-3', text: line.replace(/^###\s+/, '') })
			index += 1
			continue
		}

		if (line.startsWith('* ')) {
			const items: string[] = []
			while (index < lines.length && lines[index].trim().startsWith('* ')) {
				items.push(lines[index].trim().replace(/^\*\s+/, ''))
				index += 1
			}
			blocks.push({ type: 'list', items })
			continue
		}

		const paragraphLines: string[] = []
		while (index < lines.length) {
			const paragraphLine = lines[index].trim()
			if (!paragraphLine || paragraphLine.startsWith('#') || paragraphLine.startsWith('* ')) break
			paragraphLines.push(paragraphLine)
			index += 1
		}
		blocks.push({ type: 'paragraph', lines: paragraphLines })
	}

	return { title, revision, blocks, sections }
}

const renderInline = (text: string, keyPrefix: string): ReactNode[] => {
	const tokens = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean)

	return tokens.map((token, index) => {
		const key = `${keyPrefix}-${index}`
		if (token.startsWith('**') && token.endsWith('**')) {
			return <strong key={key}>{renderInline(token.slice(2, -2), `${key}-strong`)}</strong>
		}

		const linkMatch = token.match(/^\[([^\]]+)]\(([^)]+)\)$/)
		if (linkMatch) {
			const [, label, href] = linkMatch
			const isExternal = href.startsWith('http')
			return (
				<a key={key} href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined}>
					{label}
				</a>
			)
		}

		return token
	})
}

const ThemeIcon = ({ isDarkMode }: { isDarkMode: boolean }) => isDarkMode ? (
	<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' aria-hidden='true'>
		<circle cx='12' cy='12' r='4' />
		<path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' />
	</svg>
) : (
	<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' aria-hidden='true'>
		<path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z' />
	</svg>
)

const LegalPage = ({ type, isDarkMode, onToggleTheme, logo }: LegalPageProps) => {
	const config = pageConfig[type]
	const [markdown, setMarkdown] = useState('')
	const [loadError, setLoadError] = useState(false)
	const parsedDocument = useMemo(() => parseDocument(markdown, config.fallbackTitle), [markdown, config.fallbackTitle])

	useEffect(() => {
		const controller = new AbortController()
		setMarkdown('')
		setLoadError(false)

		fetch(config.source, { signal: controller.signal })
			.then(response => {
				if (!response.ok) throw new Error(`Unable to load ${config.source}`)
				return response.text()
			})
			.then(setMarkdown)
			.catch(error => {
				if (error.name !== 'AbortError') setLoadError(true)
			})

		return () => controller.abort()
	}, [config.source])

	useEffect(() => {
		document.title = `${config.fallbackTitle} — VideoVault`
		window.scrollTo(0, 0)
	}, [config.fallbackTitle])

	return (
		<div className={`app legal-app ${isDarkMode ? 'dark' : 'light'}`} lang='ru'>
			<a className='skip-link' href='#legal-content'>Перейти к документу</a>
			<header className='legal-header'>
				<div className='container legal-header__inner'>
					<a className='legal-brand' href='/' aria-label='VideoVault — на главную'>
						<img src={logo} width='32' height='32' alt='' />
						<span>VideoVault</span>
					</a>
					<div className='legal-header__actions'>
						<a className='legal-back-link' href='/'>На главную</a>
						<button className='legal-theme-button' type='button' onClick={onToggleTheme} aria-label='Переключить тему'>
							<ThemeIcon isDarkMode={isDarkMode} />
						</button>
					</div>
				</div>
			</header>

			<main id='legal-content' className='legal-main'>
				<section className='legal-hero'>
					<div className='container legal-hero__inner'>
						<span className='legal-eyebrow'>{config.eyebrow}</span>
						<h1>{parsedDocument.title}</h1>
						<p>{config.description}</p>
						{parsedDocument.revision && <span className='legal-revision'>{parsedDocument.revision}</span>}
					</div>
				</section>

				<div className='container legal-layout'>
					{parsedDocument.sections.length > 0 && (
						<aside className='legal-toc'>
							<p className='legal-toc__title'>Содержание</p>
							<nav aria-label='Содержание документа'>
								{parsedDocument.sections.map(section => (
									<a key={section.id} href={`#${section.id}`}>{section.title}</a>
								))}
							</nav>
						</aside>
					)}

					<article className='legal-document'>
						{!markdown && !loadError && <p className='legal-state' role='status'>Загружаем документ…</p>}
						{loadError && <p className='legal-state legal-state--error' role='alert'>Не удалось загрузить документ. Пожалуйста, обновите страницу.</p>}
						{parsedDocument.blocks.map((block, blockIndex) => {
							if (block.type === 'heading-2') {
								return <h2 key={block.id} id={block.id}>{block.text}</h2>
							}
							if (block.type === 'heading-3') {
								return <h3 key={`heading-${blockIndex}`}>{block.text}</h3>
							}
							if (block.type === 'list') {
								return (
									<ul key={`list-${blockIndex}`}>
										{block.items?.map((item, itemIndex) => (
											<li key={`item-${blockIndex}-${itemIndex}`}>{renderInline(item, `item-${blockIndex}-${itemIndex}`)}</li>
										))}
									</ul>
								)
							}
							return (
								<p key={`paragraph-${blockIndex}`}>
									{block.lines?.map((line, lineIndex) => (
										<span key={`line-${blockIndex}-${lineIndex}`}>
											{renderInline(line, `line-${blockIndex}-${lineIndex}`)}
											{lineIndex < (block.lines?.length || 0) - 1 && <br />}
										</span>
									))}
								</p>
							)
						})}

						<nav className='legal-related' aria-label='Другие правовые документы'>
							<a className={type === 'privacy' ? 'is-current' : ''} href='/privacy'>Политика конфиденциальности</a>
							<a className={type === 'terms' ? 'is-current' : ''} href='/terms'>Пользовательское соглашение</a>
							<a className={type === 'cookies' ? 'is-current' : ''} href='/cookies'>Использование cookie</a>
						</nav>
					</article>
				</div>
			</main>

			<footer className='legal-footer'>
				<div className='container legal-footer__inner'>
					<p>© 2026 VideoVault</p>
					<div>
						<a href='/'>Главная</a>
						<button type='button' onClick={openCookieSettings}>Настройки cookie</button>
					</div>
				</div>
			</footer>
			<CookieConsent language='ru' />
		</div>
	)
}

export default LegalPage
