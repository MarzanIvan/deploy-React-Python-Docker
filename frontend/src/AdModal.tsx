import { FC, useEffect } from 'react'

interface AdModalProps {
	isOpen: boolean
	onClose: () => void
}

const AdModal: FC<AdModalProps> = ({ isOpen, onClose }) => {
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', handleEsc)
		return () => document.removeEventListener('keydown', handleEsc)
	}, [onClose])

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
			<div className="relative w-full max-w-md p-6 bg-white rounded-2xl shadow-lg">
	<button
		onClick={onClose}
		className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
		aria-label="Close"
	>
		&times;
	</button>
    <h3 className="text-lg font-semibold text-gray-800 mb-1">💼 Наши партнёр — avan.market, lis-skins, tradeit</h3>

			<p className="text-sm text-gray-600 mb-2">
				🕹️ Покупай и продавай скины для <strong>CS2, Dota 2</strong> и <strong>Rust</strong> в пару кликов!
			</p>

			<p className="text-sm text-gray-600 mb-4">
				💸 Получи <strong>$5 бонус</strong> при первой продаже или покупке.
			</p>

			<p className="text-xs text-gray-400 mb-4">
				Переход на сайт партнёра поддержит развитие проекта VideoVault 🙏
			</p>

	<div className="flex justify-center">
		<button
			onClick={onClose}
			className="px-6 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all"
		>
			Перейти
		</button>
	</div>
</div>

		</div>
	)
}

export default AdModal
