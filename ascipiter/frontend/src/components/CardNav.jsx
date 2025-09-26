// frontend/src/CardNav.jsx

import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { GoArrowUpRight } from 'react-icons/go';
import GlassSurface from './GlassSurface';
import ToggleSwitch from './ToggleSwitch';
import './../App.css';

const CardNav = ({
  logo,
  logoAlt = 'Logo',
  items,
  className = '',
  ease = 'power3.out',
  baseColor = '#fff',
  menuColor,
  buttonBgColor,
  buttonTextColor,
  ctaButtonText = 'Get Started',
  isGlass = false,
  glassBlur = 15,
  glassTransparency = 0.1,
  distortionScale = 0,
  isChapelVisible,
  onToggleChapel,
  isAiVisible,
  onToggleAi,
}) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef(null);
  const cardsRef = useRef([]);
  const tlRef = useRef(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content');
      if (contentEl) {
        const wasVisible = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;
        contentEl.style.visibility = 'visible';
        contentEl.style.pointerEvents = 'auto';
        contentEl.style.position = 'static';
        contentEl.style.height = 'auto';
        contentEl.offsetHeight;
        const topBar = 60;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;
        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;
        return topBar + contentHeight + padding;
      }
    }
    return 260;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;
    gsap.set(navEl, { height: 60, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });
    const tl = gsap.timeline({ paused: true });
    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease
    });
    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 }, '-=0.1');
    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    return () => { tl?.kill(); tlRef.current = null; };
  }, [ease]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;
      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const setCardRef = i => el => {
    if (el) cardsRef.current[i] = el;
  };

  const navHeader = (
    <div className="card-nav-top">
      <div
        className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
        onClick={toggleMenu}
        role="button"
        aria-label={isExpanded ? 'Close menu' : 'Open menu'}
        tabIndex={0}
        style={{ color: menuColor || (isGlass ? '#fff' : '#000') }}
      >
        <div className="hamburger-line" />
        <div className="hamburger-line" />
      </div>
      <div className="logo-container">
        <img src={logo} alt={logoAlt} className="logo" />
      </div>
      <button
        type="button"
        className="card-nav-cta-button"
        style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
      >
        {ctaButtonText}
      </button>
    </div>
  );

  const navBody = (
    <div className="card-nav-content" aria-hidden={!isExpanded}>
      {items.slice(0, 3).map((item, idx) => {
        const isCardGlass = item.isGlass ?? false;
        const cardContent = (
          <div className="nav-card-inner-content">
            <div className="nav-card-label">{item.label}</div>
            <div className="nav-card-links">
              {item.links?.map((lnk, i) => {
                // Handle toggle switches
                if (lnk.type === 'toggle') {
                  const isToggled = lnk.id === 'ai-toggle' ? isAiVisible : isChapelVisible;
                  const onToggle = lnk.id === 'ai-toggle' ? onToggleAi : onToggleChapel;
                  let label;

                  if (lnk.id === 'ai-toggle') {
                    label = isAiVisible ? 'Hide AI Helper' : 'Show AI Helper';
                  } else {
                    label = isChapelVisible ? 'Hide Chapel Schedule' : 'Show Chapel Schedule';
                  }

                  return (
                    <ToggleSwitch
                      key={lnk.id}
                      label={label}
                      isToggled={isToggled}
                      onToggle={onToggle}
                    />
                  );
                }
                
                // --- NEW: Handle buttons ---
                if (lnk.type === 'button') {
                  return (
                    <button
                      key={`${lnk.label}-${i}`}
                      className="nav-card-button"
                      onClick={lnk.onClick}
                      aria-label={lnk.ariaLabel}
                    >
                      {lnk.label}
                    </button>
                  );
                }
                
                // Default to a standard link
                return (
                  <a key={`${lnk.label}-${i}`} className="nav-card-link" href={lnk.href} target={lnk.target} rel={lnk.target === '_blank' ? 'noopener noreferrer' : undefined} aria-label={lnk.ariaLabel}>
                    <GoArrowUpRight className="nav-card-link-icon" aria-hidden="true" />
                    {lnk.label}
                  </a>
                );
              })}
            </div>
          </div>
        );

        if (isCardGlass) {
          return (
            <GlassSurface
              key={`${item.label}-${idx}`}
              ref={setCardRef(idx)}
              className="nav-card"
              borderRadius={12}
              fallbackBlur={item.glassBlur}
              fallbackTransparency={item.glassTransparency}
              distortionScale={item.distortionScale || 0}
              style={{ color: item.textColor }}
            >
              {cardContent}
            </GlassSurface>
          );
        }

        return (
          <div
            key={`${item.label}-${idx}`}
            ref={setCardRef(idx)}
            className="nav-card"
            style={{ backgroundColor: item.bgColor, color: item.textColor }}
          >
            {cardContent}
          </div>
        );
      })}
    </div>
  );

  const navCommonClasses = `card-nav ${isExpanded ? 'open' : ''}`;

  return (
    <div className={`card-nav-container ${className}`}>
      {isGlass ? (
        <GlassSurface ref={navRef} className={navCommonClasses} borderRadius={24} fallbackBlur={glassBlur} fallbackTransparency={glassTransparency} distortionScale={distortionScale}>
          {navHeader}
          {navBody}
        </GlassSurface>
      ) : (
        <nav ref={navRef} className={navCommonClasses} style={{ backgroundColor: baseColor }}>
          {navHeader}
          {navBody}
        </nav>
      )}
    </div>
  );
};

export default CardNav;