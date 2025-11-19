import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import Star from './Star';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- Helper to calculate gradient color from rating ---
const getRatingColor = (rating) => {
  const hue = (rating - 1) * 30; // Interpolates hue from red (0) to green (120)
  return `hsl(${hue}, 90%, 55%)`;
};

// --- Mobile Rating Modal ---
const RatingModal = ({ onRate, onClose }) => {
  const stars = Array(5).fill(0);
  const modalRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(modalRef.current, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' });
  }, []);

  const handleRate = (rating) => {
    onRate(rating);
    onClose();
  };

  return createPortal(
    <div className="rating-modal-backdrop" onClick={onClose}>
      <div className="rating-modal-content" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <h4>Rate this item</h4>
        <div className="modal-stars-wrapper">
          {stars.map((_, i) => (
            <Star key={i} isFilled={false} onClick={() => handleRate(i + 1)} onMouseEnter={() => { }} onMouseLeave={() => { }} />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};


// --- Main MealRating Component ---
const MealRating = ({ mealId, anonymousId, showRatingCount }) => {
  const [ratingData, setRatingData] = useState({ averageRating: 0, ratingCount: 0, userRating: 0 });
  const { averageRating, ratingCount, userRating } = ratingData;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const barRef = useRef(null);
  const starsRef = useRef(null);
  const tl = useRef(gsap.timeline({ paused: true }));

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    tl.current.to(barRef.current, { opacity: 0, scale: 0.95, filter: 'blur(5px)', duration: 0.2, ease: 'power2.in' })
      .to(starsRef.current, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.2, ease: 'power2.out' }, "-=0.1");
  }, []);

  const fetchRatingData = useCallback(async () => {
    if (!mealId || !anonymousId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/rating/${mealId}?anonymousId=${anonymousId}`);
      if (response.ok) {
        const data = await response.json();
        setRatingData(data);
      }
    } catch (error) {
      console.error('Failed to fetch rating data:', error);
    }
  }, [mealId, anonymousId]);

  useEffect(() => {
    fetchRatingData();
  }, [fetchRatingData]);

  const submitRating = useCallback(async (newRating) => {
    try {
      // If clicking the same rating, remove it (send 0)
      const ratingToSend = newRating === userRating ? 0 : newRating;

      const response = await fetch(`${API_BASE_URL}/rate-meal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId, anonymousId, rating: ratingToSend }),
      });
      if (response.ok) {
        fetchRatingData();
      }
    } catch (error) {
      console.error("Error submitting rating:", error);
    }
  }, [mealId, anonymousId, fetchRatingData, userRating]);

  const handleMouseEnter = () => !isMobile && tl.current.play();
  const handleMouseLeave = () => !isMobile && tl.current.reverse();
  const handleClick = () => isMobile && setIsModalOpen(true);

  const barColor = ratingCount > 0 ? getRatingColor(averageRating) : 'transparent';
  const barWidth = ratingCount > 0 ? `${(averageRating / 5) * 100}%` : '0%';

  return (
    <>
      <div
        className="rating-bar-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {/* The conditional borderColor style has been removed from this div */}
        <div ref={barRef} className="rating-bar-background">
          <div className="rating-bar-fill" style={{ width: barWidth, backgroundColor: barColor }} />
        </div>

        <div ref={starsRef} className="rating-stars-interactive">
          {Array(5).fill(0).map((_, i) => (
            <Star key={i} isFilled={userRating > i} onClick={() => submitRating(i + 1)} onMouseEnter={() => { }} onMouseLeave={() => { }} />
          ))}
        </div>
      </div>
      {showRatingCount && ratingCount > 0 && <span className="rating-count" style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>({ratingCount})</span>}

      {isModalOpen && <RatingModal onRate={submitRating} onClose={() => setIsModalOpen(false)} />}
    </>
  );
};

export default MealRating;