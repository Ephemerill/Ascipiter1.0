// frontend/src/App.jsx

import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import GlassSurface from './components/GlassSurface';
import './App.css';
import Silk from './components/Silk';
import CardNav from './components/CardNav';
import logo from './assets/logo.svg';
import MealItem from './components/MealItem';

// --- MODIFIED: Added 'type' and 'id' to the Show AI link ---
const navItemsTemplate = [
  {
    label: "Other Things",
    textColor: "#fff",
    isGlass: true,
    glassBlur: 25,
    glassTransparency: 0.05,
    links: [
      { label: "Donate to me :)", ariaLabel: "donate", href: "https://buymeacoffee.com/ephemeril", target: "_blank"},
      { label: "Something else", ariaLabel: "About Careers" }
    ]
  },
  {
    label: "Settings",
    textColor: "#fff",
    isGlass: true,
    glassBlur: 25,
    glassTransparency: 0.05,
    links: [
      { 
        label: "Show AI", 
        ariaLabel: "Toggle AI Helper", 
        type: 'toggle', 
        id: 'ai-toggle' 
      },
      {
        label: "Show Chapel Schedule",
        ariaLabel: "Toggle Chapel Schedule display",
        type: 'toggle',
        id: 'chapel-toggle'
      },
      { label: "Sarcastic AI", ariaLabel: "Sarcasm" }
    ]
  },
  {
    label: "Legacy Sites",
    textColor: "#ffffffff",
    isGlass: true,
    glassBlur: 25,
    glassTransparency: 0.05,
    links: [
      { label: "Legacy", ariaLabel: "Legacy Site", href: "https://biolawizard.com/", target: "_blank" },
      { label: "Extra Old", ariaLabel: "Extra Old Site", href: "https://google.com", target: "_blank" },
      { label: "Caf Website", ariaLabel: "Caf Website", href: "https://cafebiola.cafebonappetit.com/cafe/cafe-biola/", target: "_blank" }
    ]
  }
];

// Helper function to capitalize each word in a string
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

  if (day >= 1 && day <= 5) {
    if (hour >= 7 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 16) return 'lunch';
    if (day === 5 && hour >= 16 && (hour < 19 || (hour === 19 && now.getMinutes() < 30))) return 'dinner';
    if (day >= 1 && day <= 4 && hour >= 16 && hour < 20) return 'dinner';
  }

  if (day === 6) {
    if (hour >= 9 && hour < 10) return 'breakfast';
    if (hour >= 10 && hour < 13) return 'lunch';
    if (hour >= 17 && (hour < 19 || (hour === 19 && now.getMinutes() < 30))) return 'dinner';
  }

  if (day === 0) {
    if ((hour > 11 || (hour === 11 && now.getMinutes() >= 30)) && (hour < 14 || (hour === 14 && now.getMinutes() < 30))) return 'lunch';
    if (hour >= 17 && (hour < 19 || (hour === 19 && now.getMinutes() < 30))) return 'dinner';
  }

  return 'breakfast';
};


// Helper function to calculate time until the event
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


function App() {
  const [activePage, setActivePage] = useState(getCurrentMealPeriod());
  const [menuData, setMenuData] = useState(null);
  const [chapelData, setChapelData] = useState(null);

  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [isChapelLoading, setIsChapelLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [chapelError, setChapelError] = useState(null);

  const [isChapelVisible, setIsChapelVisible] = useState(false);
  const [isAiVisible, setIsAiVisible] = useState(false);

  const mealCardRef = useRef(null);
  const chapelCardRef = useRef(null);
  const mealContentRef = useRef(null);
  const pageContentRef = useRef(null);
  const chapelContentRef = useRef(null);

  const triggerCardResize = useCallback(() => {
    if (mealCardRef.current && mealContentRef.current) {
      const targetHeight = mealContentRef.current.scrollHeight;
      gsap.to(mealCardRef.current, { height: targetHeight, duration: 0.5, ease: 'power2.inOut' });
    }
  }, []);

  const triggerChapelResize = useCallback(() => {
    if (chapelCardRef.current && chapelContentRef.current && isChapelVisible) {
      const targetHeight = chapelContentRef.current.scrollHeight;
      gsap.to(chapelCardRef.current, { height: targetHeight, duration: 0.5, ease: 'power2.inOut' });
    }
  }, [isChapelVisible]);

  useEffect(() => {
    const fetchMenu = async () => {
      setIsMenuLoading(true);
      try {
        const response = await fetch('/api/menu');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        setMenuData(data);
        setMenuError(null);
      } catch (e) {
        if (e instanceof SyntaxError) {
          setMenuError("Failed to parse server response. Expected JSON.");
        } else {
          setMenuError(e.message);
        }
      } finally {
        setIsMenuLoading(false);
      }
    };

    const fetchChapel = async () => {
      setIsChapelLoading(true);
      try {
        const response = await fetch('/api/chapel');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        setChapelData(data);
        setChapelError(null);
      } catch (e) {
        if (e instanceof SyntaxError) {
          setChapelError("Failed to parse server response. Expected JSON.");
        } else {
          setChapelError(e.message);
        }
      } finally {
        setIsChapelLoading(false);
      }
    };
    fetchMenu();
    fetchChapel();
  }, []);

  useLayoutEffect(() => {
    if (!isMenuLoading && mealContentRef.current && pageContentRef.current) {
      const content = pageContentRef.current;
      gsap.set(content, { opacity: 0 });
      triggerCardResize();
      gsap.to(content, { opacity: 1, duration: 0.4, delay: 0.3 });
    }
  }, [activePage, isMenuLoading, triggerCardResize]);

  useLayoutEffect(() => {
    if (isAiVisible) {
      gsap.fromTo(".explain-button", 
        { opacity: 0, scale: 0.8 }, 
        { 
          opacity: 1, 
          scale: 1, 
          duration: 0.5, 
          stagger: 0.05, 
          ease: 'back.out(1.7)' 
        }
      );
    }
  }, [isAiVisible, activePage, menuData]);

  useLayoutEffect(() => {
    const mealCard = mealCardRef.current, chapelCard = chapelCardRef.current, chapelContent = chapelContentRef.current;
    const onAnimationComplete = () => { triggerCardResize(); triggerChapelResize(); };
    const tl = gsap.timeline({ onComplete: onAnimationComplete });
    if (isChapelVisible) {
      gsap.set(chapelCard, { display: 'block', height: 'auto' });
      tl.to(mealCard, { width: '65%', duration: 0.6, ease: 'power3.inOut' })
        .fromTo(chapelCard, { width: '0%', opacity: 0, xPercent: -20 }, { width: '32%', opacity: 1, xPercent: 0, duration: 0.6, ease: 'power3.inOut' }, "<");
    } else {
      if (chapelCard && chapelCard.style.display !== 'none') {
        tl.to(chapelContent, { opacity: 0, duration: 0.25, ease: 'power1.in' })
          .to(mealCard, { width: '75%', duration: 0.6, ease: 'power3.inOut' })
          .to(chapelCard, { width: '0%', opacity: 0, xPercent: -20, duration: 0.6, ease: 'power3.inOut' }, "<")
          .set(chapelCard, { display: 'none' })
          .set(chapelContent, { opacity: 1 });
      } else {
        gsap.set(mealCard, { width: '75%' });
      }
    }
  }, [isChapelVisible, triggerCardResize, triggerChapelResize]);

  useLayoutEffect(() => {
    if (!isChapelLoading && isChapelVisible) {
      const timer = setTimeout(triggerChapelResize, 50);
      return () => clearTimeout(timer);
    }
  }, [isChapelLoading, isChapelVisible, chapelData, triggerChapelResize]);

  const renderCardContent = () => {
    if (isMenuLoading) return <h2 style={{ textAlign: 'center' }}>Loading Menu</h2>;
    if (menuError) return <><h2>Oops!</h2><p>Could not load the menu: {menuError}</p></>;
    if (!menuData) return <h2>No Menu Data</h2>;
    const mealPeriodData = menuData[activePage];
    const mealPeriodName = activePage.charAt(0).toUpperCase() + activePage.slice(1);
    if (!mealPeriodData || mealPeriodData.length === 0) {
      return <><h2 className="meal-period-title">{mealPeriodName}</h2><p>No items are listed for this meal today.</p></>;
    }

    return (
      <div className="menu-content">
        <h2 className="meal-period-title">{mealPeriodName}</h2>
        {mealPeriodData.map((station, index) => (
          <div key={index} className="station">
            <div className="station-header">
              <h3 className="station-name">{station.name}</h3>
              {isAiVisible && (
                <div className="explain-button-container">
                  <button className="explain-button">explain this</button>
                </div>
              )}
            </div>
            <ul className="meal-list">
              {station.options.map((item, itemIndex) => {
                const displayItem = { ...item, meal: capitalizeWords(item.meal) };
                return <MealItem key={itemIndex} item={displayItem} onToggle={triggerCardResize} />;
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  };
  
  const renderChapelContent = () => {
    if (isChapelLoading) return <><h2 className="meal-period-title">Chapel</h2><p>Loading Chapel...</p></>;
    if (chapelError) return <><h2 className="meal-period-title">Chapel</h2><p>Chapel events are currently unavailable. Well this is awkward.</p></>;
    if (!chapelData || chapelData.length === 0) return <><h2 className="meal-period-title">Chapel</h2><p style={{ textAlign: 'center' }}>No chapel events listed for today. Well this is awkward.</p></>;

    const now = new Date();
    const upcomingEvents = chapelData
      .map(event => {
        const eventDate = parseChapelDate(event.time);
        return { ...event, dateObject: eventDate };
      })
      .filter(event => event.dateObject && event.dateObject > now)
      .sort((a, b) => a.dateObject - b.dateObject)
      .slice(0, 5);

    return (
      <>
        <h2 className="meal-period-title">Upcoming Chapel</h2>
        <div className="chapel-events-list">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event, index) => {
              const timeParts = event.time.split(/ at /i);
              const datePart = timeParts[0].replace(/,,/g, ',').replace(/,$/, '');
              const timePart = timeParts.length > 1 ? timeParts[1] : '';
              const timeRemaining = calculateTimeRemaining(event.dateObject);

              return (
                <div key={index} className="chapel-event-card">
                  <div className="chapel-event-content">
                    <div className="chapel-header">
                      <h3 className="chapel-title">{event.title}</h3>
                      <span className="chapel-countdown">{timeRemaining}</span>
                    </div>
                    <div className="chapel-datetime">
                      <p className="chapel-date">{datePart}</p>
                      <p className="chapel-time">{timePart}</p>
                    </div>
                    {event.description !== 'No description' && (
                      <p className="chapel-description">{event.description}</p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p>No upcoming chapel events found. Well this is awkward.</p>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="App">
      <div className="silk-container">
        <Silk speed={5} scale={1} color="#7B7481" noiseIntensity={1.5} rotation={0} />
      </div>
      <div className="content-area">
        <CardNav 
            logo={logo} 
            logoAlt="Company Logo" 
            items={navItemsTemplate} 
            menuColor="#fff" 
            buttonBgColor="transparent" 
            buttonTextColor="#fff" 
            ease="power3.out" 
            isGlass={true} 
            glassBlur={15} 
            glassTransparency={0.05} 
            distortionScale={-80} 
            ctaButtonText="--°F"
            isChapelVisible={isChapelVisible}
            onToggleChapel={() => setIsChapelVisible(!isChapelVisible)}
            isAiVisible={isAiVisible}
            onToggleAi={() => setIsAiVisible(!isAiVisible)}
        />
        <div className="card-container">
          <GlassSurface ref={mealCardRef} borderRadius={20} className="meal-card" distortionScale={-80}>
            <div className="card-content" ref={mealContentRef}>
              <div ref={pageContentRef}>
                {renderCardContent()}
              </div>
              <div className="inner-nav-bar">
                <button className={`inner-nav-button ${activePage === 'breakfast' ? 'active' : ''}`} onClick={() => setActivePage('breakfast')}>Breakfast</button>
                <button className={`inner-nav-button ${activePage === 'lunch' ? 'active' : ''}`} onClick={() => setActivePage('lunch')}>Lunch</button>
                <button className={`inner-nav-button ${activePage === 'dinner' ? 'active' : ''}`} onClick={() => setActivePage('dinner')}>Dinner</button>
              </div>
            </div>
          </GlassSurface>
          <GlassSurface ref={chapelCardRef} borderRadius={20} className="chapel-card">
            <div className="card-content chapel-card-wrapper" ref={chapelContentRef}>{renderChapelContent()}</div>
          </GlassSurface>
        </div>
      </div>
    </div>
  );
}

export default App;