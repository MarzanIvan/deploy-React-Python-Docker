import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import CookieConsent, { openCookieSettings } from './components/CookieConsent/CookieConsent'

beforeEach(() => {
  window.localStorage.clear()
})

test('offers equally available accept and reject cookie choices', () => {
  render(<CookieConsent language='ru' />)

  expect(screen.getByRole('button', { name: 'Согласиться' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Отказаться' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Подробнее' })).toHaveAttribute('href', '/cookies')
})

test('stores rejection without blocking the site and allows reopening settings', () => {
  render(<CookieConsent language='ru' />)

  fireEvent.click(screen.getByRole('button', { name: 'Отказаться' }))
  expect(window.localStorage.getItem('videovault_cookie_consent')).toBe('rejected')
  expect(screen.queryByRole('region', { name: 'Уведомление об использовании cookie' })).not.toBeInTheDocument()

  act(() => openCookieSettings())
  expect(screen.getByRole('region', { name: 'Уведомление об использовании cookie' })).toBeInTheDocument()
})
