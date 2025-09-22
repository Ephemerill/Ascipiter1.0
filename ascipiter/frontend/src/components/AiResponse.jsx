// src/components/AiResponse.jsx

import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { gsap } from 'gsap';
import TextType from './TextType';

const AiResponse = ({ responseState, onClose, onCharTyped }) => {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    gsap.fromTo(containerRef.current, 
      { height: 0, opacity: 0, marginTop: 0 }, 
      { 
        height: 'auto', 
        opacity: 1, 
        marginTop: '1rem', 
        duration: 0.8, 
        ease: 'expo.out'
      }
    );
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const renderContent = () => {
    if (responseState.isLoading) {
      return (
        <div className="ai-response-loading">
          <div className="spinner"></div>
          Thinking...
        </div>
      );
    }
    if (responseState.error) {
      return <p className="ai-response-error">{responseState.error}</p>;
    }
    if (responseState.data) {
      return (
        <TextType
          text={responseState.data}
          typingSpeed={5}
          loop={false}
          showCursor={true}
          cursorCharacter="_"
          onCharTyped={onCharTyped} // Pass the function down
        />
      );
    }
    return null;
  };

  return (
    <div className="ai-response-container" ref={containerRef}>
      <div className="ai-response-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default AiResponse;