// App.jsx

import React from 'react';
import Galaxy from './Galaxy';
import GlassSurface from './GlassSurface'; // Should now correctly find GlassSurface.tsx
import './App.css';
import Silk from './Silk'; 
// import './React.css'; // DELETE THIS LINE

function App() {
  return (
    <div className="App">
      <Silk
      speed={5}
      scale={1}
      color="#7B7481"
      noiseIntensity={1.5}
      rotation={0}
      />
      
      <div className="card-container">
        {/*
          Now you can easily change the blur and transparency!
          - fallbackBlur: The intensity of the blur. Higher numbers = more blurry.
          - fallbackTransparency: A value from 0.0 (fully transparent) to 1.0 (fully opaque).
        */}
        <GlassSurface
          width={450}
          height="auto"
          borderRadius={20}
          fallbackBlur={0.1}       /* <-- EASY CONTROL FOR BLUR */
          fallbackTransparency={0.001}  /* <-- EASY CONTROL FOR TRANSPARENCY */
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
  );
}

export default App;