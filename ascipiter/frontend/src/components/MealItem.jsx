import React, { useState, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import MealRating from './MealRating';

// Helper function to create a unique, URL-safe ID for a meal on a specific day
const createMealId = (stationName, mealName) => {
    const date = new Date();
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const cleanStation = (stationName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const cleanMeal = (mealName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    return `${cleanStation.slice(0, 25)}-${cleanMeal.slice(0, 40)}-${dateString}`;
};

// The ChevronIcon component
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

const MealItem = ({ item, onToggle, anonymousId, stationName, isRatingVisible }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const hasDescription = item.description && item.description.trim() !== '';
  const mealId = createMealId(stationName, item.meal);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (container && content) {
      const tl = gsap.timeline();
      if (isOpen) {
        gsap.set(container, { height: 'auto' });
        tl.fromTo(container, { height: 0, marginTop: 0, borderWidth: 0 }, { height: container.scrollHeight, marginTop: '0.5rem', borderWidth: '1px', duration: 0.4, ease: 'power2.inOut' });
        tl.to(content, { opacity: 1, duration: 0.3 }, 0.1);
      } else {
        tl.to(content, { opacity: 0, duration: 0.2 });
        tl.to(container, { height: 0, marginTop: 0, borderWidth: 0, duration: 0.4, ease: 'power2.inOut' });
      }
    }
    const timer = setTimeout(() => { onToggle(); }, 400); 
    return () => clearTimeout(timer);
  }, [isOpen, onToggle]);

  const handleToggle = () => {
    if (hasDescription) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <li className="meal-item">
      <div className="meal-header" onClick={handleToggle} style={{ cursor: hasDescription ? 'pointer' : 'default' }}>
        <span className="meal-name">
          {item.meal}
        </span>
        
        <div className="meal-rhs-content">
          {hasDescription && (
            <div className="chevron-container">
              <ChevronIcon isOpen={isOpen} />
            </div>
          )}
          
          {/* Conditionally render the rating system based on the new prop */}
          {isRatingVisible && anonymousId && (
            <div onClick={(e) => e.stopPropagation()}>
              <MealRating mealId={mealId} anonymousId={anonymousId} />
            </div>
          )}
        </div>
      </div>
      
      {hasDescription && (
        <div className="meal-description-container" ref={containerRef}>
          <p className="meal-description" ref={contentRef}>{item.description}</p>
        </div>
      )}
    </li>
  );
};

export default MealItem;