import { useEffect, useState } from 'react'
import './CookieConsent.css'

type Language = 'en' | 'ru' | 'zh'
type CookieChoice = 'accepted' | 'rejected'

const COOKIE_CONSENT_KEY = 'videovault_cookie_consent'
const COOKIE_SETTINGS_EVENT = 'videovault:open-cookie-settings'

const copy: Record<Language, {
	title: string
	description: string
	details: string
	accept: string
	reject: string
	label: string
}> = {
	ru: {
		title: 'Использование cookie',
		description: 'Мы используем обязательное локальное хранение для темы и вашего выбора. Необязательные cookie применяются только с вашего согласия.',
		details: 'Подробнее',
		accept: 'Согласиться',
		reject: 'Отказаться',
		label: 'Уведомление об использовании cookie',
	},
	en: {
		title: 'Cookie preferences',
		description: 'We use essential local storage for your theme and consent choice. Optional cookies are used only with your permission.',
		details: 'Learn more',
		accept: 'Accept',
		reject: 'Reject',
		label: 'Cookie usage notice',
	},
	zh: {
		title: 'Cookie 设置',
		description: '我们使用必要的本地存储来保存主题和您的选择。只有在您同意后才会使用可选 Cookie。',
		details: '了解详情',
		accept: '同意',
		reject: '拒绝',
		label: 'Cookie 使用通知',
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

const CookieConsent = ({ language = 'ru' }: CookieConsentProps) => {
	const [isVisible, setIsVisible] = useState(false)
	const content = copy[language]

	useEffect(() => {
		setIsVisible(readChoice() === null)

		const handleOpenSettings = () => setIsVisible(true)
		window.addEventListener(COOKIE_SETTINGS_EVENT, handleOpenSettings)
		return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, handleOpenSettings)
	}, [])

	const saveChoice = (choice: CookieChoice) => {
		try {
			window.localStorage.setItem(COOKIE_CONSENT_KEY, choice)
		} catch {
			// The choice still applies for the current page when storage is unavailable.
		}
		setIsVisible(false)
		window.dispatchEvent(new CustomEvent('videovault:cookie-consent', { detail: choice }))
	}

	if (!isVisible) return null

	return (
		<section className='cookie-consent' aria-label={content.label} aria-live='polite'>
			<div className='cookie-consent__copy'>
				<div className='cookie-consent__icon' aria-hidden='true'>
					<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7'>
						<path d='M20.6 13.4A8.8 8.8 0 1 1 10.6 3.2a3.4 3.4 0 0 0 4.2 4.2 3.4 3.4 0 0 0 5.8 6Z' />
						<circle cx='8.5' cy='11' r='.8' fill='currentColor' stroke='none' />
						<circle cx='12' cy='16' r='.8' fill='currentColor' stroke='none' />
						<circle cx='6.5' cy='15.5' r='.65' fill='currentColor' stroke='none' />
					</svg>
				</div>
				<div>
					<h2>{content.title}</h2>
					<p>
						{content.description}{' '}
						<a href='/cookies'>{content.details}</a>
					</p>
				</div>
			</div>
			<div className='cookie-consent__actions'>
				<button type='button' className='cookie-consent__button cookie-consent__button--secondary' onClick={() => saveChoice('rejected')}>
					{content.reject}
				</button>
				<button type='button' className='cookie-consent__button cookie-consent__button--primary' onClick={() => saveChoice('accepted')}>
					{content.accept}
				</button>
			</div>
		</section>
	)
}

export default CookieConsent
