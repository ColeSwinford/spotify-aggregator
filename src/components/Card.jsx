// src/components/Card.jsx
import React from 'react';

const Card = ({ children, className = '' }) => (
  <div className={`bg-[#121212] rounded-lg p-6 ${className}`}>
    {children}
  </div>
);

export default Card;