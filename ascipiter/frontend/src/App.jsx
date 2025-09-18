// frontend/src/App.jsx

import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import GlassSurface from './GlassSurface';
import './App.css';
import Silk from './Silk';
import CardNav from './CardNav';
import logo from './assets/logo.svg';
import MealItem from './MealItem'; // Import the new component

function App() {
  const [activePage, setActivePage] = useState('breakfast');
  const [menuData, setMenuData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const cardRef = useRef(null);
  const contentRef = useRef(null);

  const triggerCardResize = useCallback(() => {
    if (cardRef.current && contentRef.current) {
      const targetHeight = contentRef.current.scrollHeight;
      gsap.to(cardRef.current, {
        height: targetHeight,
        duration: 0.4,
        ease: 'power2.inOut',
      });
    }
  }, []);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5001/api/menu');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setMenuData(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenu();
  }, []);

  const items = [
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
        { label: "Show Chapel Schedule", ariaLabel: "Project Case Studies" },
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

  useLayoutEffect(() => {
    // A short delay ensures that the content has rendered before we measure it
    const timer = setTimeout(() => {
      triggerCardResize();
    }, 100); 

    return () => clearTimeout(timer);
  }, [activePage, isLoading, triggerCardResize]);

  const renderCardContent = () => {
    if (isLoading) {
      return <h2>Loading Menu... 🧑‍🍳</h2>;
    }
    if (error) {
      return <><h2>Oops!</h2><p>Could not load the menu. The cafe might be closed, or an error occurred: {error}</p></>;
    }
    if (!menuData) {
      return <h2>No Menu Data</h2>;
    }

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

  return (
    <div className="App">
      <div className="silk-container">
        <Silk
          speed={5}
          scale={1}
          color="#7B7481"
          noiseIntensity={1.5}
          rotation={0}
        />
      </div>
      
      <div className="content-area">
        <CardNav
          logo={logo}
          logoAlt="Company Logo"
          items={items}
          menuColor="#fff"
          buttonBgColor="transparent"
          buttonTextColor="#fff"
          ease="power3.out"
          isGlass={true}
          glassBlur={15}
          glassTransparency={0.05}
          distortionScale={-80}
          ctaButtonText="--°F"
        />

        <div className="card-container">
          <GlassSurface
            ref={cardRef}
            borderRadius={20}
            fallbackBlur={0.1}
            fallbackTransparency={0.001}
            distortionScale={-80}
          >
            <div className="card-content" ref={contentRef}>
              <div> 
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
        </div>
      </div>
    </div>
  );
}

export default App;