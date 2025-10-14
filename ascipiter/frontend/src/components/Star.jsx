import React from 'react';

const Star = ({ isFilled, isHovered, onMouseEnter, onMouseLeave, onClick }) => {
  const starStyle = {
    cursor: 'pointer',
    color: isHovered || isFilled ? '#FFD700' : '#ccc', // Gold color for filled/hovered, grey for empty
    transition: 'color 0.2s',
    userSelect: 'none', // Prevents text selection on rapid clicks
  };

  return (
    <span
      style={starStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      ★
    </span>
  );
};

export default Star;