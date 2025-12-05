import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isActive?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isActive = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-300 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed clickable";
  
  const variants = {
    primary: "bg-[#1d1d1f] text-white hover:bg-black shadow-lg hover:shadow-xl rounded-full",
    secondary: "bg-white border border-black/5 text-text-primary hover:bg-neutral-100 hover:border-black/10 shadow-sm rounded-xl",
    glass: "bg-glass-base border border-glass-border text-text-primary hover:bg-white hover:border-black/10 backdrop-blur-xl shadow-sm rounded-xl",
    icon: "bg-transparent text-text-secondary hover:text-text-primary rounded-full hover:bg-black/5"
  };

  const activeStyles = isActive ? "!bg-[#007AFF] !text-white shadow-md border-transparent" : "";
  
  const sizes = {
    sm: "text-[10px] px-3 py-1.5",
    md: "text-xs px-5 py-2.5",
    lg: "text-sm px-6 py-3",
    icon: "p-2"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${activeStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};