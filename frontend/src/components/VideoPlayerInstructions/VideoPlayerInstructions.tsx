import React, { useState } from 'react'
import gomLogo from './../../img/GOMimg.png'
import avanmarket from './../../img/avanmarket.png'
import lisskins from './../../img/lisskins.png'
import tradeit from './../../img/tradeit.png'
import './Video-player-layerInstructions.css'

interface VideoPlayerInstructionsProps {
	language: 'en' | 'ru' | 'zh'
}

const VideoPlayerInstructions: React.FC<VideoPlayerInstructionsProps> = ({
	language,
}) => {
	const [step, setStep] = useState(0)

	const translations = {
		en: {
			title: 'How to Profitably Buy & Sell Skins for CS2, Dota 2, Rust',
			steps: [
				'1. Visit our trusted partner platform: [avan.market](https://avan.market/?r=njkPFU9sqSEf).',
				'2. Sign up or log in to your account. The referral link grants you a $5 bonus on your first trade!',
				'3. Browse the marketplace for CS2, Dota 2, or Rust skins and add your favorites to the cart.',
				'4. To sell, head to your inventory tab and list your skins for sale in just a couple of clicks.',
				'5. Complete your first purchase or sale to receive your bonus. Enjoy fast trades and low fees!',
			],
			buttons: {
				previous: 'Previous Step',
				next: 'Next Step',
			},
		},
		ru: {
			title: 'Как выгодно покупать и продавать скины CS2, Dota 2, Rust',
			steps: [
				'1. Перейдите на нашу проверенную партнёрскую платформу: [avan.market](https://avan.market/?r=njkPFU9sqSEf).',
				'2. Зарегистрируйтесь или войдите в аккаунт. Переход по ссылке даёт вам бонус $5 на первую сделку!',
				'3. Найдите интересующие вас скины для CS2, Dota 2 или Rust и добавьте их в корзину.',
				'4. Хотите продать? Откройте вкладку инвентаря и выставьте скины на продажу в пару кликов.',
				'5. Совершите первую покупку или продажу, чтобы получить бонус. Быстрые сделки и низкие комиссии!',
			],
			buttons: {
				previous: 'Предыдущий шаг',
				next: 'Следующий шаг',
			},
		},
		zh: {
			title: '如何高效购买和出售 CS2、Dota 2 和 Rust 皮肤',
			steps: [
				'1. 访问我们值得信赖的合作伙伴平台：[avan.market](https://avan.market/?r=njkPFU9sqSEf)。',
				'2. 注册或登录账户。通过推荐链接首次交易可获得 5 美元奖励！',
				'3. 浏览 CS2、Dota 2 或 Rust 的皮肤市场并添加你喜欢的皮肤。',
				'4. 想出售皮肤？打开库存标签并轻松列出你的皮肤进行销售。',
				'5. 完成首次购买或出售以领取奖励。享受快速交易和低手续费！',
			],
			buttons: {
				previous: '上一步',
				next: '下一步',
			},
		}
	}

	const currentTranslation = translations[language]

	const nextStep = () => {
		if (step < currentTranslation.steps.length - 1) {
			setStep(step + 1)
		}
	}

	const prevStep = () => {
		if (step > 0) {
			setStep(step - 1)
		}
	}

	const logos = [
		{
			name: 'avan.market',
			src: avanmarket,
			link: 'https://avan.market/?r=njkPFU9sqSEf',
		},
		{
			name: 'lis-skins.com',
			src: lisskins,
			link: 'https://lis-skins.com/?rf=3223736',
		},
		{
			name: 'tradeit.gg',
			src: tradeit,
			link: 'https://avan.market/?r=njkPFU9sqSEf',
		}
	]

	return (
		<div className='video-player-guide'>
			<h1>{currentTranslation.title}</h1>

			<div className='video-player-logos'>
				{logos.map((logo, index) => (
					<a
						key={index}
						href={logo.link}
						target='_blank'
						rel='noopener noreferrer'
					>
						<img src={logo.src} alt={logo.name} />
						<p>{logo.name}</p>
					</a>
				))}
			</div>

			<div className='video-player-text'>
				<p>{currentTranslation.steps[step]}</p>
			</div>

			<div className='video-player-buttons'>
				<button onClick={prevStep} disabled={step === 0}>
					{currentTranslation.buttons.previous}
				</button>
				<button
					onClick={nextStep}
					disabled={step === currentTranslation.steps.length - 1}
				>
					{currentTranslation.buttons.next}
				</button>
			</div>
		</div>
	)
}

export default VideoPlayerInstructions
