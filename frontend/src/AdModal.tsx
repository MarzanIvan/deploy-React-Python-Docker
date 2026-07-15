import { FC, useEffect } from 'react'
import './index.css'

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
		<div className='ad-modal-overlay' onClick={onClose}>
			<div className='ad-modal-card' onClick={(e) => e.stopPropagation()}>
				<h3>Our partners — avan.market, lis-skins, tradeit</h3>
				<p>
					Buy and sell skins for <strong>CS2, Dota 2</strong> and <strong>Rust</strong> in a few clicks.
				</p>
				<p>
					Get a <strong>$5 bonus</strong> on your first purchase or sale.
				</p>
				<p className="ad-modal-hint">
					Visiting our partner helps support the development of videovault.ru
				</p>
				<a
					href="https://avan.market/?r=njkPFU9sqSEf"
					target="_blank"
					rel="noopener noreferrer"
					style={{ textDecoration: 'none' }}
				>
					<button
						onClick={onClose}
						className="ad-modal-cta"
					>
						Visit partner
					</button>
				</a>
			</div>
		</div>
	)
}

export default AdModal
