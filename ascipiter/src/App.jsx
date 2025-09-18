// App.jsx

import React from 'react';
import GlassSurface from './GlassSurface';
import './App.css';
import Silk from './Silk';
import CardNav from './CardNav';
import logo from './assets/logo.svg';

function App() {
  const items = [
    {
      label: "Site Settings",
      textColor: "#fff",
      isGlass: true,
      glassBlur: 25,
      glassTransparency: 0.1,
      links: [
        { label: "Option 1", ariaLabel: "About Company" },
        { label: "Option 2", ariaLabel: "About Careers" }
      ]
    },
    {
      label: "Placeholder 2",
      textColor: "#fff",
      isGlass: true,
      glassBlur: 25,
      glassTransparency: 0.1,
      links: [
        { label: "Button", ariaLabel: "Featured Projects" },
        { label: "Send Cash", ariaLabel: "Project Case Studies" }
      ]
    },
    {
      label: "Legacy Sites",
      textColor: "#ffffffff",
      isGlass: true,
      glassBlur: 25,
      glassTransparency: 0.1,
      links: [
        { label: "Legacy", ariaLabel: "Legacy Site", href: "https://biolawizard.com/", target: "_blank" },
        { label: "Extra Old", ariaLabel: "Extra Old Site", href: "https://google.com", target: "_blank" }
      ]
    }
  ];

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
            width={450}
            height="auto"
            borderRadius={20}
            fallbackBlur={0.1}
            fallbackTransparency={0.001}
            distortionScale={-80}
          >
            <div className="card-content">
              <h2>Sample Menu</h2>
              <p>
                This card could display the menu!
              </p>
              <p>Did you know that Home Cookin' is serving grilled dog food today?</p>
              <button className="card-button">Explain This Pretty Please</button>
            </div>
          </GlassSurface>
        </div>
      </div>
    </div>
  );
}

export default App;