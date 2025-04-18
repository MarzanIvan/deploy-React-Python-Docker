import { FC } from 'react'

interface PartnerBannerProps {
	name: string
	link: string
	buttonColor?: string
}

const PartnerBanner: FC<PartnerBannerProps> = ({ name, link, buttonColor = 'bg-blue-600' }) => {
	return (
		<div className="bg-white p-6 rounded-2xl shadow-lg text-center max-w-md mx-auto">
			<h3 className="text-lg font-semibold text-gray-800 mb-1">💼 Наш партнёр — {name}</h3>

			<p className="text-sm text-gray-600 mb-2">
				🕹️ Покупай и продавай скины для <strong>CS2, Dota 2</strong> и <strong>Rust</strong> в пару кликов!
			</p>

			<p className="text-sm text-gray-600 mb-4">
				💸 Получи <strong>$5 бонус</strong> при первой продаже или покупке.
			</p>

			<p className="text-xs text-gray-400 mb-4">
				Переход на сайт партнёра поддержит развитие проекта VideoVault 🙏
			</p>

			<a
				href={link}
				target="_blank"
				rel="noopener noreferrer"
				className={`inline-block px-6 py-2 text-white ${buttonColor} hover:brightness-110 rounded-full transition-all`}
			>
				Перейти
			</a>
		</div>
	)
}

export default PartnerBanner
