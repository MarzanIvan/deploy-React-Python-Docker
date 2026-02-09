import React, { useState } from 'react'
import qr100 from './../../img/QR100.png'
import qr300 from './../../img/QR300.png'
import qr500 from './../../img/QR500.png'
import DonatePayImg from './../../img/logo-new-mini.png'
import './DonatePay.css'

interface DonatePayProps {
    language: 'en' | 'ru' | 'zh'
}

const DonatePay: React.FC<DonatePayProps> = ({
                                                                         language,
                                                                     }) => {
    const [step, setStep] = useState(0)

    const translations = {
        en: {
            title: 'Support VideoVault!\n',
            steps: [
                '1. Visit the DonatePay link to support the project',
                '2. Support the project to improve the service and help its development',
                '3. Use and enjoy VideoVault',
                '4. The project is developed by a single developer.',
                '5. Donations help cover server rental costs and add new useful features.',
            ],
            buttons: {
                previous: 'Previous Step',
                next: 'Next Step',
            },
        },
        ru: {
            title: 'Поддержите VideoVault!',
            steps: [
                '1. Перейдите на DonatePay ссылке чтобы поддержать проект',
                '2. Поддержите проект для улучшение сервиса и развитие проекта',
                '3. Используйте и наслаждайтесь VideoVault',
                '4. Проект развивается одним разработчиком.',
                '5. Донаты помогают оплачивать аренду серверного оборудования и добавлять новые полезные функции.',
            ],
            buttons: {
                previous: 'Предыдущий шаг',
                next: 'Следующий шаг',
            },
        },
        zh: {
            title: '支持 VideoVault！\n',
            steps: [
                '1. 通过 DonatePay 链接支持本项目',
                '2. 支持项目以提升服务质量并促进项目发展',
                '3. 使用并享受 VideoVault',
                '4. 本项目由一名开发者独立开发。',
                '5. 捐赠有助于支付服务器租赁费用并添加新的实用功能。',
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
            name: 'Поддержать 100р',
            src: qr100,
            link: 'https://videovault.ru/QR100.png',
        },
        {
            name: 'Поддержать 300р',
            src: qr300,
            link: 'https://videovault.ru/QR300.png',
        },
        {
            name: 'Поддержать 500р',
            src: qr500,
            link: 'https://videovault.ru/QR500.png',
        }
    ]
    const donatepay = [
        {
            name: 'DonatePay link',
            src: DonatePayImg,
            link: 'https://donatepay.ru/don/1467133',
        }
    ]

    return (
        <div className='video-player-guide'>
            <h1>{currentTranslation.title}</h1>

            <div className='donate-logos'>
                {donatepay.map((logo, index) => (
                    <a
                        key={index}
                        href={logo.link}
                        target='_blank'
                        rel='noopener noreferrer'
                    >
                        <img src={logo.src} alt={logo.name}/>
                        <p>{logo.name}</p>
                    </a>
                ))}
            </div>

            <div className='donate-logos'>
                {logos.map((logo, index) => (
                    <a
                        key={index}
                        href={logo.link}
                        target='_blank'
                        rel='noopener noreferrer'
                    >
                        <img src={logo.src} alt={logo.name}/>
                        <p>{logo.name}</p>
                    </a>
                ))}
            </div>

            <div className='video-player-text'>
                <p>{currentTranslation.steps[step]}</p>
            </div>

            <div className='donate-buttons'>
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

export default DonatePay
