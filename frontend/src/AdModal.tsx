import React, { FC, useEffect, useState } from 'react'
import { FaTimes } from 'react-icons/fa'

const AdModal: FC = () => {
	const [isOpen, setIsOpen] = useState<boolean>(false)

	useEffect(() => {
		const dismissed = localStorage.getItem('adDismissed')
		if (!dismissed) setIsOpen(true)
	}, [])

	const closeModal = (): void => {
		setIsOpen(false)
		localStorage.setItem('adDismissed', 'true')
	}

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
			<div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-xl w-[90%] max-w-md relative animate-fadeIn">
				<button
					className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-white transition"
					onClick={closeModal}
				>
					<FaTimes className="w-5 h-5" />
				</button>

				<h2 className="text-xl font-semibold mb-2 text-center">Поддержи проект</h2>
				<p className="text-sm text-gray-700 dark:text-gray-300 text-center mb-4">
					Если тебе понравился <b>VideoVault</b>, поддержи нас на Boosty — это поможет с хостингом и разработкой новых функций.
				</p>

				<div className="flex justify-center">
					<a
						href="https://boosty.to/flowseal"
						target="_blank"
						rel="noopener noreferrer"
						className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-full transition"
					>
						Перейти на Boosty
					</a>
				</div>
			</div>
		</div>
	)
}

export default AdModal
