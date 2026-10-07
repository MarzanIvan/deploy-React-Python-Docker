import legalVersions from './generated/legalVersions.json'

export type ConsentEvent = 'legal_accepted' | 'cookies_accepted' | 'cookies_rejected'

/** "privacy: 20 июля 2026 года; consent: …" — какие редакции документов принял пользователь. */
const documentRevisions = Object.entries(legalVersions as Record<string, string>)
	.map(([doc, revision]) => `${doc}: ${revision}`)
	.join('; ')

const readVisitorId = (): string | null => {
	try {
		return window.localStorage.getItem('userId')
	} catch {
		return null
	}
}

/**
 * Записывает факт согласия в реестр (152-ФЗ). IP-адрес и браузер backend
 * определяет сам по запросу. Запись — «выстрелил и забыл»: сбой реестра
 * никогда не мешает пользоваться сайтом.
 */
export const recordConsent = (event: ConsentEvent, language: string) => {
	try {
		void fetch('/api/consent/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			keepalive: true,
			body: JSON.stringify({
				event,
				visitor_id: readVisitorId(),
				page_url: window.location.pathname,
				language,
				documents: documentRevisions,
			}),
		}).catch(() => undefined)
	} catch {
		// Older browsers without fetch/keepalive: the consent still applies locally.
	}
}
