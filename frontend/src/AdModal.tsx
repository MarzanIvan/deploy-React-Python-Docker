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
	<h2 className="text-xl font-semibold mb-4 text-center">
        Покупай и продавай скины CS2 DOTA2 Rust в пару кликов. <br/>Buy and sell your skins in a couple of clicks!
	</h2>

	<p className="mb-4 text-sm text-gray-600 text-center">
		Чтобы продолжить перейдите на сайт партнёра. Это поможет этому проекту.<br/>
        5$ на первую продажу и покупку.
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
