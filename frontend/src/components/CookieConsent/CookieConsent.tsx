import { useCallback, useEffect, useRef, useState } from 'react'
import './CookieConsent.css'
import { recordConsent } from '../../consentRegistry'

type Language = 'en' | 'ru' | 'zh'
type CookieChoice = 'accepted' | 'rejected'

const COOKIE_CONSENT_KEY = 'videovault_cookie_consent'
const COOKIE_SETTINGS_EVENT = 'videovault:open-cookie-settings'

const copy: Record<Language, {
	title: string
	description: string
	essentialTitle: string
	essentialItems: string[]
	optionalTitle: string
	optionalText: string
	notice: string
	policy: string
	cookiePolicy: string
	accept: string
	reject: string
	rejectHint: string
	label: string
}> = {
	ru: {
		title: 'Мы используем файлы cookie',
		description: 'Чтобы продолжить работу с сервисом, выберите режим использования файлов cookie и аналогичных технологий хранения. Ваш выбор сохраняется и может быть изменен в любой момент.',
		essentialTitle: 'Обязательные технологии',
		essentialItems: [
			'сохранение выбранной темы оформления и языка',
			'сохранение вашего решения о cookie',
			'обеспечение безопасности и корректной работы интерфейса',
		],
		optionalTitle: 'Необязательные cookie',
		optionalText: 'Аналитические и статистические технологии применяются только после вашего согласия. При отказе сервис остается полностью работоспособным.',
		notice: 'Подробнее об обработке данных:',
		policy: 'Политика конфиденциальности',
		cookiePolicy: 'Использование cookie',
		accept: 'Принять все',
		reject: 'Отказаться',
		rejectHint: 'При отказе остаются только обязательные технологии, без которых сайт не работает.',
		label: 'Выбор режима использования файлов cookie',
	},
	en: {
		title: 'We use cookies',
		description: 'To continue using the service, choose how cookies and similar storage technologies are used. Your choice is saved and can be changed at any time.',
		essentialTitle: 'Essential technologies',
		essentialItems: [
			'storing your selected theme and language',
			'storing your cookie decision',
			'keeping the interface secure and working correctly',
		],
		optionalTitle: 'Optional cookies',
		optionalText: 'Analytics and statistics technologies are used only after your consent. If you decline, the service remains fully functional.',
		notice: 'More about data processing:',
		policy: 'Privacy Policy',
		cookiePolicy: 'Cookie Notice',
		accept: 'Accept all',
		reject: 'Reject',
		rejectHint: 'If you decline, only the essential technologies the site cannot run without are kept.',
		label: 'Cookie preferences',
	},
	zh: {
		title: '我们使用 Cookie',
		description: '要继续使用本服务，请选择 Cookie 及类似存储技术的使用方式。您的选择将被保存，并可随时更改。',
		essentialTitle: '必要技术',
		essentialItems: [
			'保存您选择的主题和语言',
			'保存您的 Cookie 选择',
			'保障界面的安全与正常运行',
		],
		optionalTitle: '可选 Cookie',
		optionalText: '分析和统计技术仅在您同意后使用。若您拒绝，服务仍可完整使用。',
		notice: '了解更多数据处理信息：',
		policy: '隐私政策',
		cookiePolicy: 'Cookie 说明',
		accept: '全部接受',
		reject: '拒绝',
		rejectHint: '若您拒绝，仅保留网站运行所必需的技术。',
		label: 'Cookie 设置',
	},
}

const readChoice = (): CookieChoice | null => {
	try {
		const savedChoice = window.localStorage.getItem(COOKIE_CONSENT_KEY)
		return savedChoice === 'accepted' || savedChoice === 'rejected' ? savedChoice : null
	} catch {
		return null
	}
}

export const openCookieSettings = () => {
	window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))
}

interface CookieConsentProps {
	language?: Language
}

/**
 * Blocking consent gate.
 *
 * The site stays unusable until the visitor makes an explicit choice, so no
 * optional storage can run before consent is given. The gate deliberately has
 * no dismiss control and ignores Escape — a choice is the only way out.
 *
 * The legal documents (/privacy, /consent, /terms, /cookies) are served as
 * separate static HTML pages that never mount this component, so a visitor can
 * always read the policies before deciding.
 */
const CookieConsent = ({ language = 'ru' }: CookieConsentProps) => {
	const [isVisible, setIsVisible] = useState(false)
	const dialogRef = useRef<HTMLDivElement>(null)
	const acceptRef = useRef<HTMLButtonElement>(null)
	const content = copy[language]

	useEffect(() => {
		setIsVisible(readChoice() === null)

		const handleOpenSettings = () => setIsVisible(true)
		window.addEventListener(COOKIE_SETTINGS_EVENT, handleOpenSettings)
		return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, handleOpenSettings)
	}, [])

	// Lock background scrolling while the gate is up.
	useEffect(() => {
		if (!isVisible) return

		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		acceptRef.current?.focus()

		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [isVisible])

	// Keep keyboard focus inside the dialog while it blocks the page.
	const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'Tab') return

		const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button')
		if (!focusable || focusable.length === 0) return

		const first = focusable[0]
		const last = focusable[focusable.length - 1]

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault()
			last.focus()
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault()
			first.focus()
		}
	}, [])

	const saveChoice = (choice: CookieChoice) => {
		try {
			window.localStorage.setItem(COOKIE_CONSENT_KEY, choice)
		} catch {
			// The choice still applies for the current page when storage is unavailable.
		}
		setIsVisible(false)
		window.dispatchEvent(new CustomEvent('videovault:cookie-consent', { detail: choice }))
		recordConsent(choice === 'accepted' ? 'cookies_accepted' : 'cookies_rejected', language)
	}

	if (!isVisible) return null

	return (
		<div className='cookie-gate' role='presentation'>
			<div
				className='cookie-gate__dialog'
				role='dialog'
				aria-modal='true'
				aria-labelledby='cookie-gate-title'
				aria-describedby='cookie-gate-description'
				aria-label={content.label}
				ref={dialogRef}
				onKeyDown={handleKeyDown}
			>
				<div className='cookie-gate__icon' aria-hidden='true'>
					<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7'>
						<path d='M20.6 13.4A8.8 8.8 0 1 1 10.6 3.2a3.4 3.4 0 0 0 4.2 4.2 3.4 3.4 0 0 0 5.8 6Z' />
						<circle cx='8.5' cy='11' r='.8' fill='currentColor' stroke='none' />
						<circle cx='12' cy='16' r='.8' fill='currentColor' stroke='none' />
						<circle cx='6.5' cy='15.5' r='.65' fill='currentColor' stroke='none' />
					</svg>
				</div>

				<h2 id='cookie-gate-title'>{content.title}</h2>
				<p id='cookie-gate-description'>{content.description}</p>

				<div className='cookie-gate__section'>
					<h3>{content.essentialTitle}</h3>
					<ul>
						{content.essentialItems.map(item => <li key={item}>{item}</li>)}
					</ul>
				</div>

				<div className='cookie-gate__section'>
					<h3>{content.optionalTitle}</h3>
					<p>{content.optionalText}</p>
				</div>

				<p className='cookie-gate__links'>
					{content.notice}{' '}
					<a href='/privacy'>{content.policy}</a>
					{' · '}
					<a href='/cookies'>{content.cookiePolicy}</a>
				</p>

				{/* Accept and reject carry equal visual weight: a decline that is
				    harder to find than consent is not freely given consent. */}
				<div className='cookie-gate__actions'>
					<button
						type='button'
						className='cookie-gate__button cookie-gate__button--secondary'
						onClick={() => saveChoice('rejected')}
					>
						{content.reject}
					</button>
					<button
						type='button'
						className='cookie-gate__button cookie-gate__button--primary'
						onClick={() => saveChoice('accepted')}
						ref={acceptRef}
					>
						{content.accept}
					</button>
				</div>

				<p className='cookie-gate__hint'>{content.rejectHint}</p>
			</div>
		</div>
	)
}

export default CookieConsent
