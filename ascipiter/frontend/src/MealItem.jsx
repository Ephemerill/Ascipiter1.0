// frontend/src/MealItem.jsx

import React, { useState, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';

// A simple SVG icon for the dropdown arrow
const ChevronIcon = ({ isOpen }) => (
  <svg
    className={`chevron-icon ${isOpen ? 'open' : ''}`}
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const MealItem = ({ item, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  // Animate the description container open/closed
  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    
    if (container && content) {
      const tl = gsap.timeline();
      
      if (isOpen) {
        // OPENING: Animate height, margin, and borderWidth
        gsap.set(container, { height: 'auto' }); // First, set height to auto to measure its natural size
        tl.fromTo(container, 
          { height: 0, marginTop: 0, borderWidth: 0 }, 
          { 
            height: container.scrollHeight, 
            marginTop: '0.5rem',
            borderWidth: '1px', // Animate TO a 1px border width
            duration: 0.4, 
            ease: 'power2.inOut' 
          }
        );
        // Fade in the content during the expansion
        tl.to(content, { opacity: 1, duration: 0.3 }, "-=0.2");
      } else {
        // CLOSING: Animate content out first
        tl.to(content, { opacity: 0, duration: 0.2 });
        // Then, collapse the container, animating borderWidth back to 0
        tl.to(container, { 
          height: 0, 
          marginTop: 0,
          borderWidth: 0, // Animate TO a 0px border width
          duration: 0.4, 
          ease: 'power2.inOut' 
        });
      }
    }

    // Inform the parent App component to resize after the animation completes
    const timer = setTimeout(() => {
      onToggle();
    }, 400); 

    return () => clearTimeout(timer);

  }, [isOpen, onToggle]);

  const handleToggle = () => {
    if (item.description) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <li className="meal-item">
      <div className="meal-header" onClick={handleToggle} style={{ cursor: item.description ? 'pointer' : 'default' }}>
        <span className="meal-name">{item.meal}</span>
        {item.description && <ChevronIcon isOpen={isOpen} />}
      </div>
      {item.description && (
        <div className="meal-description-container" ref={containerRef}>
          <p className="meal-description" ref={contentRef}>{item.description}</p>
        </div>
      )}
    </li>
  );
};

export default MealItem;