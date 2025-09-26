import React, { useState, useRef, useLayoutEffect, useEffect, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import GlassSurface from './components/GlassSurface';
import './App.css';
import Silk from './components/Silk';
import CardNav from './components/CardNav';
import logo from './assets/logo.svg';
import MealItem from './components/MealItem';
import AiResponse from './components/AiResponse';

// --- NEW: Helper functions for managing cookies ---
const setCookie = (name, value, days) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  // Add SameSite=Lax for modern browser security
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

// --- NEW: Settings Page Component ---
const SettingsPage = React.forwardRef(({ onBack }, ref) => {
  return (
    <div ref={ref} className="settings-content">
      <h2>Settings</h2>
      <p>This is where settings for the Sarcastic AI will go.</p>
      <button onClick={onBack}>Back to Meals</button>
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

  const [aiResponses, setAiResponses] = useState({});
  const [isSettingsVisible, setIsSettingsVisible] = useState(false); // State for settings page

  const mealCardRef = useRef(null);
  const chapelCardRef = useRef(null);
  const mealContentRef = useRef(null);
  const pageContentRef = useRef(null);
  const chapelContentRef = useRef(null);
  const settingsContentRef = useRef(null); // Ref for settings page content

  const stationWebhookUrl = "https://n8n.biolawizard.com/webhook/3666ea52-5393-408a-a9ef-f7c78f9c5eb4";

  const handleSettingsToggle = useCallback(() => {
    if (isSettingsVisible || !pageContentRef.current) return;

    gsap.to(pageContentRef.current, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
            setIsSettingsVisible(true);
        }
    });
  }, [isSettingsVisible]);

  const handleBackToMeals = useCallback(() => {
    if (!isSettingsVisible || !settingsContentRef.current) return;
    
    gsap.to(settingsContentRef.current, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
            setIsSettingsVisible(false);
        }
    });
  }, [isSettingsVisible]);

  const navItemsTemplate = useMemo(() => [
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
        { label: "Settings", ariaLabel: "Open Settings Page", type: 'button', onClick: handleSettingsToggle }
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
  ], [handleSettingsToggle]);

  const triggerCardResize = useCallback(() => {
    if (mealCardRef.current && mealContentRef.current) {
      const targetHeight = mealContentRef.current.scrollHeight;
      gsap.to(mealCardRef.current, {
        height: targetHeight,
        duration: 0.5,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    }
  }, []);

  const closeAiResponse = (stationName) => {
    const stationId = stationName.replace(/\s+/g, '-');
    const responseBox = document.getElementById(`ai-response-${stationId}`);
    if (responseBox) {
      gsap.to(responseBox, {
        height: 0,
        opacity: 0,
        marginTop: 0,
        duration: 0.6,
        ease: 'expo.in',
        onComplete: () => {
          setAiResponses(prev => {
            const newResponses = { ...prev };
            delete newResponses[stationName];
            return newResponses;
          });
        }
      });
    }
  };

  const handleExplainStation = async (station) => {
    const stationName = station.name;

    if (aiResponses[stationName]) {
      closeAiResponse(stationName);
      return;
    }

    setAiResponses(prev => ({ ...prev, [stationName]: { isLoading: true, data: null, error: null } }));

    const mealsPayload = station.options.map(opt => ({
      title: opt.meal,
      description: opt.description || ""
    }));
    const payload = { station_meals: mealsPayload };

    try {
      const response = await fetch(stationWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

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
    const fetchMenu = async () => {
      setIsMenuLoading(true);
      try {
        const response = await fetch('/api/menu');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        setMenuData(data);
        setMenuError(null);
      } catch (e) {
        setMenuError(e instanceof SyntaxError ? "Failed to parse server response." : e.message);
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
        setChapelError(e instanceof SyntaxError ? "Failed to parse server response." : e.message);
      } finally {
        setIsChapelLoading(false);
      }
    };
    fetchMenu();
    fetchChapel();
  }, []);

  useLayoutEffect(() => {
    if (!isMenuLoading && mealContentRef.current && pageContentRef.current && !isSettingsVisible) {
      const content = pageContentRef.current;
      gsap.set(content, { opacity: 0 });
      triggerCardResize();
      gsap.to(content, { opacity: 1, duration: 0.4, delay: 0.3 });
    }
  }, [activePage, isMenuLoading, triggerCardResize, isSettingsVisible]);
  
  useLayoutEffect(() => {
    if (isSettingsVisible) {
      if (settingsContentRef.current) {
        triggerCardResize();
        gsap.fromTo(settingsContentRef.current, 
            { opacity: 0, y: 20 }, 
            { opacity: 1, y: 0, duration: 0.5, delay: 0.1, ease: 'power2.out' }
        );
      }
    }
  }, [isSettingsVisible, triggerCardResize]);

  useLayoutEffect(() => {
    if (isAiVisible) {
      gsap.fromTo(".explain-button", { opacity: 0, scale: 0.8 }, {
        opacity: 1, scale: 1, duration: 0.5, stagger: 0.05, ease: 'back.out(1.7)'
      });
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

  useEffect(() => {
    const timer = setTimeout(() => {
        triggerCardResize();
    }, 150);

    return () => clearTimeout(timer);
  }, [aiResponses, triggerCardResize]);

  useEffect(() => {
    setCookie('chapelVisible', isChapelVisible, 365);
  }, [isChapelVisible]);

  useEffect(() => {
    setCookie('aiVisible', isAiVisible, 365);
  }, [isAiVisible]);

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
        {mealPeriodData.map((station, index) => {
          const stationId = station.name.replace(/\s+/g, '-');
          return (
            <div key={index} className="station">
              <div className="station-header">
                <h3 className="station-name">{station.name}</h3>
                {isAiVisible && (
                  <div className="explain-button-container">
                    <button
                      className="explain-button"
                      onClick={() => handleExplainStation(station)}
                    >
                      explain this
                    </button>
                  </div>
                )}
              </div>
              <ul className="meal-list">
                {station.options.map((item, itemIndex) => {
                  const displayItem = { ...item, meal: capitalizeWords(item.meal) };
                  return <MealItem key={itemIndex} item={displayItem} onToggle={triggerCardResize} />;
                })}
              </ul>
              {!!aiResponses[station.name] && (
                <div id={`ai-response-${stationId}`}>
                  <AiResponse
                    responseState={aiResponses[station.name]}
                    onClose={() => closeAiResponse(station.name)}
                    onCharTyped={triggerCardResize}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderChapelContent = () => {
    if (isChapelLoading) return <><h2 className="meal-period-title">Chapel</h2><p>Loading Chapel...</p></>;
    if (chapelError) return <><h2 className="meal-period-title">Chapel</h2><p>Chapel events are currently unavailable. Well this is awkward.</p></>;
    if (!chapelData || chapelData.length === 0) return <><h2 className="meal-period-title">Chapel</h2><p style={{ textAlign: 'center' }}>No chapel events listed for today. Well this is awkward.</p></>;

    const now = new Date();
    const upcomingEvents = chapelData
      .map(event => ({ ...event, dateObject: parseChapelDate(event.time) }))
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
              {isSettingsVisible ? (
                  <SettingsPage ref={settingsContentRef} onBack={handleBackToMeals} />
              ) : (
                <div ref={pageContentRef}>
                  {renderCardContent()}
                </div>
              )}
              {!isSettingsVisible && (
                <div className="inner-nav-bar">
                  <button className={`inner-nav-button ${activePage === 'breakfast' ? 'active' : ''}`} onClick={() => setActivePage('breakfast')}>Breakfast</button>
                  <button className={`inner-nav-button ${activePage === 'lunch' ? 'active' : ''}`} onClick={() => setActivePage('lunch')}>Lunch</button>
                  <button className={`inner-nav-button ${activePage === 'dinner' ? 'active' : ''}`} onClick={() => setActivePage('dinner')}>Dinner</button>
                </div>
              )}
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