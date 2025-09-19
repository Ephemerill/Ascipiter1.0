// frontend/src/ToggleSwitch.jsx

import React from 'react';
import './../App.css'; // Styles will be in the main CSS file

const ToggleSwitch = ({ isToggled, onToggle, label }) => {
  const switchId = `toggle-${label.replace(/\s+/g, '-')}`;
  
  return (
    <div className="nav-card-link toggle-switch-container" onClick={onToggle} role="button" tabIndex="0" aria-label={`Toggle ${label}`}>
      <label htmlFor={switchId} onClick={(e) => e.stopPropagation()}>
        {label}
      </label>
      <div className={`toggle-switch ${isToggled ? 'on' : 'off'}`}>
        <div className="toggle-handle" />
      </div>
      <input
        id={switchId}
        type="checkbox"
        className="toggle-checkbox"
        checked={isToggled}
        onChange={onToggle}
        readOnly
      />
    </div>
  );
};

export default ToggleSwitch;