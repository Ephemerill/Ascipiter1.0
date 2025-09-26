import React, { useState, useRef, useLayoutEffect, useEffect, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import GlassSurface from './components/GlassSurface';
import './App.css';
import Silk from './components/Silk';
import CardNav from './components/CardNav';
import logo from './assets/logo.svg';
import MealItem from './components/MealItem';
import AiResponse from './components/AiResponse';
import ToggleSwitch from './components/ToggleSwitch';

// --- Helper functions for managing cookies ---
const setCookie = (name, value, days) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
};

const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

// Helper function to capitalize each word
const capitalizeWords = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

// Helper function to determine the current meal period
const getCurrentMealPeriod = () => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  if (day >= 1 && day <= 5) { // Weekdays
    if (hour >= 7 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 16) return 'lunch';
    if (day === 5 && hour >= 16 && (hour < 19 || (hour === 19 && now.getMinutes() < 30))) return 'dinner';
    if (day >= 1 && day <= 4 && hour >= 16 && hour < 20) return 'dinner';
  }

  if (day === 6) { // Saturday
    if (hour >= 9 && hour < 10) return 'breakfast';
    if (hour >= 10 && hour < 13) return 'lunch';
    if (hour >= 17 && (hour < 19 || (hour === 19 && now.getMinutes() < 30))) return 'dinner';
  }

  if (day === 0) { // Sunday
    if ((hour > 11 || (hour === 11 && now.getMinutes() >= 30)) && (hour < 14 || (hour === 14 && now.getMinutes() < 30))) return 'lunch';
    if (hour >= 17 && (hour < 19 || (hour === 19 && now.getMinutes() < 30))) return 'dinner';
  }

  return 'breakfast'; // Default
};


// Helper function to calculate time remaining
const calculateTimeRemaining = (eventDate) => {
  const now = new Date();
  const diffMillis = eventDate.getTime() - now.getTime();

  if (diffMillis <= 0) return "Event in progress";

  const diffHours = diffMillis / (1000 * 60 * 60);

  if (diffHours < 24) {
    const hours = Math.ceil(diffHours);
    return `In ${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    const diffDays = diffHours / 24;
    const days = Math.ceil(diffDays);
    return `In ${days} day${days > 1 ? 's' : ''}`;
  }
};

// Robust date parsing function
const parseChapelDate = (timeString) => {
  if (!timeString) return null;
  const cleanedString = timeString.replace(' at ', ' ').replace(/,,/g, ',');
  const parts = cleanedString.match(/^(?:\w{3},\s)?(\w+)\s(\d{1,2}),\s(\d{4})\s(\d{1,2}):(\d{2})\s(AM|PM)/i);

  if (!parts) {
    console.error("Failed to parse date string with regex:", timeString);
    return null;
  }

  const [, monthStr, day, year, hourStr, minute, ampm] = parts;
  const monthMap = { "January": 0, "February": 1, "March": 2, "April": 3, "May": 4, "June": 5, "July": 6, "August": 7, "September": 8, "October": 9, "November": 10, "December": 11 };
  const fullMonthStr = Object.keys(monthMap).find(m => m.startsWith(monthStr));
  if (!fullMonthStr) {
    console.error(`Could not find full month for abbreviation: ${monthStr}`);
    return null;
  }
  const month = monthMap[fullMonthStr];
  let hour = parseInt(hourStr, 10);
  if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
  const eventDate = new Date(year, month, parseInt(day, 10), hour, parseInt(minute, 10));
  if (isNaN(eventDate.getTime())) {
    console.error("Created an invalid date from:", timeString);
    return null;
  }
  return eventDate;
};


// --- Arc Style Color Picker ---
const AdvancedColorPicker = ({ angle1, setAngle1, angle2, setAngle2 }) => {
    const pickerRef = useRef(null);
    const [dragging, setDragging] = useState(null);

    const angleToPos = (angle) => {
        const rad = angle * (Math.PI / 180);
        return {
            x: 50 + 50 * Math.cos(rad),
            y: 50 + 50 * Math.sin(rad),
        };
    };

    const posToAngle = (x, y, rect) => {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        let angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
        return (angle + 360) % 360;
    };

    const angleToHsl = (angle) => `hsl(${angle}, 80%, 70%)`;

    const handleInteraction = (e, handleId) => {
        const picker = pickerRef.current;
        if (!picker) return;
        const rect = picker.getBoundingClientRect();
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const angle = posToAngle(x, y, rect);

        if (handleId) {
            if (handleId === 'handle1') setAngle1(angle);
            else setAngle2(angle);
        } else {
            const pos1 = angleToPos(angle1);
            const pos2 = angleToPos(angle2);
            const clickPos = { x: (x / rect.width) * 100, y: (y / rect.height) * 100 };
            const dist1 = Math.hypot(clickPos.x - pos1.x, clickPos.y - pos1.y);
            const dist2 = Math.hypot(clickPos.x - pos2.x, clickPos.y - pos2.y);
            if (dist1 < dist2) setAngle1(angle);
            else setAngle2(angle);
        }
    };
    
    const handleStart = (e, handleId) => {
        e.stopPropagation();
        setDragging(handleId);
    };

    const handleMove = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();
        handleInteraction(e, dragging);
    }, [dragging, handleInteraction]);

    const handleEnd = useCallback(() => setDragging(null), []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [handleMove, handleEnd]);

    const handle1Pos = angleToPos(angle1);
    const handle2Pos = angleToPos(angle2);

    const gradientPresets = useMemo(() => [
        { name: 'Twilight', c1: '#7B7481', c2: '#ADD8E6' },
        { name: 'Sunrise', c1: '#ff7e5f', c2: '#feb47b' },
        { name: 'Ocean', c1: '#00c6ff', c2: '#0072ff' },
        { name: 'Mango', c1: '#22c1c3', c2: '#fdbb2d' },
        { name: 'Rose', c1: '#e55d87', c2: '#5fc3e4' },
        { name: 'Night', c1: '#2c3e50', c2: '#4ca1af' },
    ], []);

    const hexToHslAngle = (hex) => {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = "0x" + hex[1] + hex[1];
            g = "0x" + hex[2] + hex[2];
            b = "0x" + hex[3] + hex[3];
        } else if (hex.length === 7) {
            r = "0x" + hex[1] + hex[2];
            g = "0x" + hex[3] + hex[4];
            b = "0x" + hex[5] + hex[6];
        }
        r /= 255; g /= 255; b /= 255;
        let cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin, h = 0;
        if (delta === 0) h = 0;
        else if (cmax === r) h = ((g - b) / delta) % 6;
        else if (cmax === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        return h;
    };

    const handlePresetSelect = (preset) => {
        setAngle1(hexToHslAngle(preset.c1));
        setAngle2(hexToHslAngle(preset.c2));
    };

    const handleDefault = () => handlePresetSelect({ c1: '#7B7481', c2: '#ADD8E6' });

    return (
        <div className="advanced-color-picker">
             <div className="preset-swatches-container">
                {gradientPresets.map(p => (
                    <button key={p.name} className="color-swatch" style={{ background: `linear-gradient(45deg, ${p.c1}, ${p.c2})` }} onClick={() => handlePresetSelect(p)} />
                ))}
                <button className="default-color-button" onClick={handleDefault}>Default</button>
            </div>
            <div className="arc-picker-wrapper">
                <div ref={pickerRef} className="picker-area" onClick={(e) => handleInteraction(e, null)}>
                    <div className="picker-handle" style={{ left: `${handle1Pos.x}%`, top: `${handle1Pos.y}%`, backgroundColor: angleToHsl(angle1) }} onMouseDown={(e) => handleStart(e, 'handle1')} onTouchStart={(e) => handleStart(e, 'handle1')} />
                    <div className="picker-handle" style={{ left: `${handle2Pos.x}%`, top: `${handle2Pos.y}%`, backgroundColor: angleToHsl(angle2) }} onMouseDown={(e) => handleStart(e, 'handle2')} onTouchStart={(e) => handleStart(e, 'handle2')} />
                </div>
            </div>
        </div>
    );
};

// --- Settings Page Component ---
const SettingsPage = React.forwardRef(({ onBack, isChapelVisible, onToggleChapel, isAiVisible, onToggleAi, isSarcasticAi, onToggleSarcasticAi, silkAngle1, setSilkAngle1, silkAngle2, setSilkAngle2, triggerCardResize }, ref) => {
  const [activeTab, setActiveTab] = useState('General');
  const settingsPages = ['General', 'AI Settings', 'Appearance', 'About'];
  const contentRef = useRef(null);

  useLayoutEffect(() => {
    if (contentRef.current && triggerCardResize) {
        // Give react time to render the new content before resizing
        const timer = setTimeout(triggerCardResize, 50);
        gsap.fromTo(contentRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
        return () => clearTimeout(timer);
    }
  }, [activeTab, triggerCardResize]);

  const renderContent = () => {
    switch (activeTab) {
      case 'General':
        return (
          <div>
            <h3>General Settings</h3>
            <p>Configure general application settings here.</p>
            <ToggleSwitch label={isChapelVisible ? "Hide Chapel Schedule" : "Show Chapel Schedule"} isToggled={isChapelVisible} onToggle={onToggleChapel} />
          </div>
        );
      case 'AI Settings':
        return (
            <div>
                <h3>AI Settings</h3>
                <p>Control the AI features and personality.</p>
                <ToggleSwitch label={isAiVisible ? "Hide AI Helper" : "Show AI Helper"} isToggled={isAiVisible} onToggle={onToggleAi} />
                <ToggleSwitch label="Sarcastic AI" isToggled={isSarcasticAi} onToggle={onToggleSarcasticAi} />
            </div>
        );
      case 'Appearance':
        return (
            <div>
                <h3>Appearance</h3>
                <p>Change the background by dragging the bubbles.</p>
                <AdvancedColorPicker angle1={silkAngle1} setAngle1={setSilkAngle1} angle2={silkAngle2} setAngle2={setSilkAngle2} />
            </div>
        );
      case 'About':
        return <div><h3>About</h3><p>Biola Wizard 2.0</p><p>This Tool Was Built With The Assistance of AI</p><p>Unknown number of loads</p></div>;
      default: return null;
    }
  };

  return (
    <div ref={ref} className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
        <button onClick={onBack} className="back-button">Back to Meals</button>
      </div>
      <div className="settings-body">
        <div className="settings-nav">
          {settingsPages.map(page => ( <button key={page} className={`settings-nav-item ${activeTab === page ? 'active' : ''}`} onClick={() => setActiveTab(page)}>{page}</button>))}
        </div>
        <div className="settings-content" ref={contentRef}>{renderContent()}</div>
      </div>
    </div>
  );
});


function App() {
  const [activePage, setActivePage] = useState(getCurrentMealPeriod());
  const [menuData, setMenuData] = useState(null);
  const [chapelData, setChapelData] = useState(null);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [isChapelLoading, setIsChapelLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [chapelError, setChapelError] = useState(null);

  const [isChapelVisible, setIsChapelVisible] = useState(() => getCookie('chapelVisible') === 'true');
  const [isAiVisible, setIsAiVisible] = useState(() => getCookie('aiVisible') === 'true');
  const [isSarcasticAi, setIsSarcasticAi] = useState(() => getCookie('sarcasticAiVisible') === 'true');

  const [silkAngle1, setSilkAngle1] = useState(() => parseFloat(getCookie('silkAngle1')) || 270);
  const [silkAngle2, setSilkAngle2] = useState(() => parseFloat(getCookie('silkAngle2')) || 200);

  const [aiResponses, setAiResponses] = useState({});
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  const mealCardRef = useRef(null);
  const chapelCardRef = useRef(null);
  const mealContentRef = useRef(null);
  const pageContentRef = useRef(null);
  const chapelContentRef = useRef(null);
  const settingsContentRef = useRef(null);

  const stationWebhookUrl = "https://n8n.biolawizard.com/webhook/3666ea52-5393-408a-a9ef-f7c78f9c5eb4";

  const handleSettingsToggle = useCallback(() => {
    if (isSettingsVisible) return;
    const contentToFade = pageContentRef.current;
    if (!contentToFade) return;
    gsap.to(contentToFade, { opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: () => setIsSettingsVisible(true) });
  }, [isSettingsVisible]);

  const handleBackToMeals = useCallback(() => {
    if (!isSettingsVisible) return;
    const contentToFade = settingsContentRef.current;
    if (!contentToFade) return;
    gsap.to(contentToFade, { opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: () => setIsSettingsVisible(false) });
  }, [isSettingsVisible]);

  const navItemsTemplate = useMemo(() => [
    { label: "Other Things", textColor: "#fff", isGlass: true, glassBlur: 25, glassTransparency: 0.05, links: [ { label: "Donate to me :)", ariaLabel: "donate", href: "https://buymeacoffee.com/ephemeril", target: "_blank"}, { label: "Something else", ariaLabel: "About Careers" } ] },
    { label: "Settings", textColor: "#fff", isGlass: true, glassBlur: 25, glassTransparency: 0.05, links: [ { label: "Show AI", ariaLabel: "Toggle AI Helper", type: 'toggle', id: 'ai-toggle' }, { label: "Show Chapel Schedule", ariaLabel: "Toggle Chapel Schedule display", type: 'toggle', id: 'chapel-toggle' }, { label: "Settings", ariaLabel: "Open Settings Page", type: 'button', onClick: handleSettingsToggle } ] },
    { label: "Legacy Sites", textColor: "#ffffffff", isGlass: true, glassBlur: 25, glassTransparency: 0.05, links: [ { label: "Legacy", ariaLabel: "Legacy Site", href: "https://biolawizard.com/", target: "_blank" }, { label: "Extra Old", ariaLabel: "Extra Old Site", href: "https://google.com", target: "_blank" }, { label: "Caf Website", ariaLabel: "Caf Website", href: "https://cafebiola.cafebonappetit.com/cafe/cafe-biola/", target: "_blank" } ] }
  ], [handleSettingsToggle]);

  const triggerCardResize = useCallback(() => {
    if (mealCardRef.current && mealContentRef.current) {
      const targetHeight = mealContentRef.current.scrollHeight;
      gsap.to(mealCardRef.current, { height: targetHeight, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
    }
  }, []);

  const closeAiResponse = (stationName) => {
    const stationId = stationName.replace(/\s+/g, '-');
    const responseBox = document.getElementById(`ai-response-${stationId}`);
    if (responseBox) {
      gsap.to(responseBox, { height: 0, opacity: 0, marginTop: 0, duration: 0.6, ease: 'expo.in', onComplete: () => { setAiResponses(prev => { const newResponses = { ...prev }; delete newResponses[stationName]; return newResponses; }); } });
    }
  };

  const handleExplainStation = async (station) => {
    const stationName = station.name;
    if (aiResponses[stationName]) { closeAiResponse(stationName); return; }
    setAiResponses(prev => ({ ...prev, [stationName]: { isLoading: true, data: null, error: null } }));
    const payload = { station_meals: station.options.map(opt => ({ title: opt.meal, description: opt.description || "" })) };
    try {
      const response = await fetch(stationWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`Webhook failed with status: ${response.status}`);
      const result = await response.json();
      setAiResponses(prev => ({ ...prev, [stationName]: { isLoading: false, data: result.reply, error: null } }));
    } catch (error) {
      console.error("Webhook call failed:", error);
      setAiResponses(prev => ({ ...prev, [stationName]: { isLoading: false, data: null, error: 'Sorry, I couldn\'t get an explanation right now.' } }));
    }
  };

  const triggerChapelResize = useCallback(() => {
    if (chapelCardRef.current && chapelContentRef.current && isChapelVisible) {
      const targetHeight = chapelContentRef.current.scrollHeight;
      gsap.to(chapelCardRef.current, { height: targetHeight, duration: 0.5, ease: 'power2.inOut' });
    }
  }, [isChapelVisible]);

  useEffect(() => {
    const fetchMenu = async () => { setIsMenuLoading(true); try { const response = await fetch('/api/menu'); if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); const data = await response.json(); setMenuData(data); } catch (e) { setMenuError(e.message); } finally { setIsMenuLoading(false); } };
    const fetchChapel = async () => { setIsChapelLoading(true); try { const response = await fetch('/api/chapel'); if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); const data = await response.json(); setChapelData(data); } catch (e) { setChapelError(e.message); } finally { setIsChapelLoading(false); } };
    fetchMenu();
    fetchChapel();
  }, []);

  useLayoutEffect(() => { if (!isMenuLoading && mealContentRef.current && pageContentRef.current && !isSettingsVisible) { const content = pageContentRef.current; gsap.set(content, { opacity: 0 }); triggerCardResize(); gsap.to(content, { opacity: 1, duration: 0.4, delay: 0.3 }); } }, [activePage, isMenuLoading, triggerCardResize, isSettingsVisible]);
  useLayoutEffect(() => { if (isSettingsVisible && settingsContentRef.current) { triggerCardResize(); gsap.fromTo(settingsContentRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.1, ease: 'power2.out' }); } }, [isSettingsVisible, triggerCardResize]);
  useLayoutEffect(() => { if (isAiVisible) { gsap.fromTo(".explain-button", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.05, ease: 'back.out(1.7)' }); } }, [isAiVisible, activePage, menuData]);
  useLayoutEffect(() => { const mealCard = mealCardRef.current, chapelCard = chapelCardRef.current; const onAnimationComplete = () => { triggerCardResize(); triggerChapelResize(); }; const tl = gsap.timeline({ onComplete: onAnimationComplete }); if (isChapelVisible) { gsap.set(chapelCard, { display: 'block', height: 'auto' }); tl.to(mealCard, { width: '65%', duration: 0.6, ease: 'power3.inOut' }).fromTo(chapelCard, { width: '0%', opacity: 0, xPercent: -20 }, { width: '32%', opacity: 1, xPercent: 0, duration: 0.6, ease: 'power3.inOut' }, "<"); } else { if (chapelCard && chapelCard.style.display !== 'none') { const chapelContent = chapelContentRef.current; tl.to(chapelContent, { opacity: 0, duration: 0.25, ease: 'power1.in' }).to(mealCard, { width: '75%', duration: 0.6, ease: 'power3.inOut' }).to(chapelCard, { width: '0%', opacity: 0, xPercent: -20, duration: 0.6, ease: 'power3.inOut' }, "<").set(chapelCard, { display: 'none' }).set(chapelContent, { opacity: 1 }); } else { gsap.set(mealCard, { width: '75%' }); } } }, [isChapelVisible, triggerCardResize, triggerChapelResize]);
  useLayoutEffect(() => { if (!isChapelLoading && isChapelVisible) { const timer = setTimeout(triggerChapelResize, 50); return () => clearTimeout(timer); } }, [isChapelLoading, isChapelVisible, chapelData, triggerChapelResize]);

  useEffect(() => { const timer = setTimeout(triggerCardResize, 150); return () => clearTimeout(timer); }, [aiResponses, triggerCardResize]);

  useEffect(() => { setCookie('chapelVisible', isChapelVisible, 365); }, [isChapelVisible]);
  useEffect(() => { setCookie('aiVisible', isAiVisible, 365); }, [isAiVisible]);
  useEffect(() => { setCookie('sarcasticAiVisible', isSarcasticAi, 365); }, [isSarcasticAi]);
  useEffect(() => { setCookie('silkAngle1', silkAngle1, 365); }, [silkAngle1]);
  useEffect(() => { setCookie('silkAngle2', silkAngle2, 365); }, [silkAngle2]);

  const silkColor1 = useMemo(() => `hsl(${silkAngle1}, 80%, 70%)`, [silkAngle1]);
  const silkColor2 = useMemo(() => `hsl(${silkAngle2}, 80%, 70%)`, [silkAngle2]);

  const renderCardContent = () => {
    if (isMenuLoading) return <h2 style={{ textAlign: 'center' }}>Loading Menu</h2>;
    if (menuError) return <><h2>Oops!</h2><p>Could not load menu: {menuError}</p></>;
    if (!menuData) return <h2>No Menu Data</h2>;
    const mealPeriodData = menuData[activePage];
    const mealPeriodName = capitalizeWords(activePage);
    if (!mealPeriodData || mealPeriodData.length === 0) return <><h2 className="meal-period-title">{mealPeriodName}</h2><p>No items listed for this meal.</p></>;
    return (
      <div className="menu-content">
        <h2 className="meal-period-title">{mealPeriodName}</h2>
        {mealPeriodData.map((station, index) => {
          const stationId = station.name.replace(/\s+/g, '-');
          return (
            <div key={index} className="station">
              <div className="station-header"><h3 className="station-name">{station.name}</h3>{isAiVisible && <button className="explain-button" onClick={() => handleExplainStation(station)}>explain this</button>}</div>
              <ul className="meal-list">{station.options.map((item, itemIndex) => <MealItem key={itemIndex} item={{...item, meal: capitalizeWords(item.meal)}} onToggle={triggerCardResize} />)}</ul>
              {!!aiResponses[station.name] && <div id={`ai-response-${stationId}`}><AiResponse responseState={aiResponses[station.name]} onClose={() => closeAiResponse(station.name)} onCharTyped={triggerCardResize} /></div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderChapelContent = () => {
    if (isChapelLoading) return <><h2 className="meal-period-title">Chapel</h2><p>Loading Chapel...</p></>;
    if (chapelError) return <><h2 className="meal-period-title">Chapel</h2><p>Chapel events unavailable.</p></>;
    if (!chapelData || chapelData.length === 0) return <><h2 className="meal-period-title">Chapel</h2><p>No chapel events listed.</p></>;
    const upcomingEvents = chapelData.map(event => ({ ...event, dateObject: parseChapelDate(event.time) })).filter(event => event.dateObject && event.dateObject > new Date()).sort((a, b) => a.dateObject - b.dateObject).slice(0, 5);
    return (
      <>
        <h2 className="meal-period-title">Upcoming Chapel</h2>
        <div className="chapel-events-list">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event, index) => {
              const [datePart, timePart] = event.time.split(/ at /i);
              return (
                <div key={index} className="chapel-event-card">
                  <div className="chapel-event-content">
                    <div className="chapel-header"><h3 className="chapel-title">{event.title}</h3><span className="chapel-countdown">{calculateTimeRemaining(event.dateObject)}</span></div>
                    <div className="chapel-datetime"><p className="chapel-date">{datePart.replace(/,,/g, ',').replace(/,$/, '')}</p><p className="chapel-time">{timePart || ''}</p></div>
                    {event.description !== 'No description' && <p className="chapel-description">{event.description}</p>}
                  </div>
                </div>
              );
            })
          ) : <p>No upcoming chapel events found.</p>}
        </div>
      </>
    );
  };

  return (
    <div className="App">
      <div className="silk-container"><Silk speed={5} scale={1} color1={silkColor1} color2={silkColor2} noiseIntensity={1.5} rotation={0} /></div>
      <div className="content-area">
        <CardNav logo={logo} logoAlt="Company Logo" items={navItemsTemplate} menuColor="#fff" buttonBgColor="transparent" buttonTextColor="#fff" ease="power3.out" isGlass={true} glassBlur={15} glassTransparency={0.05} distortionScale={-80} ctaButtonText="--°F" isChapelVisible={isChapelVisible} onToggleChapel={() => setIsChapelVisible(!isChapelVisible)} isAiVisible={isAiVisible} onToggleAi={() => setIsAiVisible(!isAiVisible)} />
        <div className="card-container">
          <GlassSurface ref={mealCardRef} borderRadius={20} className="meal-card" distortionScale={-80}>
            <div className="card-content" ref={mealContentRef}>
              {isSettingsVisible ? (
                  <SettingsPage ref={settingsContentRef} onBack={handleBackToMeals} isChapelVisible={isChapelVisible} onToggleChapel={() => setIsChapelVisible(!isChapelVisible)} isAiVisible={isAiVisible} onToggleAi={() => setIsAiVisible(!isAiVisible)} isSarcasticAi={isSarcasticAi} onToggleSarcasticAi={() => setIsSarcasticAi(!isSarcasticAi)} silkAngle1={silkAngle1} setSilkAngle1={setSilkAngle1} silkAngle2={silkAngle2} setSilkAngle2={setSilkAngle2} triggerCardResize={triggerCardResize} />
              ) : ( <div ref={pageContentRef}>{renderCardContent()}</div> )}
              {!isSettingsVisible && (
                <div className="inner-nav-bar">
                  <button className={`inner-nav-button ${activePage === 'breakfast' ? 'active' : ''}`} onClick={() => setActivePage('breakfast')}>Breakfast</button>
                  <button className={`inner-nav-button ${activePage === 'lunch' ? 'active' : ''}`} onClick={() => setActivePage('lunch')}>Lunch</button>
                  <button className={`inner-nav-button ${activePage === 'dinner' ? 'active' : ''}`} onClick={() => setActivePage('dinner')}>Dinner</button>
                </div>
              )}
            </div>
          </GlassSurface>
          <GlassSurface ref={chapelCardRef} borderRadius={20} className="chapel-card"><div className="card-content chapel-card-wrapper" ref={chapelContentRef}>{renderChapelContent()}</div></GlassSurface>
        </div>
      </div>
    </div>
  );
}

export default App;