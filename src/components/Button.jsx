import React, { memo } from 'react';

const Button = memo(({ children, onClick, variant = 'primary', disabled = false, icon: Icon, spinIcon = false, className = '' }) => {
  const baseStyle = "flex items-center justify-center px-6 py-2 rounded-full font-bold text-sm transition-transform duration-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  
  const variants = {
    primary: "bg-[#1ed760] hover:bg-[#1fdf64] text-black hover:scale-105", 
    secondary: "bg-white text-black hover:scale-105", 
    outline: "bg-transparent border border-[#727272] text-white hover:border-white hover:scale-105", 
    ghost: "bg-transparent text-[#b3b3b3] hover:text-white hover:bg-[#ffffff10] !px-4", 
    danger: "bg-transparent text-[#f15e6c] border border-[#f15e6c] hover:bg-[#f15e6c] hover:text-white"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={18} className={`mr-2 ${spinIcon ? 'animate-spin' : ''}`} />}
      {children}
    </button>
  );
});

export default Button;