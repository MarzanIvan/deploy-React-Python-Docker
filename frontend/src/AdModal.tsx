import { FC, useEffect } from 'react'
import PartnerBanner from './PartnerBanner'

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
	<div className="space-y-4">
					<PartnerBanner name="Avan.market" link="https://avan.market" />
					<PartnerBanner name="Lis-Skins" link="https://lis-skins.com" buttonColor="bg-pink-600" />
					<PartnerBanner name="Tradeit" link="https://tradeit.gg" buttonColor="bg-green-600" />
				</div>

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
