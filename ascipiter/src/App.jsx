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
      label: "About",
      textColor: "#fff",
      isGlass: true,
      glassBlur: 25,
      glassTransparency: 0.05,
      links: [
        { label: "Company", ariaLabel: "About Company" },
        { label: "Careers", ariaLabel: "About Careers" }
      ]
    },
    {
      label: "Projects",
      textColor: "#fff",
      isGlass: true,
      glassBlur: 25,
      glassTransparency: 0.05,
      links: [
        { label: "Featured", ariaLabel: "Featured Projects" },
        { label: "Case Studies", ariaLabel: "Project Case Studies" }
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
            <h2>Your Orders</h2>
            <p>You have no recent orders.</p>
            <p>Maybe it's time to get some more grilled dog food? 🌭</p>
          </>
        );
      case 'profile':
        return (
          <>
            <h2>User Profile</h2>
            <p>Username: CoolUser123</p>
            <p>Member Since: 2025</p>
          </>
        );
      case 'settings':
        return (
          <>
            <h2>Settings</h2>
            <p>Enable Dark Mode: [Toggle]</p>
            <p>Notifications: On</p>
          </>
        );
      default:
        return <h2>Sample Menu</h2>;
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
                Orders
              </button>
              <button 
                className={`inner-nav-button ${activePage === 'profile' ? 'active' : ''}`}
                onClick={() => setActivePage('profile')}
              >
                Profile
              </button>
              <button 
                className={`inner-nav-button ${activePage === 'settings' ? 'active' : ''}`}
                onClick={() => setActivePage('settings')}
              >
                Settings
              </button>
            </div>
          </GlassSurface>
        </div>
      </div>
    </div>
  );
}

export default App;