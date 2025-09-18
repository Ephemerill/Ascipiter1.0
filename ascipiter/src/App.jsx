// App.jsx

import React, { useState, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import GlassSurface from './GlassSurface';
import './App.css';
import Silk from './Silk';
import CardNav from './CardNav';
import logo from './assets/logo.svg';

function App() {
  const [activePage, setActivePage] = useState('orders');
  const cardRef = useRef(null); // Ref for the main card container to animate
  const contentRef = useRef(null); // Ref for the content wrapper to measure
  const pageContentRef = useRef(null); // Ref for the text content to fade in/out

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
        { label: "Option 1", ariaLabel: "Featured Projects" },
        { label: "Option 2", ariaLabel: "Project Case Studies" }
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
    if (cardRef.current && contentRef.current && pageContentRef.current) {
      
      // Set the initial state of the new content (make it invisible)
      gsap.set(pageContentRef.current, { opacity: 0 });

      // Measure the required height of the content wrapper
      const targetHeight = contentRef.current.scrollHeight;
      
      const tl = gsap.timeline();
      
      // 1. Animate the card's height
      tl.to(cardRef.current, {
        height: targetHeight,
        duration: 0.5,
        ease: 'power3.inOut',
      });
      
      // 2. Fade in the new content as the card resizes
      tl.to(pageContentRef.current, {
        opacity: 1,
        duration: 0.4,
      }, "-=0.4"); // Overlap the animations for a smoother effect
    }
  }, [activePage]);

  // Helper function to render the correct page content
  const renderCardContent = () => {
    switch (activePage) {
      case 'orders':
        return (
          <>
            <h2>Breakfast</h2>
            <p>Is this meal worth a swipe?</p>
            <p>Consists mostly of scrambled eggs. You would think that it would be possible to serve this on sunday but that would be too difficult.</p>
            <p>It is the cheapest meal but that is made up for by a lack of variety</p>
            <p>Rating: ★★★☆☆</p>
          </>
        );
      case 'profile':
        return (
          <>
            <h2>Lunch</h2>
            <p>There are actually Poke Bowls today</p>
            <p>Time to go buy a lottery ticket</p>
          </>
        );
      case 'settings':
        return (
          <>
            <h2>Dinner</h2>
            <p>We used up all our luck on lunch</p>
            <p>There is nothing here for you</p>
            <p>Pizza always has your back though</p>
          </>
        );
      default:
        return <h2>Timed Out</h2>;
    }
  };

  return (
    <div className="App">
      <Silk
        speed={5}
        scale={1}
        color="#7B7481"
        noiseIntensity={1.5}
        rotation={0}
      />
      
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
            width={450}
            borderRadius={20}
            fallbackBlur={0.1}
            fallbackTransparency={0.001}
            distortionScale={-80}
          >
            {/* The content and nav bar are now siblings */}
            <div className="card-content" ref={contentRef}>
              <div ref={pageContentRef}>
                {renderCardContent()}
              </div>
            </div>

            <div className="inner-nav-bar">
              <button 
                className={`inner-nav-button ${activePage === 'orders' ? 'active' : ''}`}
                onClick={() => setActivePage('orders')}
              >
                Breakfast
              </button>
              <button 
                className={`inner-nav-button ${activePage === 'profile' ? 'active' : ''}`}
                onClick={() => setActivePage('profile')}
              >
                Lunch
              </button>
              <button 
                className={`inner-nav-button ${activePage === 'settings' ? 'active' : ''}`}
                onClick={() => setActivePage('settings')}
              >
                Dinner
              </button>
            </div>
          </GlassSurface>
        </div>
      </div>
    </div>
  );
}

export default App;