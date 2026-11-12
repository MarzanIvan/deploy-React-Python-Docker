export type Platform = 'youtube' | 'instagram' | 'other'
export type Lang = 'en' | 'ru' | 'zh'

const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com']
const INSTAGRAM_HOSTS = ['instagram.com', 'instagr.am']

const hostMatches = (host: string, list: string[]) =>
	list.some(domain => host === domain || host.endsWith('.' + domain))

const parseHost = (raw: string): { host: string; path: string } | null => {
	const value = raw.trim()
	if (!value || /\s/.test(value)) return null
	try {
		const parsed = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`)
		return { host: parsed.hostname.toLowerCase(), path: parsed.pathname }
	} catch {
		return null
	}
}

export type UrlKind = 'reel' | 'post' | 'tv' | 'stories' | 'video' | null

export interface DetectedUrl {
	platform: Platform
	kind: UrlKind
}

/** Определяет платформу и тип материала по ссылке — ещё до запроса к серверу. */
export const detectUrl = (raw: string): DetectedUrl | null => {
	const parsed = parseHost(raw)
	if (!parsed || !parsed.host.includes('.')) return null
	const { host, path } = parsed

	if (hostMatches(host, INSTAGRAM_HOSTS)) {
		let kind: UrlKind = null
		if (/\/reels?\//.test(path)) kind = 'reel'
		else if (/\/p\//.test(path)) kind = 'post'
		else if (/\/tv\//.test(path)) kind = 'tv'
		else if (/\/stories\//.test(path)) kind = 'stories'
		return { platform: 'instagram', kind }
	}
	if (hostMatches(host, YOUTUBE_HOSTS)) {
		return { platform: 'youtube', kind: 'video' }
	}
	return { platform: 'other', kind: null }
}

export const PLATFORM_LABEL: Record<Platform, string> = {
	youtube: 'YouTube',
	instagram: 'Instagram',
	other: '',
}

export const KIND_LABEL: Record<Lang, Record<Exclude<UrlKind, null>, string>> = {
	en: { reel: 'Reel', post: 'Post', tv: 'IGTV', stories: 'Story', video: 'Video' },
	ru: { reel: 'Рилс', post: 'Пост', tv: 'IGTV', stories: 'История', video: 'Видео' },
	zh: { reel: 'Reels', post: '帖子', tv: 'IGTV', stories: '快拍', video: '视频' },
}

export const PLATFORM_TEXT: Record<Lang, {
	supported: string
	unknown: string
	storiesUnsupported: string
}> = {
	en: {
		supported: 'Supported platforms',
		unknown: 'Platform not recognized — we will still try to fetch the link',
		storiesUnsupported: 'Stories are not supported yet — use a post or Reel link',
	},
	ru: {
		supported: 'Поддерживаемые платформы',
		unknown: 'Платформа не распознана — всё равно попробуем получить ссылку',
		storiesUnsupported: 'Истории пока не поддерживаются — вставьте ссылку на пост или рилс',
	},
	zh: {
		supported: '支持的平台',
		unknown: '未识别平台，仍会尝试解析该链接',
		storiesUnsupported: '暂不支持快拍，请使用帖子或 Reels 链接',
	},
}
