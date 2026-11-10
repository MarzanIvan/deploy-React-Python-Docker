import { useMemo, useState } from 'react'
import { Lang, PLATFORM_LABEL, Platform } from '../../platforms'
import './MediaCard.css'

export interface MediaFormat {
	format_id: string
	quality: string
	ext: string
	resolution: number | string
	vcodec: string
	type: string
	height?: number | null
	fps?: number | null
	filesize?: number | null
	has_audio?: boolean
}

export interface MediaItem {
	index: number
	type: 'image' | 'video'
	url: string
	ext: string
	thumbnail: string
	width?: number | null
	height?: number | null
}

export interface MediaInfo {
	platform: Platform
	kind: 'video' | 'carousel' | 'image'
	title: string
	description: string
	thumbnail: string | null
	uploader: string | null
	duration: number | null
	tags: string[]
	formats: MediaFormat[]
	items: MediaItem[]
}

interface Props {
	info: MediaInfo
	language: Lang
	busy: boolean
	onDownloadFormat: (formatId: string, audioOnly: boolean) => void
}

const TEXT: Record<Lang, Record<string, string>> = {
	en: {
		quality: 'Video quality', audio: 'Audio only', materials: 'Materials',
		downloadSelected: 'Download selected', downloadAll: 'Download all',
		download: 'Download', more: 'Show more', less: 'Show less', photo: 'Photo', video: 'Video',
		noFormats: 'No downloadable formats found', selectAll: 'Select all', clear: 'Clear',
		zipHint: 'Several files are saved as one ZIP archive', by: 'by',
	},
	ru: {
		quality: 'Качество видео', audio: 'Только аудио', materials: 'Материалы',
		downloadSelected: 'Скачать выбранные', downloadAll: 'Скачать все',
		download: 'Скачать', more: 'Показать полностью', less: 'Свернуть', photo: 'Фото', video: 'Видео',
		noFormats: 'Нет доступных для скачивания форматов', selectAll: 'Выбрать все', clear: 'Сбросить',
		zipHint: 'Несколько файлов сохраняются одним ZIP-архивом', by: 'автор',
	},
	zh: {
		quality: '视频画质', audio: '仅音频', materials: '素材',
		downloadSelected: '下载所选', downloadAll: '全部下载',
		download: '下载', more: '展开', less: '收起', photo: '图片', video: '视频',
		noFormats: '没有可下载的格式', selectAll: '全选', clear: '清除',
		zipHint: '多个文件将打包为一个 ZIP', by: '作者',
	},
}

const proxied = (url: string, extra = '') => `/api/media/proxy?u=${encodeURIComponent(url)}${extra}`

const slug = (value: string) =>
	(value || 'instagram').replace(/[^0-9A-Za-zА-Яа-яЁё]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'instagram'

const formatDuration = (seconds: number | null) => {
	if (!seconds) return ''
	const m = Math.floor(seconds / 60)
	const s = Math.round(seconds % 60)
	return `${m}:${String(s).padStart(2, '0')}`
}

const formatSize = (bytes?: number | null) => {
	if (!bytes) return ''
	const mb = bytes / (1024 * 1024)
	return mb >= 1 ? `${mb.toFixed(mb >= 100 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const triggerDownload = (href: string) => {
	const a = document.createElement('a')
	a.href = href
	a.download = ''
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
}

/** POST-форма вместо fetch: браузер сам сохранит ZIP по Content-Disposition. */
const postZip = (urls: string[], name: string) => {
	const form = document.createElement('form')
	form.method = 'POST'
	form.action = '/api/media/zip'
	form.style.display = 'none'
	const add = (key: string, value: string) => {
		const input = document.createElement('input')
		input.type = 'hidden'
		input.name = key
		input.value = value
		form.appendChild(input)
	}
	urls.forEach(u => add('urls', u))
	add('name', name)
	document.body.appendChild(form)
	form.submit()
	document.body.removeChild(form)
}

const DownloadIcon = () => (
	<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
		<path d='M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14' />
	</svg>
)

const MediaCard = ({ info, language, busy, onDownloadFormat }: Props) => {
	const t = TEXT[language]
	const [expanded, setExpanded] = useState(false)
	const [selected, setSelected] = useState<Set<number>>(new Set())

	const baseName = slug(info.uploader || info.title)

	// Одно качество на каждую высоту/fps: форматы уже отсортированы от лучшего к худшему.
	const videoQualities = useMemo(() => {
		const seen = new Set<string>()
		return info.formats.filter(f => {
			if (f.type !== 'Video') return false
			const key = `${f.height || f.resolution}-${f.fps || ''}`
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
	}, [info.formats])

	const audioFormat = info.formats.find(f => f.type === 'Audio') || videoQualities[0]
	const description = info.description || ''
	const isLong = description.length > 220 || description.split('\n').length > 4

	const toggle = (index: number) =>
		setSelected(prev => {
			const next = new Set(prev)
			if (next.has(index)) next.delete(index)
			else next.add(index)
			return next
		})

	const downloadItems = (items: MediaItem[]) => {
		if (items.length === 0) return
		if (items.length === 1) {
			const item = items[0]
			triggerDownload(proxied(item.url, `&download=true&name=${encodeURIComponent(`${baseName}_${item.index}`)}`))
		} else {
			postZip(items.map(i => i.url), baseName)
		}
	}

	const chosen = info.items.filter(i => selected.has(i.index))

	return (
		<article className='media-card'>
			<div className='media-head'>
				{info.thumbnail && (
					<div className='media-cover'>
						<img src={proxied(info.thumbnail)} alt='' referrerPolicy='no-referrer' loading='lazy' />
						{info.duration ? <span className='media-duration'>{formatDuration(info.duration)}</span> : null}
					</div>
				)}
				<div className='media-meta'>
					<span className='media-platform'>{PLATFORM_LABEL[info.platform]}</span>
					<h3 className='media-title'>{info.title}</h3>
					{info.uploader && <p className='media-author'>{t.by} @{info.uploader}</p>}
				</div>
			</div>

			{description && (
				<div className='media-description'>
					<p className={expanded ? 'is-open' : ''}>{description}</p>
					{isLong && (
						<button type='button' className='media-link' onClick={() => setExpanded(v => !v)}>
							{expanded ? t.less : t.more}
						</button>
					)}
				</div>
			)}

			{info.tags.length > 0 && (
				<ul className='media-tags'>
					{info.tags.map(tag => <li key={tag}>#{tag}</li>)}
				</ul>
			)}

			{info.items.length > 0 && (
				<section className='media-section'>
					<div className='media-section-head'>
						<h4>{t.materials} · {info.items.length}</h4>
						<div className='media-section-actions'>
							<button type='button' className='media-link'
								onClick={() => setSelected(new Set(info.items.map(i => i.index)))}>
								{t.selectAll}
							</button>
							{selected.size > 0 && (
								<button type='button' className='media-link' onClick={() => setSelected(new Set())}>
									{t.clear}
								</button>
							)}
						</div>
					</div>

					<ul className='media-grid'>
						{info.items.map(item => {
							const isOn = selected.has(item.index)
							return (
								<li key={item.index} className={`media-tile${isOn ? ' is-selected' : ''}`}>
									<button type='button' className='media-tile-pick' onClick={() => toggle(item.index)}
										aria-pressed={isOn}
										aria-label={`${item.type === 'video' ? t.video : t.photo} ${item.index}`}>
										<img src={proxied(item.thumbnail)} alt='' referrerPolicy='no-referrer' loading='lazy' />
										<span className='media-check' aria-hidden='true'>{isOn ? '✓' : ''}</span>
										<span className='media-kind'>{item.type === 'video' ? t.video : t.photo}</span>
									</button>
									<button type='button' className='media-tile-download' onClick={() => downloadItems([item])}
										aria-label={`${t.download} ${item.index}`}>
										<DownloadIcon />
									</button>
								</li>
							)
						})}
					</ul>

					<div className='media-actions'>
						<button type='button' className='media-btn media-btn-primary' disabled={chosen.length === 0}
							onClick={() => downloadItems(chosen)}>
							<DownloadIcon /> {t.downloadSelected}{chosen.length ? ` (${chosen.length})` : ''}
						</button>
						<button type='button' className='media-btn' onClick={() => downloadItems(info.items)}>
							<DownloadIcon /> {t.downloadAll}
						</button>
					</div>
					{info.items.length > 1 && <p className='media-hint'>{t.zipHint}</p>}
				</section>
			)}

			{info.items.length === 0 && info.formats.length === 0 && (
				<p className='media-hint'>{t.noFormats}</p>
			)}

			{videoQualities.length > 0 && (
				<section className='media-section'>
					<div className='media-section-head'><h4>{t.quality}</h4></div>
					<ul className='media-qualities'>
						{videoQualities.map(f => (
							<li key={f.format_id}>
								<button type='button' className='media-quality' disabled={busy}
									onClick={() => onDownloadFormat(f.format_id, false)}>
									<strong>{f.height ? `${f.height}p` : f.quality}{f.fps && f.fps > 30 ? ` ${Math.round(f.fps)}` : ''}</strong>
									<span>{f.ext?.toUpperCase()}{f.filesize ? ` · ${formatSize(f.filesize)}` : ''}</span>
								</button>
							</li>
						))}
						{audioFormat && (
							<li>
								<button type='button' className='media-quality media-quality-audio' disabled={busy}
									onClick={() => onDownloadFormat(audioFormat.format_id, true)}>
									<strong>MP3</strong>
									<span>{t.audio}</span>
								</button>
							</li>
						)}
					</ul>
				</section>
			)}
		</article>
	)
}

export default MediaCard
