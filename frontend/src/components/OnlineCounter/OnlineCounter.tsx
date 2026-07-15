import axios from 'axios'
import React, { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

/* Ultralight monochrome SVG icons */
const FlameIcon = () => (
	<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path d="M12 22c-4.97 0-7-3.58-7-7 0-2.79 1.34-4.73 2.41-6.21.72-1 1.59-2.09 1.59-3.29a.5.5 0 0 1 .87-.34C11.73 7.15 14 10.2 14 12c0 .55.09 1.07.26 1.55.46-.85.74-1.82.74-2.55a.5.5 0 0 1 .87-.34C17.77 12.79 19 15.07 19 17c0 2.42-2.03 5-7 5z" />
	</svg>
)

const UserIcon = () => (
	<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
		<circle cx="12" cy="7" r="4" />
	</svg>
)

const OnlineCounter: React.FC = () => {
	const [onlineUsers, setOnlineUsers] = useState<number>(0)
	const [totalVisits, setTotalVisits] = useState<number>(0)
	const userIdRef = useRef<string>(localStorage.getItem('userId') || uuidv4())

	useEffect(() => {
		// Сохраним идентификатор пользователя в локальном хранилище
		localStorage.setItem('userId', userIdRef.current)

		const joinUser = async () => {
			try {
				// Проверим, сохранен ли ранее идентификатор пользователя
				const response = await axios.post(
					`/api/counter/user_join/${userIdRef.current}`
				)
				setOnlineUsers(response.data.onlineUsers)
				setTotalVisits(response.data.totalVisits)
			} catch (error) {
				console.error('Error joining user:', error)
			}
		}

		const leaveUser = async () => {
			try {
				await axios.post(
					`/api/counter/user_leave/${userIdRef.current}`
				)
			} catch (error) {
				console.error('Error leaving user:', error)
			}
		}

		joinUser()

		window.addEventListener('beforeunload', leaveUser)
		return () => {
			window.removeEventListener('beforeunload', leaveUser)
		}
	}, [])

	useEffect(() => {
		const fetchVisits = async () => {
			try {
				const response = await axios.get('/api/counter/visits')
				setTotalVisits(response.data.totalVisits)
			} catch (error) {
				console.error('Error fetching visits:', error)
			}
		}

		fetchVisits()
	}, [])

	return (
		<div className='online-counter'>
			<p>
				<FlameIcon />
				<span className='visitors-count'>{onlineUsers}</span>
			</p>
			<p>
				<UserIcon />
				<span className='visits-count'>{totalVisits}</span>
			</p>
		</div>
	)
}

export default OnlineCounter
