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
import ElasticSlider from './components/ElasticSlider';
import FeedbackModal from './components/Feedback.jsx';
import { getAnonymousId } from './utils/anonymousId';

// --- Console Log Catcher ---
// This code captures console messages so they can be sent with feedback.
let consoleLogs = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
  consoleLogs.push(`LOG: ${JSON.stringify(args)}`);
  originalLog(...args);
};
console.error = (...args) => {
  consoleLogs.push(`ERROR: ${JSON.stringify(args)}`);
  originalError(...args);
};
console.warn = (...args) => {
  consoleLogs.push(`WARN: ${JSON.stringify(args)}`);
  originalWarn(...args);
};
// ------------------------------

// --- Toast Component ---
const Toast = ({ message, show }) => {
  return (
    <div className={`toast-notification ${show ? 'show' : ''}`}>
      {message}
    </div>
  );
};

// --- Helper functions for managing cookies ---
const setCookie = (name, value, days) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + value + expires + "; path=/; SameSite=Lax";
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

// --- Data structure for daily meal hours ---
const DAILY_MEAL_HOURS = [
  // Sunday (0)
  { breakfast: null, lunch: '11:30 AM - 2:30 PM', dinner: '5:00 PM - 7:30 PM' },
  // Monday (1)
  { breakfast: '7:00 AM - 11:00 AM', lunch: '11:00 AM - 4:00 PM', dinner: '4:00 PM - 8:00 PM' },
  // Tuesday (2)
  { breakfast: '7:00 AM - 11:00 AM', lunch: '11:00 AM - 4:00 PM', dinner: '4:00 PM - 8:00 PM' },
  // Wednesday (3)
  { breakfast: '7:00 AM - 11:00 AM', lunch: '11:00 AM - 4:00 PM', dinner: '4:00 PM - 8:00 PM' },
  // Thursday (4)
  { breakfast: '7:00 AM - 11:00 AM', lunch: '11:00 AM - 4:00 PM', dinner: '4:00 PM - 8:00 PM' },
  // Friday (5)
  { breakfast: '7:00 AM - 11:00 AM', lunch: '11:00 AM - 4:00 PM', dinner: '4:00 PM - 7:30 PM' },
  // Saturday (6)
  { breakfast: '9:00 AM - 10:00 AM', lunch: '10:00 AM - 1:00 PM', dinner: '5:00 PM - 7:30 PM' }
];

// --- Helper function to get meal hours for the current day ---
const getMealHoursForToday = (mealPeriod) => {
  const todayIndex = new Date().getDay();
  const hours = DAILY_MEAL_HOURS[todayIndex][mealPeriod];
  return hours || "Not served today";
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
const AdvancedColorPicker = ({ angle1, setAngle1, angle2, setAngle2, saturation, setSaturation, lightness, setLightness }) => {
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

  const angleToHsl = (angle) => `hsl(${angle}, ${saturation}%, ${lightness}%)`;

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
    { name: 'Twilight', c1: '#756880ff', c2: '#ADD8E6' },
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
    let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin, h = 0;
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
    setSaturation(80);
    setLightness(70);
  };

  const handleDefault = () => {
    setAngle1(258); // Dark Purple
    setAngle2(238); // Light Purple
    setSaturation(5);
    setLightness(70);
  };

  const LowSatIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="url(#paint0_linear_1_2)" /><defs><linearGradient id="paint0_linear_1_2" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#E0E0E0" /><stop offset="1" stopColor="#BDBDBD" /></linearGradient></defs></svg>);
  const HighSatIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="url(#paint0_radial_1_3)" /><defs><radialGradient id="paint0_radial_1_3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12 12) rotate(90) scale(10)"><stop stopColor="#FF8A8A" /><stop offset="0.5" stopColor="#82B1FF" /><stop offset="1" stopColor="#B9F6CA" /></radialGradient></defs></svg>);
  const DarkIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#424242" /></svg>);
  const LightIcon = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#E0E0E0" /></svg>);

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
      <div className="sliders-wrapper">
        <div className="slider-control">
          <label>Saturation</label>
          <ElasticSlider value={saturation} onChange={setSaturation} maxValue={100} leftIcon={<LowSatIcon />} rightIcon={<HighSatIcon />} />
        </div>
        <div className="slider-control">
          <label>Lightness</label>
          <ElasticSlider value={lightness} onChange={setLightness} maxValue={100} leftIcon={<DarkIcon />} rightIcon={<LightIcon />} />
        </div>
      </div>
    </div>
  );
};

// --- Settings Page Component ---
const SettingsPage = React.forwardRef(({ onBack, isChapelVisible, onToggleChapel, isCreditsVisible, onToggleCreditsVisible, showMealHours, onToggleShowMealHours, isRatingVisible, onToggleRatingVisible, showRatingCount, onToggleShowRatingCount, isDayPickerVisible, onToggleDayPicker, isAiVisible, onToggleAi, isSarcasticAi, onToggleSarcasticAi, silkAngle1, setSilkAngle1, silkAngle2, setSilkAngle2, silkSaturation, setSilkSaturation, silkLightness, setSilkLightness, triggerCardResize }, ref) => {
  const [activeTab, setActiveTab] = useState('General');
  const [loadData, setLoadData] = useState(null);
  const settingsPages = ['General', 'AI Settings', 'Appearance', 'About'];
  const contentRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'About') {
      fetch(`${import.meta.env.VITE_API_BASE_URL}/get-loads`)
        .then(res => res.json())
        .then(data => {
          setLoadData(data);
        })
        .catch(console.error);
    }
  }, [activeTab]);

  useLayoutEffect(() => {
    if (contentRef.current && triggerCardResize) {
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
            <ToggleSwitch label={isDayPickerVisible ? "Hide Day Selector" : "Show Day Selector"} isToggled={isDayPickerVisible} onToggle={onToggleDayPicker} />
            <ToggleSwitch label={isChapelVisible ? "Hide Chapel Schedule" : "Show Chapel Schedule"} isToggled={isChapelVisible} onToggle={onToggleChapel} />
            <ToggleSwitch label={isCreditsVisible ? "Hide Credit Counter" : "Show Credit Counter"} isToggled={isCreditsVisible} onToggle={onToggleCreditsVisible} />
            <ToggleSwitch label={showMealHours ? "Hide Meal Times" : "Show Meal Times"} isToggled={showMealHours} onToggle={onToggleShowMealHours} />
            <ToggleSwitch label={isRatingVisible ? "Hide Rating System" : "Show Rating System"} isToggled={isRatingVisible} onToggle={onToggleRatingVisible} />
            {isRatingVisible && <ToggleSwitch label={showRatingCount ? "Hide Rating Count" : "Show Rating Count"} isToggled={showRatingCount} onToggle={onToggleShowRatingCount} />}
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
          <div className="appearance-settings">
            <h3>Appearance</h3>
            <p>Change the background by dragging the bubbles.</p>
            <AdvancedColorPicker
              angle1={silkAngle1} setAngle1={setSilkAngle1}
              angle2={silkAngle2} setAngle2={setSilkAngle2}
              saturation={silkSaturation} setSaturation={setSilkSaturation}
              lightness={silkLightness} setLightness={setSilkLightness}
            />
          </div>
        );
      case 'About':
        const todayData = loadData ? loadData[0] : null;
        return (
          <div>
            <h3>About</h3>
            <p>Biola Wizard 2.11</p>
            <p>By Gabriel Losh</p>
            <p>This Tool Was Built With The Assistance of AI</p>
            {loadData ? (
              <p>Page loads today: {todayData.count}</p>
            ) : (
              <p>Loading stats...</p>
            )}
          </div>
        );
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
          {settingsPages.map(page => (<button key={page} className={`settings-nav-item ${activeTab === page ? 'active' : ''}`} onClick={() => setActiveTab(page)}>{page}</button>))}
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
  const [anonymousId, setAnonymousId] = useState(null);

  // --- State for weekly menu and day picker ---
  const [weeklyMenuData, setWeeklyMenuData] = useState(null);
  const [isDayPickerOpen, setIsDayPickerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Today');


  const [showMenuLoader, setShowMenuLoader] = useState(false);
  const [showChapelLoader, setShowChapelLoader] = useState(false);

  const [isChapelVisible, setIsChapelVisible] = useState(() => getCookie('chapelVisible') === 'true');
  const [isCreditsVisible, setIsCreditsVisible] = useState(() => getCookie('creditsVisible') !== 'false');
  const [showMealHours, setShowMealHours] = useState(() => getCookie('showMealHours') !== 'false');
  const [isRatingVisible, setIsRatingVisible] = useState(() => getCookie('ratingVisible') !== 'false');
  const [isAiVisible, setIsAiVisible] = useState(() => getCookie('aiVisible') === 'true');
  const [isSarcasticAi, setIsSarcasticAi] = useState(() => getCookie('sarcasticAiVisible') === 'true');
  const [isDayPickerVisible, setIsDayPickerVisible] = useState(() => getCookie('dayPickerVisible') !== 'false');
  const [showRatingCount, setShowRatingCount] = useState(() => getCookie('showRatingCount') === 'true');

  const [silkAngle1, setSilkAngle1] = useState(() => parseFloat(getCookie('silkAngle1')) || 258);
  const [silkAngle2, setSilkAngle2] = useState(() => parseFloat(getCookie('silkAngle2')) || 238);
  const [silkSaturation, setSilkSaturation] = useState(() => parseFloat(getCookie('silkSaturation')) || 5);
  const [silkLightness, setSilkLightness] = useState(() => parseFloat(getCookie('silkLightness')) || 70);

  const [aiResponses, setAiResponses] = useState({});
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });

  const mealCardRef = useRef(null);
  const chapelCardRef = useRef(null);
  const mealContentRef = useRef(null);
  const pageContentRef = useRef(null);
  const chapelContentRef = useRef(null);
  const settingsContentRef = useRef(null);

  const effectRan = useRef(false);
  const isInitialLoad = useRef(true);

  const stationWebhookUrl = "https://n8n.biolawizard.com/webhook/3666ea52-5393-408a-a9ef-f7c78f9c5eb4";
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    setAnonymousId(getAnonymousId());
  }, []);

  useEffect(() => {
    if (effectRan.current === false) {
      fetch(`${API_BASE_URL}/record-load`, { method: 'POST' })
        .catch(err => console.error("Could not record page load:", err));
      effectRan.current = true;
    }
  }, [API_BASE_URL]);

  useEffect(() => { setCookie('chapelVisible', isChapelVisible, 365); }, [isChapelVisible]);
  useEffect(() => { setCookie('creditsVisible', isCreditsVisible, 365); }, [isCreditsVisible]);
  useEffect(() => { setCookie('showMealHours', showMealHours, 365); }, [showMealHours]);
  useEffect(() => { setCookie('ratingVisible', isRatingVisible, 365); }, [isRatingVisible]);
  useEffect(() => { setCookie('aiVisible', isAiVisible, 365); }, [isAiVisible]);
  useEffect(() => { setCookie('sarcasticAiVisible', isSarcasticAi, 365); }, [isSarcasticAi]);
  useEffect(() => { setCookie('dayPickerVisible', isDayPickerVisible, 365); }, [isDayPickerVisible]);
  useEffect(() => { setCookie('silkAngle1', silkAngle1, 365); }, [silkAngle1]);
  useEffect(() => { setCookie('silkAngle2', silkAngle2, 365); }, [silkAngle2]);
  useEffect(() => { setCookie('silkSaturation', silkSaturation, 365); }, [silkSaturation]);
  useEffect(() => { setCookie('silkSaturation', silkSaturation, 365); }, [silkSaturation]);
  useEffect(() => { setCookie('silkLightness', silkLightness, 365); }, [silkLightness]);
  useEffect(() => { setCookie('showRatingCount', showRatingCount, 365); }, [showRatingCount]);

  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 2500);
  }, []);

  const toggleSettingsPage = useCallback(() => {
    const contentToFadeOut = isSettingsVisible ? settingsContentRef.current : pageContentRef.current;
    if (!contentToFadeOut) {
      setIsSettingsVisible(v => !v);
      return;
    }
    gsap.to(contentToFadeOut, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => setIsSettingsVisible(v => !v)
    });
  }, [isSettingsVisible]);

  const toggleFeedbackModal = useCallback(() => {
    setIsFeedbackVisible(v => !v);
  }, []);

  const navItemsTemplate = useMemo(() => [
    { label: "Help", textColor: "#fff", isGlass: true, glassBlur: 25, glassTransparency: 0.05, links: [{ label: "Donate to me :)", ariaLabel: "donate", href: "https://buymeacoffee.com/ephemeril", target: "_blank" }, { label: "Send Feedback", ariaLabel: "Send Feedback", type: 'button', onClick: toggleFeedbackModal }] },
    { label: "Preferences", textColor: "#fff", isGlass: true, glassBlur: 25, glassTransparency: 0.05, links: [{ label: "Show AI", ariaLabel: "Toggle AI Helper", type: 'toggle', id: 'ai-toggle' }, { label: "Show Chapel Schedule", ariaLabel: "Toggle Chapel Schedule display", type: 'toggle', id: 'chapel-toggle' }, { label: "Settings", ariaLabel: "Open or Close Settings Page", type: 'button', onClick: toggleSettingsPage }] },
    { label: "Useful Links", textColor: "#ffffffff", isGlass: true, glassBlur: 25, glassTransparency: 0.05, links: [{ label: "Github", ariaLabel: "github", href: "https://github.com/Ephemerill/Ascipiter1.0", target: "_blank" }, { label: "Legacy", ariaLabel: "Legacy Site", href: "https://legacy.biolawizard.com/", target: "_blank" }, { label: "Caf Website", ariaLabel: "Caf Website", href: "https://cafebiola.cafebonappetit.com/cafe/cafe-biola/", target: "_blank" }] }
  ], [toggleSettingsPage, toggleFeedbackModal]);

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
    if (aiResponses[stationName]) {
      closeAiResponse(stationName);
      return;
    }
    setAiResponses(prev => ({ ...prev, [stationName]: { isLoading: true, data: null, error: null } }));

    const payload = {
      station_meals: station.options.map(opt => ({
        title: opt.meal,
        description: opt.description || ""
      }))
    };

    if (isSarcasticAi) {
      payload.extra_prompt = "Be cynical, the meal will probably not taste very good.";
    }

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
    let isMounted = true;
    const fetchMenuData = async () => {
      const loaderTimer = setTimeout(() => { if (isMounted) setShowMenuLoader(true); }, 300);
      try {
        const initialResponse = await fetch(`${API_BASE_URL}/menu`);
        if (!initialResponse.ok) throw new Error(`HTTP error! Status: ${initialResponse.status}`);
        const initialData = await initialResponse.json();
        if (isMounted) setMenuData(initialData);
      } catch (e) {
        if (isMounted) setMenuError(e.message);
      } finally {
        clearTimeout(loaderTimer);
        if (isMounted) setIsMenuLoading(false);
      }
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/menu/refresh`);
        if (refreshResponse.status === 200) {
          const newData = await refreshResponse.json();
          if (isMounted) setMenuData(newData);
        }
      } catch (e) {
        console.error("Error during background menu refresh:", e);
      }
    };

    const fetchChapel = async () => {
      if (!isMounted) return;
      const loaderTimer = setTimeout(() => { if (isMounted) setShowChapelLoader(true); }, 300);
      try {
        const response = await fetch(`${API_BASE_URL}/chapel`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        if (isMounted) setChapelData(data);
      } catch (e) {
        if (isMounted) setChapelError(e.message);
      } finally {
        clearTimeout(loaderTimer);
        if (isMounted) setIsChapelLoading(false);
      }
    };

    // Fetch weekly menu data
    const fetchWeeklyMenu = async () => {
      if (!isMounted) return;
      try {
        const response = await fetch(`${API_BASE_URL}/weekly-menu`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        if (isMounted) setWeeklyMenuData(data);
      } catch (e) {
        console.error("Could not fetch weekly menu:", e);
      }
    };

    fetchMenuData();
    fetchChapel();
    fetchWeeklyMenu();

    return () => { isMounted = false; };
  }, [API_BASE_URL]);

  useLayoutEffect(() => {
    if (isMenuLoading || !mealCardRef.current || !mealContentRef.current || !pageContentRef.current || isSettingsVisible) return;
    const card = mealCardRef.current;
    const content = pageContentRef.current;
    const targetHeight = mealContentRef.current.scrollHeight;

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      const tl = gsap.timeline();
      tl.fromTo(card, { height: 0, opacity: 0 }, { height: targetHeight, opacity: 1, duration: 0.8, ease: 'expo.out' });
      tl.fromTo(content, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, "-=0.6");
    } else {
      triggerCardResize();
      gsap.fromTo(content, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.1 });
    }
  }, [isMenuLoading, activePage, isSettingsVisible, triggerCardResize, selectedDay]);

  useLayoutEffect(() => { if (isSettingsVisible && settingsContentRef.current) { triggerCardResize(); gsap.fromTo(settingsContentRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.1, ease: 'power2.out' }); } }, [isSettingsVisible, triggerCardResize]);
  useLayoutEffect(() => { if (isAiVisible) { gsap.fromTo(".explain-button", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.05, ease: 'back.out(1.7)' }); } }, [isAiVisible, activePage, menuData, selectedDay]);
  useLayoutEffect(() => { const mealCard = mealCardRef.current, chapelCard = chapelCardRef.current; const onAnimationComplete = () => { triggerCardResize(); triggerChapelResize(); }; const tl = gsap.timeline({ onComplete: onAnimationComplete }); if (isChapelVisible) { gsap.set(chapelCard, { display: 'block', height: 'auto' }); tl.to(mealCard, { width: '65%', duration: 0.6, ease: 'power3.inOut' }).fromTo(chapelCard, { width: '0%', opacity: 0, xPercent: -20 }, { width: '32%', opacity: 1, xPercent: 0, duration: 0.6, ease: 'power3.inOut' }, "<"); } else { if (chapelCard && chapelCard.style.display !== 'none') { const chapelContent = chapelContentRef.current; tl.to(chapelContent, { opacity: 0, duration: 0.25, ease: 'power1.in' }).to(mealCard, { width: '75%', duration: 0.6, ease: 'power3.inOut' }).to(chapelCard, { width: '0%', opacity: 0, xPercent: -20, duration: 0.6, ease: 'power3.inOut' }, "<").set(chapelCard, { display: 'none' }).set(chapelContent, { opacity: 1 }); } else { gsap.set(mealCard, { width: '75%' }); } } }, [isChapelVisible, triggerCardResize, triggerChapelResize]);
  useLayoutEffect(() => { if (!isChapelLoading && isChapelVisible) { const timer = setTimeout(triggerChapelResize, 50); return () => clearTimeout(timer); } }, [isChapelLoading, isChapelVisible, chapelData, triggerChapelResize]);
  useEffect(() => { const timer = setTimeout(triggerCardResize, 150); return () => clearTimeout(timer); }, [aiResponses, triggerCardResize]);

  const silkColor1 = useMemo(() => `hsl(${silkAngle1}, ${silkSaturation}%, ${silkLightness}%)`, [silkAngle1, silkSaturation, silkLightness]);
  const silkColor2 = useMemo(() => `hsl(${silkAngle2}, ${silkSaturation}%, ${silkLightness}%)`, [silkAngle2, silkSaturation, silkLightness]);

  // Helper to transform weekly data to match daily data structure
  const transformWeeklyDayMenu = (dayMenu) => {
    if (!dayMenu) return null;
    const transformed = {};
    for (const mealPeriod in dayMenu) { // Breakfast, Lunch, Dinner
      const stations = dayMenu[mealPeriod];
      const stationArray = [];
      for (const stationName in stations) {
        stationArray.push({
          name: stationName,
          options: stations[stationName].map(mealName => ({ meal: mealName, description: null }))
        });
      }
      transformed[mealPeriod.toLowerCase()] = stationArray;
    }
    return transformed;
  };

  // Memoized value to determine which menu to display
  const displayedMenu = useMemo(() => {
    if (selectedDay === 'Today' || !weeklyMenuData) {
      return menuData;
    }
    const dayData = weeklyMenuData[selectedDay];
    return transformWeeklyDayMenu(dayData);
  }, [selectedDay, menuData, weeklyMenuData]);

  // Logic to get available future days in correct order
  const futureDays = useMemo(() => {
    if (!weeklyMenuData) return [];

    // Canonical order
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    // Map JS Date's getDay() index (Sun=0) to our abbreviation
    const jsDayToAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayAbbr = jsDayToAbbr[new Date().getDay()];

    // Find the index of today in our canonical order
    const todayIndexInOrder = dayOrder.indexOf(todayAbbr);

    if (todayIndexInOrder === -1) {
      return dayOrder.filter(day => weeklyMenuData[day]);
    }

    // Filter for all FUTURE days that exist in scraped data (excluding today)
    return dayOrder.filter((day, index) => index > todayIndexInOrder && weeklyMenuData[day]);
  }, [weeklyMenuData]);


  const handleDaySelect = (day) => {
    setSelectedDay(day);
    setIsDayPickerOpen(false);
  };


  const renderCardContent = () => {
    if (isMenuLoading) {
      return showMenuLoader ? <h2 style={{ textAlign: 'center' }}>Loading Menu</h2> : null;
    }
    if (menuError) return <><h2>Oops!</h2><p>Could not load menu: {menuError}</p></>;
    if (!displayedMenu) return <h2>No Menu Data for {selectedDay}</h2>;

    const mealPeriodData = displayedMenu[activePage];
    const dayNameMap = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
    const titleDayPart = selectedDay === 'Today' ? '' : (dayNameMap[selectedDay] || selectedDay);
    const mealPeriodName = `${titleDayPart} ${capitalizeWords(activePage)}`.trim();

    const todaysHours = getMealHoursForToday(activePage);

    if (!mealPeriodData || mealPeriodData.length === 0) {
      return (
        <>
          <h2 className="meal-period-title">{mealPeriodName}</h2>
          {showMealHours && selectedDay === 'Today' && <p className="meal-period-hours">{todaysHours}</p>}
          <p>No items listed for this meal.</p>
        </>
      );
    }
    return (
      <div className="menu-content">
        <h2 className="meal-period-title">{mealPeriodName}</h2>
        {showMealHours && selectedDay === 'Today' && <p className="meal-period-hours">{todaysHours}</p>}
        {mealPeriodData.map((station, index) => {
          const stationId = station.name.replace(/\s+/g, '-');
          return (
            <div key={index} className="station">
              <div className="station-header"><h3 className="station-name">{station.name}</h3>{isAiVisible && <button className="explain-button" onClick={() => handleExplainStation(station)}>explain this</button>}</div>
              <ul className="meal-list">{station.options.map((item, itemIndex) => <MealItem key={itemIndex} item={{ ...item, meal: capitalizeWords(item.meal) }} onToggle={triggerCardResize} anonymousId={anonymousId} stationName={station.name} isRatingVisible={isRatingVisible && selectedDay === 'Today'} showRatingCount={showRatingCount} />)}</ul>
              {!!aiResponses[station.name] && <div id={`ai-response-${stationId}`}><AiResponse responseState={aiResponses[station.name]} onClose={() => closeAiResponse(station.name)} onCharTyped={triggerCardResize} /></div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderChapelContent = () => {
    if (isChapelLoading) {
      return showChapelLoader ? <><h2 className="meal-period-title">Chapel</h2><p>Loading Chapel...</p></> : null;
    }
    if (chapelError) return <><h2 className="meal-period-title">Chapel</h2><p>Chapel events unavailable.</p></>;
    if (!chapelData || chapelData.length === 0) return <><h2 className="meal-period-title">Chapel</h2><p>No chapel events listed.</p></>;

    const allUpcomingEvents = chapelData
      .map(event => ({ ...event, dateObject: parseChapelDate(event.time) }))
      .filter(event => event.dateObject && event.dateObject > new Date());

    const remainingCredits = allUpcomingEvents.length;

    const eventsToDisplay = allUpcomingEvents
      .sort((a, b) => a.dateObject - b.dateObject)
      .slice(0, 5);

    return (
      <>
        <h2 className="meal-period-title">Upcoming Chapel</h2>
        {isCreditsVisible && <p className="chapel-credit-counter">Total credits remaining: {remainingCredits}</p>}
        <div className="chapel-events-list">
          {eventsToDisplay.length > 0 ? (
            eventsToDisplay.map((event, index) => {
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
      <Toast message={toast.message} show={toast.show} />
      <div className="silk-container"><Silk speed={5} scale={1} color1={silkColor1} color2={silkColor2} noiseIntensity={1.5} rotation={0} /></div>
      <div className="content-area">
        <CardNav logo={logo} logoAlt="Company Logo" items={navItemsTemplate} menuColor="#fff" buttonBgColor="transparent" buttonTextColor="#fff" ease="power3.out" isGlass={true} glassBlur={15} glassTransparency={0.05} distortionScale={-80} ctaButtonText="--°F" isChapelVisible={isChapelVisible} onToggleChapel={() => setIsChapelVisible(!isChapelVisible)} isAiVisible={isAiVisible} onToggleAi={() => setIsAiVisible(!isAiVisible)} />
        <div className="card-container">
          <GlassSurface ref={mealCardRef} borderRadius={20} className="meal-card" distortionScale={-80}>
            <div className="card-content" ref={mealContentRef}>
              {isSettingsVisible ? (
                <SettingsPage
                  ref={settingsContentRef}
                  onBack={toggleSettingsPage}
                  isChapelVisible={isChapelVisible} onToggleChapel={() => setIsChapelVisible(!isChapelVisible)}
                  isCreditsVisible={isCreditsVisible} onToggleCreditsVisible={() => setIsCreditsVisible(!isCreditsVisible)}
                  showMealHours={showMealHours} onToggleShowMealHours={() => setShowMealHours(!showMealHours)}
                  isRatingVisible={isRatingVisible}
                  onToggleRatingVisible={() => setIsRatingVisible(v => !v)}
                  showRatingCount={showRatingCount}
                  onToggleShowRatingCount={() => setShowRatingCount(v => !v)}
                  isDayPickerVisible={isDayPickerVisible}
                  onToggleDayPicker={() => setIsDayPickerVisible(!isDayPickerVisible)}
                  isAiVisible={isAiVisible} onToggleAi={() => setIsAiVisible(!isAiVisible)}
                  isSarcasticAi={isSarcasticAi} onToggleSarcasticAi={() => setIsSarcasticAi(!isSarcasticAi)}
                  silkAngle1={silkAngle1} setSilkAngle1={setSilkAngle1}
                  silkAngle2={silkAngle2} setSilkAngle2={setSilkAngle2}
                  silkSaturation={silkSaturation} setSilkSaturation={setSilkSaturation}
                  silkLightness={silkLightness} setSilkLightness={setSilkLightness}
                  triggerCardResize={triggerCardResize} />
              ) : (<div ref={pageContentRef}>{renderCardContent()}</div>)}
              {!isSettingsVisible && (
                <div className="bottom-controls-container">
                  {isDayPickerVisible && (
                    <div className="day-picker-container">
                      <button className="day-picker-toggle" onClick={() => setIsDayPickerOpen(!isDayPickerOpen)}>
                        <span>{selectedDay}</span>
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg" className={`chevron-icon ${isDayPickerOpen ? 'open' : ''}`}><path d="M1.41 0.59L6 5.17L10.59 0.59L12 2L6 8L0 2L1.41 0.59Z" fill="white" /></svg>
                      </button>
                      <div className={`day-options-container ${isDayPickerOpen ? 'open' : ''}`}>
                        <button className={`day-option-button ${selectedDay === 'Today' ? 'active' : ''}`} onClick={() => handleDaySelect('Today')}>Today</button>
                        {futureDays.map(day => (
                          <button key={day} className={`day-option-button ${selectedDay === day ? 'active' : ''}`} onClick={() => handleDaySelect(day)}>{day}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="inner-nav-bar">
                    <button className={`inner-nav-button ${activePage === 'breakfast' ? 'active' : ''}`} onClick={() => setActivePage('breakfast')}>Breakfast</button>
                    <button className={`inner-nav-button ${activePage === 'lunch' ? 'active' : ''}`} onClick={() => setActivePage('lunch')}>Lunch</button>
                    <button className={`inner-nav-button ${activePage === 'dinner' ? 'active' : ''}`} onClick={() => setActivePage('dinner')}>Dinner</button>
                  </div>
                </div>
              )}
            </div>
          </GlassSurface>
          <GlassSurface ref={chapelCardRef} borderRadius={20} className="chapel-card"><div className="card-content chapel-card-wrapper" ref={chapelContentRef}>{renderChapelContent()}</div></GlassSurface>
        </div>
      </div>

      {isFeedbackVisible && (
        <div className="feedback-modal-backdrop">
          <GlassSurface borderRadius={20} className="feedback-modal-container">
            <FeedbackModal onClose={toggleFeedbackModal} consoleLogs={consoleLogs} showToast={showToast} />
          </GlassSurface>
        </div>
      )}
    </div>
  );
}

export default App;