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
      label: "About",
      bgColor: "#0D0716",
      textColor: "#fff",
      links: [
        { label: "Company", ariaLabel: "About Company" },
        { label: "Careers", ariaLabel: "About Careers" }
      ]
    },
    {
      label: "Projects",
      bgColor: "#170D27",
      textColor: "#fff",
      links: [
        { label: "Featured", ariaLabel: "Featured Projects" },
        { label: "Case Studies", ariaLabel: "Project Case Studies" }
      ]
    },
    {
      label: "Contact",
      bgColor: "#271E37",
      textColor: "#fff",
      links: [
        { label: "Email", ariaLabel: "Email us" },
        { label: "Twitter", ariaLabel: "Twitter" },
        { label: "LinkedIn", ariaLabel: "LinkedIn" }
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
      
      {/* --- NEW: Content area for elements that should stack --- */}
      <div className="content-area">
        <CardNav
          logo={logo}
          logoAlt="Company Logo"
          items={items}
          menuColor="#fff"
          buttonBgColor="#111"
          buttonTextColor="#fff"
          ease="power3.out"
          isGlass={true}
          glassBlur={10}
          glassTransparency={0.05}
        />

        <div className="card-container">
          <GlassSurface
            width={450}
            height="auto"
            borderRadius={20}
            fallbackBlur={0.1}
            fallbackTransparency={0.001}
          >
            <div className="card-content">
              <h2>Glass Card</h2>
              <p>
                This card is centered on the page. You can now easily change its blur and transparency by editing the props in App.jsx.
              </p>
              <button className="card-button">Click Me</button>
            </div>
          </GlassSurface>
        </div>
      </div>
    </div>
  );
}

export default App;