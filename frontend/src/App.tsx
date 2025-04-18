import axios from 'axios'
import {useEffect, useState} from 'react'
import {AiOutlineClose} from 'react-icons/ai'
import {BsMoonFill} from 'react-icons/bs'
import {MdSunny} from 'react-icons/md'
import {ToastContainer, toast} from 'react-toastify'
import LanguageSwitcher from './components/languageSwitcher/LanguageSwitcher'
import OnlineCounter from './components/OnlineCounter/OnlineCounter'
import VideoPlayerInstructions from './components/VideoPlayerInstructions/VideoPlayerInstructions'
import './index.css'
import vvlogo from './logo.svg'
import logoWhite from './logo-white.svg'
import logoBlack from './logo-black.svg'


interface Translations {
	title: string
	enterUrl: string
	fetchVideoInfo: string
	selectVideoFormat: string
	selectFormat: string
	download: string
	downloading: string
	cancel: string
	downloadComplete: string
	refresh: string
	downloadAudio: string
	features?: string
	about?: string
	contact?: string
	instructions?: string
	whyChoose?: string
	feature1?: string
	feature2?: string
	feature3?: string
	aboutTitle?: string
	aboutText?: string
	contactText?: string
	copyright?: string
}

const translations: Record<string, Translations> = {
	en: {
		title: 'Video Downloader',
		enterUrl: 'Enter video URL',
		fetchVideoInfo: 'Fetch Video Info',
		selectVideoFormat: 'Select Video Format:',
		selectFormat: 'Select Format',
		download: 'Download',
		downloading: 'Downloading...',
		cancel: 'Cancel',
		downloadComplete: 'Thank you for using our service! Download complete.',
		refresh: 'Refresh page',
		downloadAudio: 'Download audio file separately?',
		features: 'Features',
		about: 'About',
		contact: 'Contact',
		instructions: 'Instructions',
		whyChoose: 'Why choose VideoVault?',
		feature1: 'Fast and secure downloads',
		feature2: 'Supports multiple formats',
		feature3: 'User-friendly interface',
		aboutTitle: 'About VideoVault',
		aboutText: 'VideoVault is the ultimate tool for downloading videos.',
		contactText: 'Have questions? Reach out to us at ',
		copyright: '© 2025 VideoVault. All rights reserved.',
	},
	ru: {
		title: 'Скачиватель Видео',
		enterUrl: 'Введите URL видео',
		fetchVideoInfo: 'Получить информацию о видео',
		selectVideoFormat: 'Выберите формат видео:',
		selectFormat: 'Выберите формат',
		download: 'Скачать',
		downloading: 'Скачивание...',
		cancel: 'Отмена',
		downloadComplete:
			'Спасибо, что воспользовались нашим сервисом! Загрузка завершена.',
		refresh: 'Обновить страницу',
		downloadAudio: 'Скачать аудиофайл отдельно?',
		features: 'Функции',
		about: 'О нас',
		contact: 'Контакты',
		instructions: 'Инструкции',
		whyChoose: 'Почему выбирают VideoVault?',
		feature1: 'Быстрая и безопасная загрузка',
		feature2: 'Поддержка множества форматов',
		feature3: 'Удобный интерфейс',
		aboutTitle: 'О VideoVault',
		aboutText: 'VideoVault - лучший инструмент для скачивания видео.',
		contactText: 'Есть вопросы? Обращайтесь к нам по адресу  ',
		copyright: '© 2025 VideoVault. Все права защищены.',
	},
	zh: {
		title: '视频下载器',
		enterUrl: '输入视频网址',
		fetchVideoInfo: '获取视频信息',
		selectVideoFormat: '选择视频格式:',
		selectFormat: '选择格式',
		download: '下载',
		downloading: '下载中...',
		cancel: '取消',
		downloadComplete: '感谢使用我们的服务！下载完成。',
		refresh: '刷新页面',
		downloadAudio: '单独下载音频文件？',
		features: '功能',
		about: '关于',
		contact: '联系方式',
		instructions: '指示',
		whyChoose: '为什么选择 VideoVault？',
		feature1: '快速安全的下载',
		feature2: '支持多种格式',
		feature3: '用户友好的界面',
		aboutTitle: '关于 VideoVault',
		aboutText: 'VideoVault 是终极视频下载工具。',
		contactText: '有问题吗？随时通过 与我们联系。',
		copyright: '© 2025 VideoVault。版权所有。',
	},
}

interface VideoFormat {
	format_id: string
	quality: string
	ext: string
	resolution: number | string
	vcodec: string
	type: string
}

interface VideoInfo {
	title: string
	formats: VideoFormat[]
}

const App = () => {
	const [showAd, setShowAd] = useState<boolean>(true)
	const [url, setUrl] = useState<string>('')
	const [videoFormatId, setVideoFormatId] = useState<string>('')
	const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
	const [progress, setProgress] = useState<number>(0)
	const [message, setMessage] = useState<string>('')
	const [loading, setLoading] = useState<boolean>(false)
	const [completed, setCompleted] = useState<boolean>(false)
	const [isDarkMode, setIsDarkMode] = useState<boolean>(false)
	const [downloadAudio, setDownloadAudio] = useState<boolean>(false)
	const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)

	const [language, setLanguage] = useState<'en' | 'ru' | 'zh'>('en')

	// Function to change the language
	const handleLanguageChange = (selectedLanguage: 'en' | 'ru' | 'zh') => {
		setLanguage(selectedLanguage)
	}
	const t = translations[language]

	useEffect(() => {
		const dismissed = localStorage.getItem('adDismissed')
		if (dismissed) setShowAd(false)
		const savedTheme = localStorage.getItem('theme')
		if (savedTheme === 'dark') {
			setIsDarkMode(true)
			document.body.classList.add('dark-theme')
		}
	}, [])

	const closeAd = (): void => {
		setShowAd(false)
		localStorage.setItem('adDismissed', 'true')
	}

	const toggleTheme = () => {
		setIsDarkMode(prevMode => {
			const newMode = !prevMode
			if (newMode) {
				localStorage.setItem('theme', 'dark')
			} else {
				localStorage.setItem('theme', 'light')
			}
			document.body.classList.toggle('dark-theme', newMode)
			return newMode
		})
	}

	const toggleMenu = () => {
		setIsMenuOpen(prev => !prev)
	}

	const fetchVideoInfo = async () => {
		try {
			const response = await axios.post(
				'/api/get_video_info/',
				new URLSearchParams({url})
			)
			const data = response.data

			setVideoInfo(data)
			toast.success('Successfully fetched video info.')
		} catch (error) {
			toast.error('Error fetching video info.')
		}
	}

	const handleDownload = async () => {
		if (!videoFormatId) {
			toast.error('Please select a video format.')
			return
		}

		try {
			setLoading(true)
			setCompleted(false)
			await axios.post(
				'/api/download_video/',
				new URLSearchParams({
					url,
					video_format_id: videoFormatId,
					download_audio: downloadAudio.toString(),
				})
			)

			setProgress(0)
			setMessage('Download started...')
			toast.info('Please wait while your video is being downloaded.')

			// Подключаемся к WebSocket для получения обновлений прогресса
			const socket = new WebSocket('ws:///api/ws/progress/')

			socket.onmessage = function (event) {
				const data = JSON.parse(event.data)
				setProgress(data.progress)
				setMessage(`${data.message} (${data.progress.toFixed(2)}%)`)

				if (data.progress >= 100 || data.completed) {
					socket.close()
					setLoading(false)
					setCompleted(true)
					toast.success(t.downloadComplete)
				} else if (data.progress === -1) {
					socket.close()
					setLoading(false)
					toast.error('Download error. Please try a different format.')
				}
			}

			socket.onerror = function (error) {
				socket.close()
				setLoading(false)
				toast.error('WebSocket error. Please try again.')
			}
		} catch (error) {
			setLoading(false)
			toast.error('Error during download. Please try a different format.')
		}
	}

	const cancelDownload = () => {
		setLoading(false)
		setProgress(0)
		setMessage('Download canceled.')
		toast.info('Download canceled.')
	}

	return (
		<div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
			{showAd && (
				<div className='ad-banner'>
					<div className='ad-content'>
						<span>🎁 Специальное предложение — скидка 30% на премиум!</span>
						<a href='https://example.com' target='_blank' rel='noopener noreferrer'>
							Подробнее
						</a>
					</div>
					<button className='ad-close-button' onClick={closeAd} aria-label='Закрыть рекламу'>
						<AiOutlineClose />
					</button>
				</div>
			)}
			<header className='header'>
				<div className='container header-content'>
					<div className='header-left'>
						<img src={isDarkMode ? logoBlack  : logoWhite} width="64" height="64" alt="logotype"/>
					</div>
					<button
						id='menu-button'
						className='menu-button'
						aria-label='Menu'
						aria-expanded={isMenuOpen}
						onClick={toggleMenu}
					>
						{isMenuOpen ? (
							<AiOutlineClose/>
						) : (
							<span className='menu-icon'></span>
						)}
					</button>
					<nav className={`nav ${isMenuOpen ? 'show' : ''}`} id='nav-menu'>
						<ul className='nav-list'>
							<li>
								<a href='#features' className='nav-link'>
									{t.features}
								</a>
							</li>
							<li>
								<a href='#about' className='nav-link'>
									{t.about}
								</a>
							</li>
							<li>
								<a href='#contact' className='nav-link'>
									{t.contact}
								</a>
							</li>
							<li>
								<a href='#instructions' className='nav-link'>
									{t.instructions}
								</a>
							</li>
							<div className='settings'>
								<div className='theme-toggle'>
									<button
										id='theme-button'
										className='theme-button'
										onClick={toggleTheme}
									>
										{isDarkMode ? <BsMoonFill/> : <MdSunny/>}
									</button>
								</div>
								<LanguageSwitcher
									currentLanguage={language}
									onLanguageChange={handleLanguageChange}
								/>
								<OnlineCounter/>
							</div>
						</ul>
					</nav>
				</div>
			</header>

			<main className='main-content'>
				<div className='content-box'>
					<h4 className='title'>{t.title}</h4>

					<input
						type='text'
						className='input-field'
						placeholder={t.enterUrl}
						value={url}
						onChange={e => setUrl(e.target.value)}
					/>

					<button
						className='primary-button'
						onClick={fetchVideoInfo}
						disabled={!url}
					>
						{t.fetchVideoInfo}
					</button>

					{videoInfo && (
						<div>
							<h6 className='subtitle'>{videoInfo.title}</h6>
							<h6 className='subtitle'>{t.selectVideoFormat}</h6>
							<select
								className='select-field'
								value={videoFormatId}
								onChange={e => setVideoFormatId(e.target.value)}
							>
								<option value=''>{t.selectFormat}</option>
								{videoInfo.formats.map((format: VideoFormat) => (
									<option key={format.format_id} value={format.format_id}>
										{format.quality} ({format.ext}) - {format.resolution}p -{' '}
										{format.type}
									</option>
								))}
							</select>

							<label className='checkbox-container'>
								<input
									type='checkbox'
									checked={downloadAudio}
									onChange={() => setDownloadAudio(!downloadAudio)}
								/>
								{t.downloadAudio}
							</label>

							<button
								className='primary-button'
								onClick={handleDownload}
								disabled={loading}
							>
								{loading ? t.downloading : t.download}
							</button>
							<button
								className='secondary-button'
								onClick={cancelDownload}
								disabled={!loading}
							>
								{t.cancel}
							</button>
						</div>
					)}

					{loading && (
						<div className='progress-container'>
							<div
								className='progress-bar'
								style={{width: `${progress}%`}}
							></div>
							<p>{message}</p>
						</div>
					)}
					{completed && (
						<div className='snackbar'>
							<div className='alert-success'>{t.downloadComplete}</div>
						</div>
					)}

					<ToastContainer/>

					<button
						className='primary-button'
						onClick={() => window.location.reload()}
					>
						{t.refresh}
					</button>
				</div>

				<section id='instructions'>
					<VideoPlayerInstructions language={language}/>
				</section>
				<section id='features' className='features'>
					<div className='container'>
						<h3 className='section-title'>{t.whyChoose}</h3>
						<ul className='features-list'>
							<li>{t.feature1}</li>
							<li>{t.feature2}</li>
							<li>{t.feature3}</li>
						</ul>
					</div>
				</section>

				<section id='about' className='about'>
					<div className='container'>
						<h3 className='section-title'>{t.aboutTitle}</h3>
						<p>{t.aboutText}</p>
					</div>
				</section>

				<section id='contact' className='contact'>
					<div className='container'>
						<h3 className='section-title'>{t.contact}</h3>
						<p>
							{t.contactText}
							<a href='mailto:helpvideovault@gmail.com'>
								helpvideovault@gmail.com
							</a>
						</p>
						<br/>
						<p>
							{t.contactText}
							<a
								href='https://t.me/IT_juniorMy'
								target='_blank'
								rel='noopener noreferrer'
							>
								Telegram
							</a>
						</p>
					</div>
				</section>
			</main>

			<footer className='footer'>
				<div className='container'>
					<p>{t.copyright}</p>
				</div>
			</footer>
		</div>
	)
}

export default App
