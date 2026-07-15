import React, { useEffect, useRef } from 'react';
import './BentoFeatures.css';

interface BentoFeaturesProps {
  language: string;
}

const translations: Record<string, any> = {
  en: {
    sectionTitle: "Why Choose VideoVault",
    sectionKicker: "Built for professionals",
    sectionSubtitle: "The most powerful media downloader designed for professionals.",
    qualityTitle: "Ultimate Quality",
    qualityDesc: "Download in 4K, 8K, or original quality. No compromises, exact pixel-perfect source retrieval.",
    platformsTitle: "Universal Support",
    platformsDesc: "Works flawlessly with Youtube platforms. They will soon appear on TikTok and Instagram.",
    noWatermarkTitle: "Zero Watermarks",
    noWatermarkDesc: "Clean videos, exactly as the creator intended without any logos.",
    speedTitle: "Lightning Fast",
    speedDesc: "Dedicated network edge servers ensure maximum download speed worldwide.",
    privacyTitle: "Privacy First",
    privacyDesc: "No logs. No tracking. Completely anonymous downloads."
  },
  ru: {
    sectionTitle: "Почему выбирают VideoVault",
    sectionKicker: "Создано для профессионалов",
    sectionSubtitle: "Самый мощный загрузчик медиа, созданный для профессионалов.",
    qualityTitle: "Максимальное качество",
    qualityDesc: "Скачивайте в 4K, 8K или в оригинальном качестве без потерь.",
    platformsTitle: "Поддержка всего",
    platformsDesc: "Безупречно работает с платформами YouTube. Скоро появятся TikTok и Instagram.",
    noWatermarkTitle: "Без водяных знаков",
    noWatermarkDesc: "Чистые видео, ровно так, как задумывал автор, без логотипов.",
    speedTitle: "Молниеносно",
    speedDesc: "Выделенные серверы обеспечивают максимальную скорость загрузки по всему миру.",
    privacyTitle: "Конфиденциальность",
    privacyDesc: "Мы не ведем логи. Полная анонимность загрузок."
  },
  zh: {
    sectionTitle: "为什么选择 VideoVault",
    sectionKicker: "为专业人士打造",
    sectionSubtitle: "专为专业人士设计的最强大的媒体下载器。",
    qualityTitle: "终极画质",
    qualityDesc: "下载 4K、8K 或原始画质，绝不妥协。",
    platformsTitle: "通用支持",
    platformsDesc: "完美支持 YouTube 平台。TikTok 和 Instagram 即将上线。",
    noWatermarkTitle: "无水印",
    noWatermarkDesc: "干净的视频，完全按照创作者的意图，没有任何标识。",
    speedTitle: "极速下载",
    speedDesc: "全球专用服务器确保最快的下载速度。",
    privacyTitle: "隐私至上",
    privacyDesc: "无日志。无追踪。完全匿名的下载体验。"
  }
};

/* Pointer-tracked spotlight glow — shared across every bento card */
const handleSpotlight = (e: React.MouseEvent<HTMLDivElement>) => {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  card.style.setProperty('--my', `${e.clientY - rect.top}px`);
};

const BentoFeatures: React.FC<BentoFeaturesProps> = ({ language }) => {
  const t = translations[language] || translations['en'];
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('bento-visible');
        }
      });
    }, { threshold: 0.1 });

    const cards = sectionRef.current?.querySelectorAll('.bento-card');
    cards?.forEach(card => observerRef.current?.observe(card));

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="features" className="bento-section">
      <div className="container">
        <div className="bento-heading">
          <span className="bento-kicker">{t.sectionKicker}</span>
          <h2 className="section-title">{t.sectionTitle}</h2>
          <p className="section-subtitle">{t.sectionSubtitle}</p>
        </div>

        <div className="bento-grid">
          {/* Card 1: Ultimate Quality (Large) */}
          <div className="bento-card bento-card--large" onMouseMove={handleSpotlight}>
            <span className="bento-card__index">01</span>
            <div className="bento-card__spotlight"></div>
            <div className="bento-card__content">
              <div className="bento-icon bento-icon--primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              </div>
              <h3>{t.qualityTitle}</h3>
              <p>{t.qualityDesc}</p>
              <div className="bento-visual">
                <span className="badge">4K</span>
                <span className="badge">8K</span>
                <span className="badge badge--accent">Original HDR</span>
              </div>
            </div>
          </div>

          {/* Card 2: Universal Support (Medium) */}
          <div className="bento-card bento-card--medium" onMouseMove={handleSpotlight}>
            <span className="bento-card__index">02</span>
            <div className="bento-card__spotlight"></div>
            <div className="bento-card__content">
              <div className="bento-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              </div>
              <h3>{t.platformsTitle}</h3>
              <p>{t.platformsDesc}</p>
              <div className="bento-visual bento-visual--icons">
                <div className="icon-circle">TT</div>
                <div className="icon-circle">YT</div>
                <div className="icon-circle">IG</div>
                <div className="icon-circle">X</div>
              </div>
            </div>
          </div>

          {/* Card 3: Zero Watermarks (Small) */}
          <div className="bento-card bento-card--small" onMouseMove={handleSpotlight}>
            <span className="bento-card__index">03</span>
            <div className="bento-card__spotlight"></div>
            <div className="bento-card__content">
              <div className="bento-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              </div>
              <h3>{t.noWatermarkTitle}</h3>
              <p>{t.noWatermarkDesc}</p>
            </div>
          </div>

          {/* Card 4: Privacy First (Small) */}
          <div className="bento-card bento-card--small" onMouseMove={handleSpotlight}>
            <span className="bento-card__index">04</span>
            <div className="bento-card__spotlight"></div>
            <div className="bento-card__content">
              <div className="bento-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <h3>{t.privacyTitle}</h3>
              <p>{t.privacyDesc}</p>
            </div>
          </div>

          {/* Card 5: Lightning Fast (Medium) */}
          <div className="bento-card bento-card--medium" onMouseMove={handleSpotlight}>
            <span className="bento-card__index">05</span>
            <div className="bento-card__spotlight"></div>
            <div className="bento-card__content">
              <div className="bento-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              </div>
              <h3>{t.speedTitle}</h3>
              <p>{t.speedDesc}</p>
              <div className="bento-visual bento-visual--progress">
                <div className="fake-progress-bar"><div className="fake-progress-fill"></div></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default BentoFeatures;
