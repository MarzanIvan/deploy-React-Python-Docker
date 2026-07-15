import axios from 'axios'
import {useEffect, useState, useRef} from 'react'
import {ToastContainer, toast} from 'react-toastify'
import LanguageSwitcher from './components/languageSwitcher/LanguageSwitcher'
import OnlineCounter from './components/OnlineCounter/OnlineCounter'
import VideoPlayerInstructions from './components/VideoPlayerInstructions/VideoPlayerInstructions'
import PathnerInstructions from './components/PartnersBlock/PathnerInstructions'
import DonatePay from './components/DonatePay/DonatePay'
import SpecularButton from './components/SpecularButton/SpecularButton'
import DotGrid from './components/DotGrid/DotGrid'
import BentoFeatures from './components/BentoFeatures/BentoFeatures'
import logoWhite from './logo-white.svg'
import logoBlack from './logo-black.svg'
import AdModal from './AdModal'

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
	feature1desc?: string
	feature2?: string
	feature2desc?: string
	feature3?: string
	feature3desc?: string
	aboutTitle?: string
	aboutText?: string
	contactText?: string
	copyright?: string
	heroSubtitle?: string
	footerTagline?: string
	footerNav?: string
	footerSupport?: string
	footerLegal?: string
	privacyPolicy?: string
	termsOfService?: string
	faq?: string
	status?: string
	heroBadge?: string
	trust1?: string
	trust2?: string
	trust3?: string
}

const translations: Record<string, Translations> = {
	en: {
		title: 'Download any video',
		heroSubtitle: 'Paste a link, pick the format, and save the file to your device. Fast, private, and reliable.',
		enterUrl: 'Paste video URL here...',
		fetchVideoInfo: 'Get video info',
		selectVideoFormat: 'Select format:',
		selectFormat: 'Choose quality and format',
		download: 'Download',
		downloading: 'Processing...',
		cancel: 'Cancel',
		downloadComplete: 'Download complete. The file has been saved to your device.',
		refresh: 'Start new download',
		downloadAudio: 'Extract audio only (MP3)',
		features: 'Features',
		about: 'About',
		contact: 'Contact',
		instructions: 'Help',
		whyChoose: 'Why VideoVault',
		feature1: 'Fast and secure',
		feature1desc: 'Server-side processing with encrypted transfers. Your data stays private.',
		feature2: 'Multiple formats',
		feature2desc: 'Support for MP4, WebM, MP3 and more. Choose the quality you need.',
		feature3: 'No registration',
		feature3desc: 'No accounts, no tracking. Paste a link and download instantly.',
		aboutTitle: 'About VideoVault',
		aboutText: 'VideoVault is a free service for downloading videos from popular platforms. Built and maintained by an independent developer, the project focuses on speed, reliability, and user privacy.',
		contactText: 'Questions or feedback? Reach out:',
		copyright: '© 2025 VideoVault. All rights reserved.',
		footerTagline: 'Free video downloader built for speed, privacy, and reliability.',
		footerNav: 'Navigation',
		footerSupport: 'Support',
		footerLegal: 'Legal',
		privacyPolicy: 'Privacy Policy',
		termsOfService: 'Terms of Service',
		faq: 'FAQ',
		status: 'Status',
		heroBadge: 'Online now · No VPN required',
		trust1: 'No registration',
		trust2: 'MP4 · MP3 · up to 4K',
		trust3: '100% Free',
	},
	ru: {
		title: 'Скачивайте любое видео',
		heroSubtitle: 'Вставьте ссылку, выберите формат и сохраните файл на устройство. Быстро, приватно и надёжно.',
		enterUrl: 'Вставьте ссылку на видео...',
		fetchVideoInfo: 'Получить информацию',
		selectVideoFormat: 'Выберите формат:',
		selectFormat: 'Качество и формат',
		download: 'Скачать',
		downloading: 'Обработка...',
		cancel: 'Отмена',
		downloadComplete: 'Загрузка завершена. Файл сохранён на ваше устройство.',
		refresh: 'Новая загрузка',
		downloadAudio: 'Только аудио (MP3)',
		features: 'Возможности',
		about: 'О сервисе',
		contact: 'Контакты',
		instructions: 'Помощь',
		whyChoose: 'Почему VideoVault',
		feature1: 'Быстро и безопасно',
		feature1desc: 'Серверная обработка с шифрованием. Ваши данные остаются приватными.',
		feature2: 'Множество форматов',
		feature2desc: 'Поддержка MP4, WebM, MP3 и других. Выбирайте нужное качество.',
		feature3: 'Без регистрации',
		feature3desc: 'Без аккаунтов, без трекинга. Вставьте ссылку и скачайте.',
		aboutTitle: 'О VideoVault',
		aboutText: 'VideoVault — бесплатный сервис для скачивания видео с популярных платформ. Проект создан и поддерживается независимым разработчиком. Фокус на скорости, надёжности и приватности пользователей.',
		contactText: 'Вопросы или предложения? Свяжитесь с нами:',
		copyright: '© 2025 VideoVault. Все права защищены.',
		footerTagline: 'Бесплатный загрузчик видео. Скорость, приватность, надёжность.',
		footerNav: 'Навигация',
		footerSupport: 'Поддержка',
		footerLegal: 'Правовая информация',
		privacyPolicy: 'Политика конфиденциальности',
		termsOfService: 'Условия использования',
		faq: 'Частые вопросы',
		status: 'Статус',
		heroBadge: 'Сейчас онлайн · Без VPN',
		trust1: 'Без регистрации',
		trust2: 'MP4 · MP3 · до 4K',
		trust3: '100% Бесплатно',
	},
	zh: {
		title: '下载任意视频',
		heroSubtitle: '粘贴链接，选择格式，将文件保存到设备。快速、私密、可靠。',
		enterUrl: '在此粘贴视频链接...',
		fetchVideoInfo: '获取视频信息',
		selectVideoFormat: '选择格式：',
		selectFormat: '选择质量和格式',
		download: '下载',
		downloading: '处理中...',
		cancel: '取消',
		downloadComplete: '下载完成。文件已保存到您的设备。',
		refresh: '开始新下载',
		downloadAudio: '仅提取音频 (MP3)',
		features: '功能',
		about: '关于',
		contact: '联系方式',
		instructions: '帮助',
		whyChoose: '为什么选择 VideoVault',
		feature1: '快速安全',
		feature1desc: '服务器端处理，加密传输。您的数据保持私密。',
		feature2: '多种格式',
		feature2desc: '支持 MP4、WebM、MP3 等。选择您需要的质量。',
		feature3: '无需注册',
		feature3desc: '无需账户，无跟踪。粘贴链接即可下载。',
		aboutTitle: '关于 VideoVault',
		aboutText: 'VideoVault 是一项免费的视频下载服务。由独立开发者构建和维护，专注于速度、可靠性和用户隐私。',
		contactText: '有问题或反馈？联系我们：',
		copyright: '© 2025 VideoVault。版权所有。',
		footerTagline: '免费视频下载器。速度、隐私、可靠性。',
		footerNav: '导航',
		footerSupport: '支持',
		footerLegal: '法律信息',
		privacyPolicy: '隐私政策',
		termsOfService: '服务条款',
		faq: '常见问题',
		status: '状态',
		heroBadge: '当前在线 · 无需 VPN',
		trust1: '无需注册',
		trust2: 'MP4 · MP3 · 最高 4K',
		trust3: '100% 免费',
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

/* ---- Inline SVG Icons (ultralight monochrome, strokeWidth 1.5) ---- */
const SunIcon = () => (
	<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
	</svg>
)

const MoonIcon = () => (
	<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
	</svg>
)

const CloseIcon = () => (
	<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path d="M18 6L6 18M6 6l12 12" />
	</svg>
)

const MenuIcon = () => (
	<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path d="M4 6h16M4 12h16M4 18h16" />
	</svg>
)



const App = () => {
	const revealImgRef = useRef<HTMLImageElement>(null)
	const [isAdOpen, setIsAdOpen] = useState(false)
	const [isInfoPending, setIsInfoPending] = useState(false)
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
		if (typeof window !== 'undefined' && window.localStorage) {
			const savedTheme = window.localStorage.getItem('theme')
			if (savedTheme === 'dark') {
				setIsDarkMode(true)
				document.body.classList.add('dark-theme')
			}
		}
	}, [])

	// Scroll reveal
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('visible')
					}
				})
			},
			{ threshold: 0.1 }
		)
		document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
		return () => observer.disconnect()
	}, [])

	const toggleTheme = () => {
		setIsDarkMode(prevMode => {
			const newMode = !prevMode
			if (newMode) {
				if (typeof window !== 'undefined' && window.localStorage) {
					localStorage.setItem('theme', 'dark')
				}
			} else {
				if (typeof window !== 'undefined' && window.localStorage) {
					localStorage.setItem('theme', 'light')
				}
			}
			document.body.classList.toggle('dark-theme', newMode)
			return newMode
		})
	}

	const toggleMenu = () => {
		setIsMenuOpen(prev => !prev)
	}

	const fetchVideoInfo = async () => {
		setIsAdOpen(true)
	}

	const performFetch = async () => {
		try {
			setIsInfoPending(true)
			const response = await axios.post(
				'/api/get_video_info/',
				new URLSearchParams({ url })
			)
			const data = response.data
			setVideoInfo(data)
			toast.success('Successfully fetched video info.')
		} catch (error) {
			toast.error('Error fetching video info.')
		} finally {
			setIsInfoPending(false)
		}
	}

	const handleDownload = async () => {
		if (!videoFormatId) {
			toast.error('Please select a video format.')
			return
		}
	
		try {
			// Сбрасываем состояние загрузки
			setLoading(true)
			setCompleted(false)
			setProgress(0)
			setMessage('Добавляем в очередь...')
			
			// Отправляем запрос на создание задачи
			const response = await axios.post(
				'/api/download_video/',
				new URLSearchParams({
					url,
					video_format_id: videoFormatId,
					download_audio: downloadAudio.toString(),
				})
			)
	
			const { task_id, queue_position } = response.data
	
			// Если есть очередь, показываем позицию
			if (queue_position > 1) {
				setMessage(`Вы в очереди. Позиция: ${queue_position}`)
				toast.info(`Вы в очереди. Ваша позиция: ${queue_position}`)
			} else {
				setMessage('Начинаем загрузку...')
				toast.info('Загрузка начинается...')
			}
			
			const socket = new WebSocket(`wss://videovault.ru/queuesocket/${task_id}`)
	
			socket.onopen = () => {
				console.log('WebSocket connected for task:', task_id)
			}
	
			socket.onmessage = function (event) {
				try {
					const data = JSON.parse(event.data)
					
					// Обновляем прогресс
					setProgress(data.progress)
					
					// Обновляем сообщение в зависимости от статуса
					if (data.position > 1) {
						setMessage(`В очереди. Позиция: ${data.position}`)
					} else if (data.progress > 0 && data.progress < 100) {
						setMessage(`${data.message} (${data.progress.toFixed(2)}%)`)
					} else {
						setMessage(data.message)
					}
	
					// Обработка завершения
					if (data.progress >= 100 && data.completed) {
						socket.close()
						setLoading(false)
						setCompleted(true)
						toast.success('Загрузка завершена!')
						
						if (data.filename) {
							const encodedFileName = encodeURIComponent(data.filename)
							const downloadUrl = `/download/${encodedFileName}`
							const a = document.createElement('a')
							a.href = downloadUrl
							a.download = ''
							document.body.appendChild(a)
							a.click()
							document.body.removeChild(a)
						}
					}
					
					// Обработка ошибки
					if (data.progress === -1 || data.error) {
						socket.close()
						setLoading(false)
						setMessage(data.message || 'Ошибка загрузки')
						toast.error(data.message || 'Ошибка загрузки. Попробуйте другой формат.')
					}
					
				} catch (error) {
					console.error('Error parsing WebSocket message:', error)
				}
			}
	
			socket.onerror = function (error) {
				console.error('WebSocket error:', error)
				toast.error('Ошибка подключения. Попробуйте еще раз.')
				setLoading(false)
			}
	
			socket.onclose = function () {
				console.log('WebSocket disconnected')
			}
	
		} catch (error) {
			setLoading(false)
			toast.error('Error during download. Please try a different format.')
			console.error(error)
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
			{/* ──────────── HEADER ──────────── */}
			<header className='header'>
				<div className='container header-content'>
					<div className='header-left'>
						<img src={isDarkMode ? logoBlack : logoWhite} width="36" height="36" alt="VideoVault" />
						<span className='header-logo-text'>VideoVault</span>
					</div>

					<button
						id='menu-button'
						className='menu-button'
						aria-label='Menu'
						aria-expanded={isMenuOpen}
						onClick={toggleMenu}
					>
						{isMenuOpen ? <CloseIcon /> : <MenuIcon />}
					</button>

					<nav className={`nav ${isMenuOpen ? 'show' : ''}`} id='nav-menu'>
						<ul className='nav-list'>
							<li><a href='#features' className='nav-link'>{t.features}</a></li>
							<li><a href='#about' className='nav-link'>{t.about}</a></li>
							<li><a href='#contact' className='nav-link'>{t.contact}</a></li>
							<li><a href='#instructions' className='nav-link'>{t.instructions}</a></li>
							<div className='settings'>
								<div className='theme-toggle'>
									<button
										id='theme-button'
										className='theme-button'
										onClick={toggleTheme}
										aria-label="Toggle theme"
									>
										{isDarkMode ? <MoonIcon /> : <SunIcon />}
									</button>
								</div>
								<LanguageSwitcher
									currentLanguage={language}
									onLanguageChange={handleLanguageChange}
								/>
								<OnlineCounter />
							</div>
						</ul>
					</nav>
				</div>
			</header>

			{/* ──────────── AD MODAL ──────────── */}
			<AdModal
				isOpen={isAdOpen}
				onClose={() => {
					setIsAdOpen(false)
					performFetch()
				}}
			/>

			{/* ──────────── MAIN ──────────── */}
			<main className='main-content'>
				{/* ── Hero / Download Box ── */}
				<section className='hero'>
					<div className='hero-bg' aria-hidden='true'>
						<DotGrid
							dotSize={3}
							gap={26}
							baseColor={isDarkMode ? '#26263a' : '#d3ddec'}
							activeColor={isDarkMode ? '#a855f7' : '#0a84ff'}
							proximity={130}
							shockRadius={230}
							shockStrength={5}
							resistance={620}
							returnDuration={1.5}
						/>
						<div className='hero-fade'></div>
					</div>

					<div className='content-box'>
						<span className='hero-badge'>
							<span className='dot'></span>
							{t.heroBadge}
						</span>
						<h1 className='title'>{t.title}</h1>
						<p className='hero-subtitle'>{t.heroSubtitle}</p>

						<div className='download-panel'>
					<input
						type='text'
						className='input-field'
						placeholder={t.enterUrl}
						value={url}
						onChange={e => setUrl(e.target.value)}
					/>

					<SpecularButton
						size="lg"
						radius={10}
						tint={isDarkMode ? "#a855f7" : "#0a84ff"}
						tintOpacity={0.98}
						blur={0}
						textColor="#ffffff"
						lineColor={isDarkMode ? "#e9d5ff" : "#bfdbfe"}
						baseColor={isDarkMode ? "#7e22ce" : "#0561c9"}
						intensity={1.3}
						shineSize={12}
						shineFade={30}
						thickness={1.5}
						speed={0.4}
						followMouse={true}
						proximity={250}
						autoAnimate={false}
						disabled={isInfoPending || !url.trim()}
						onClick={fetchVideoInfo}
						className="hero-button"
						style={{
							width: '100%',
							marginTop: '12px',
							background: isDarkMode ? '#a855f7' : '#0a84ff',
							boxShadow: isDarkMode
								? '0 8px 22px rgba(168, 85, 247, 0.32)'
								: '0 8px 22px rgba(10, 132, 255, 0.28)',
						}}
					>
						{isInfoPending ? t.downloading : t.fetchVideoInfo}
					</SpecularButton>

					{videoInfo && (
						<div style={{ marginTop: '20px' }}>
							<div className='video-title'>{videoInfo.title}</div>
							<p className='subtitle'>{t.selectVideoFormat}</p>
							<select
								className='select-field'
								value={videoFormatId}
								onChange={e => setVideoFormatId(e.target.value)}
							>
								<option value=''>{t.selectFormat}</option>
								{videoInfo.formats.map((format: VideoFormat) => (
									<option key={format.format_id} value={format.format_id}>
										{format.quality} ({format.ext}) — {format.resolution}p — {format.type}
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
							<div className='progress-track'>
								<div
									className='progress-bar'
									style={{ width: `${Math.max(0, progress)}%` }}
								/>
							</div>
							<p>{message}</p>
						</div>
					)}

					{completed && (
						<div className='snackbar'>
							<div className='alert-success'>{t.downloadComplete}</div>
						</div>
					)}

					<ToastContainer />

					<button
						className='secondary-button'
						onClick={() => window.location.reload()}
						style={{ marginTop: '12px' }}
					>
						{t.refresh}
					</button>
						</div>

						<div className='hero-trust'>
							<span>{t.trust1}</span>
							<span>{t.trust2}</span>
							<span>{t.trust3}</span>
						</div>
					</div>
				</section>

				{/* ── Section Dividers + Content Sections ── */}
				<hr className='section-divider' />

				<section id='instructions' className='reveal'>
					<VideoPlayerInstructions language={language} />
				</section>

				<hr className='section-divider' />

				<section className='reveal'>
					<DonatePay language={language} />
				</section>

				<hr className='section-divider' />

				<section className='reveal'>
					<PathnerInstructions language={language} />
				</section>

				<hr className='section-divider' />

				{/* ── Features ── */}
				<BentoFeatures language={language} />

				{/* ── About ── */}
				<section id='about' className='about reveal'>
					<div className='container'>
						<h2 className='section-title'>{t.aboutTitle}</h2>
						<p>{t.aboutText}</p>
					</div>
				</section>

				{/* ── Contact ── */}
				<section id='contact' className='contact reveal'>
					<div className='container'>
						<h2 className='section-title'>{t.contact}</h2>
						<p>
							{t.contactText}{' '}
							<a href='mailto:helpvideovault@gmail.com'>
								helpvideovault@gmail.com
							</a>
						</p>
						<p>
							{t.contactText}{' '}
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

			{/* ──────────── FOOTER ──────────── */}
			<footer className='footer'>
				<div 
					className='footer-cta'
					style={{ position: 'relative', overflow: 'hidden' }}
					onMouseMove={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						const x = e.clientX - rect.left;
						const y = e.clientY - rect.top;
						const el = revealImgRef.current;
						if (el) {
						el.style.setProperty('--mx', `${x}px`);
						el.style.setProperty('--my', `${y + rect.height * 0.5}px`);
						}
					}}
					onMouseLeave={() => {
						const el = revealImgRef.current;
						if (el) {
						el.style.setProperty('--mx', '-9999px');
						el.style.setProperty('--my', '-9999px');
						}
					}}
				>
					<div className="footer-giant-text">
						VIDEOVAULT
					</div>
					<div style={{
						position: 'relative',
						zIndex: 6,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '24px'
					}}>
						<h2>Ready to start downloading?</h2>
						<p>Get high quality videos from multiple platforms without any limits or annoying watermarks.</p>
						<SpecularButton
							size="lg"
							radius={100}
							tint={isDarkMode ? "#a855f7" : "#0a84ff"}
							tintOpacity={0.98}
							blur={0}
							textColor="#ffffff"
							lineColor={isDarkMode ? "#e9d5ff" : "#bfdbfe"}
							baseColor={isDarkMode ? "#7e22ce" : "#0561c9"}
							intensity={1.5}
							shineSize={15}
							shineFade={40}
							thickness={2}
							speed={0.5}
							followMouse={true}
							proximity={300}
							autoAnimate={true}
							onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
							style={{
								background: isDarkMode ? '#a855f7' : '#0a84ff',
								boxShadow: isDarkMode
									? '0 10px 28px rgba(168, 85, 247, 0.38)'
									: '0 10px 28px rgba(10, 132, 255, 0.32)',
							}}
						>
							Start Downloading Now
						</SpecularButton>
					</div>

					<img
						ref={revealImgRef}
						src="https://images.unsplash.com/photo-1620641788415-115d1ea23db1?auto=format&fit=crop&w=1920&q=80"
						alt="Reveal effect"
						style={{
						position: 'absolute',
						width: '100%',
						top: '-50%',
						zIndex: 5,
						mixBlendMode: 'lighten',
						opacity: 0.2,
						pointerEvents: 'none',
						'--mx': '-9999px',
						'--my': '-9999px',
						WebkitMaskImage: 'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,1) 0px, rgba(255,255,255,0.95) 60px, rgba(255,255,255,0.6) 120px, rgba(255,255,255,0.25) 180px, rgba(255,255,255,0) 240px)',
						maskImage: 'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,1) 0px, rgba(255,255,255,0.95) 60px, rgba(255,255,255,0.6) 120px, rgba(255,255,255,0.25) 180px, rgba(255,255,255,0) 240px)',
						WebkitMaskRepeat: 'no-repeat',
						maskRepeat: 'no-repeat'
						} as any}
					/>
				</div>

				<div className='container'>
					<div className='footer-main'>
						<div className='footer-brand'>
							<div className='footer-brand-logo'>
								<img src={isDarkMode ? logoBlack : logoWhite} width="32" height="32" alt="VideoVault" />
								<span>VideoVault</span>
							</div>
							<p>{t.footerTagline}</p>
							<div className='footer-socials'>
								<a href='https://t.me/IT_juniorMy' target='_blank' rel='noopener noreferrer' aria-label='Telegram'>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M21.5 2L2 10.5L10 14L13.5 22L21.5 2Z" />
										<path d="M21.5 2L10 14" />
									</svg>
								</a>
								<a href='mailto:helpvideovault@gmail.com' aria-label='Email'>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
										<polyline points="22,6 12,13 2,6" />
									</svg>
								</a>
							</div>
						</div>

						<div className='footer-column'>
							<h4>{t.footerNav}</h4>
							<ul>
								<li><a href='#features'>{t.features}</a></li>
								<li><a href='#about'>{t.about}</a></li>
								<li><a href='#instructions'>{t.instructions}</a></li>
								<li><a href='#contact'>{t.contact}</a></li>
							</ul>
						</div>

						<div className='footer-column'>
							<h4>{t.footerSupport}</h4>
							<ul>
								<li><a href='#instructions'>{t.faq}</a></li>
								<li><a href='mailto:helpvideovault@gmail.com'>Email</a></li>
								<li><a href='https://t.me/IT_juniorMy' target='_blank' rel='noopener noreferrer'>Telegram</a></li>
							</ul>
						</div>

						<div className='footer-column'>
							<h4>{t.footerLegal}</h4>
							<ul>
								<li><a href='#'>{t.privacyPolicy}</a></li>
								<li><a href='#'>{t.termsOfService}</a></li>
							</ul>
						</div>
					</div>

					<div className='footer-bottom'>
						<p>{t.copyright}</p>
						<div className='footer-bottom-links'>
							<a href='https://t.me/IT_juniorMy' target='_blank' rel='noopener noreferrer'>Telegram</a>
							<a href='mailto:helpvideovault@gmail.com'>Email</a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	)
}


export default App
