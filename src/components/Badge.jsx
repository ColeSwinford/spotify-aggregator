import React, { memo } from 'react';

const Badge = memo(({ children, onClick }) => {
  return (
    <span 
      onClick={onClick}
      className="px-2 py-1 rounded-sm text-[11px] font-medium transition-colors cursor-pointer bg-[#2a2a2a] text-white text-opacity-90 hover:bg-[#333]"
    >
      {children}
    </span>
  );
});

export default Badge;