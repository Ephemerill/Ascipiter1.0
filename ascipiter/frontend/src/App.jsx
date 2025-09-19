// frontend/src/App.jsx

import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import GlassSurface from './GlassSurface';
import './App.css';
import Silk from './Silk';
import CardNav from './CardNav';
import logo from './assets/logo.svg';
import MealItem from './MealItem';

// Define the static part of the items outside the component
const navItemsTemplate = [
  {
    label: "Other Things",
    textColor: "#fff",
    isGlass: true,
    glassBlur: 25,
    glassTransparency: 0.05,
    links: [
      { label: "Donate to me :)", ariaLabel: "About Company" },
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
      { label: "Show AI", ariaLabel: "Featured Projects" },
      {
        label: "Show Chapel Schedule", // The label will be updated dynamically in CardNav
        ariaLabel: "Toggle Chapel Schedule display",
        type: 'toggle',
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
      { label: "Extra Old", ariaLabel: "Extra Old Site", href: "https://google.com", target: "_blank" }
    ]
  }
];

// Helper function to calculate time until the event
const calculateTimeRemaining = (eventDate) => {
  const now = new Date();
  const diffMillis = eventDate.getTime() - now.getTime();

  if (diffMillis <= 0) {
    return "Event in progress";
  }

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


function App() {
  const [activePage, setActivePage] = useState('breakfast');
  const [menuData, setMenuData] = useState(null);
  const [chapelData, setChapelData] = useState(null);

  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [isChapelLoading, setIsChapelLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [chapelError, setChapelError] = useState(null);

  const [isChapelVisible, setIsChapelVisible] = useState(false);

  const mealCardRef = useRef(null);
  const chapelCardRef = useRef(null);
  const mealContentRef = useRef(null);
  const pageContentRef = useRef(null);
  const chapelContentRef = useRef(null); // Ref for the chapel content wrapper

  const triggerCardResize = useCallback(() => {
    if (mealCardRef.current && mealContentRef.current) {
      const targetHeight = mealContentRef.current.scrollHeight;
      gsap.to(mealCardRef.current, {
        height: targetHeight,
        duration: 0.5,
        ease: 'power2.inOut',
      });
    }
  }, []);

  // --- NEW: Resize function for the chapel card ---
  const triggerChapelResize = useCallback(() => {
    if (chapelCardRef.current && chapelContentRef.current && isChapelVisible) {
      const targetHeight = chapelContentRef.current.scrollHeight;
      gsap.to(chapelCardRef.current, {
        height: targetHeight,
        duration: 0.5,
        ease: 'power2.inOut',
      });
    }
  }, [isChapelVisible]);

  useEffect(() => {
    const fetchMenu = async () => {
      setIsMenuLoading(true);
      try {
        const response = await fetch('http://127.0.0.1:5001/api/menu');
        if (!response.ok) throw new Error(`HTTP error!`);
        const data = await response.json();
        setMenuData(data);
        setMenuError(null);
      } catch (e) {
        setMenuError(e.message);
      } finally {
        setIsMenuLoading(false);
      }
    };

    const fetchChapel = async () => {
      setIsChapelLoading(true);
      try {
        const response = await fetch('http://127.0.0.1:5001/api/chapel');
        if (!response.ok) throw new Error(`HTTP error!`);
        const data = await response.json();
        setChapelData(data);
        setChapelError(null);
      } catch (e) {
        setChapelError(e.message);
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

  // --- UPDATED: Show/hide animation effect ---
  useLayoutEffect(() => {
    const mealCard = mealCardRef.current;
    const chapelCard = chapelCardRef.current;

    // Combined resize function to run after animation completes
    const onAnimationComplete = () => {
      triggerCardResize();
      triggerChapelResize();
    };

    const tl = gsap.timeline({ onComplete: onAnimationComplete });

    if (isChapelVisible) {
      gsap.set(chapelCard, { display: 'block', height: 'auto' }); // Set height to auto for measurement
      tl.to(mealCard, { width: '65%', duration: 0.6, ease: 'power3.inOut' })
        .fromTo(chapelCard,
          { width: '0%', opacity: 0, xPercent: -20 },
          { width: '32%', opacity: 1, xPercent: 0, duration: 0.6, ease: 'power3.inOut' },
          "<"
        );
    } else {
      if (chapelCard && chapelCard.style.display !== 'none') {
        tl.to(mealCard, { width: '75%', duration: 0.6, ease: 'power3.inOut' })
          .to(chapelCard,
            { width: '0%', opacity: 0, xPercent: -20, duration: 0.6, ease: 'power3.inOut' },
            "<"
          )
          .set(chapelCard, { display: 'none' });
      } else {
        gsap.set(mealCard, { width: '75%' });
      }
    }
  }, [isChapelVisible, triggerCardResize, triggerChapelResize]);

  // --- NEW: Effect to resize chapel card when its data loads ---
  useLayoutEffect(() => {
    if (!isChapelLoading && isChapelVisible) {
      const timer = setTimeout(triggerChapelResize, 50); // Small delay for DOM update
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
            <h3 className="station-name">{station.name}</h3>
            <ul className="meal-list">
              {station.options.map((item, itemIndex) => (
                <MealItem key={itemIndex} item={item} onToggle={triggerCardResize} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };
  
  const renderChapelContent = () => {
    if (isChapelLoading) return <><h2 className="meal-period-title">Chapel</h2><p>Loading Chapel...</p></>;
    if (chapelError) return <><h2 className="meal-period-title">Chapel</h2><p>Chapel events are currently unavailable.</p></>;
    if (!chapelData || chapelData.length === 0) return <><h2 className="meal-period-title">Chapel</h2><p>No chapel events listed for today.</p></>;

    const now = new Date();
    const upcomingEvents = chapelData
      .map(event => {
        const parsableDateString = event.time.replace(' at ', ' ');
        const eventDate = new Date(parsableDateString);
        return { ...event, dateObject: eventDate };
      })
      .filter(event => event.dateObject > now && !isNaN(event.dateObject.valueOf()))
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
            <p>No upcoming chapel events found.</p>
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
        />
        <div className="card-container">
          <GlassSurface ref={mealCardRef} borderRadius={20} className="meal-card" distortionScale={-80}>
            <div className="card-content" ref={mealContentRef}>
              <div ref={pageContentRef}>
                {renderCardContent()}
              </div>
              <div className="inner-nav-bar">
                <button 
                  className={`inner-nav-button ${activePage === 'breakfast' ? 'active' : ''}`}
                  onClick={() => setActivePage('breakfast')}
                >
                  Breakfast
                </button>
                <button 
                  className={`inner-nav-button ${activePage === 'lunch' ? 'active' : ''}`}
                  onClick={() => setActivePage('lunch')}
                >
                  Lunch
                </button>
                <button 
                  className={`inner-nav-button ${activePage === 'dinner' ? 'active' : ''}`}
                  onClick={() => setActivePage('dinner')}
                >
                  Dinner
                </button>
              </div>
            </div>
          </GlassSurface>
          
          {/* --- UPDATED: Attaching the new ref here --- */}
          <GlassSurface ref={chapelCardRef} borderRadius={20} className="chapel-card">
            <div className="card-content chapel-card-wrapper" ref={chapelContentRef}>{renderChapelContent()}</div>
          </GlassSurface>
        </div>
      </div>
    </div>
  );
}

export default App;