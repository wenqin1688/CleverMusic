
import React, { useEffect, useState, useRef } from 'react';
import { Music } from 'lucide-react';

interface Point {
  x: number;
  y: number;
  id: number;
  rotation: number;
}

export const Cursor: React.FC = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState<Point[]>([]);
  const [isClicking, setIsClicking] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      
      // Add point to trail
      const newPoint = { 
          x: e.clientX, 
          y: e.clientY, 
          id: Date.now(),
          rotation: Math.random() * 360 
      };
      setTrail(prev => [...prev.slice(-15), newPoint]); // Keep last 15 points for better stream
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);
    
    // Check for hoverable elements
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('.clickable')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', updatePosition);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseover', handleMouseOver);

    // Cleanup trail gradually when idle
    const cleanupTrail = () => {
       setTrail(prev => prev.slice(1));
       timerRef.current = window.setTimeout(cleanupTrail, 50);
    };
    cleanupTrail();

    return () => {
      window.removeEventListener('mousemove', updatePosition);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseover', handleMouseOver);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <style>{`
        @keyframes bounce-slight {
          0%, 100% { transform: translateY(0) rotate(10deg); }
          50% { transform: translateY(-3px) rotate(0deg); }
        }
      `}</style>

      {/* Trail Effect - Black Music Notes */}
      {trail.map((point, index) => (
        <div 
          key={point.id}
          className="absolute text-black/80"
          style={{
            left: point.x,
            top: point.y,
            opacity: (index / trail.length) * 0.6,
            transform: `translate(-50%, -50%) scale(${0.4 + (index / trail.length) * 0.4}) rotate(${point.rotation}deg)`,
            transition: 'opacity 0.1s'
          }}
        >
            <Music size={12} fill="currentColor" />
        </div>
      ))}

      {/* Main Cursor - Music Note */}
      <div 
        className="absolute transition-transform duration-150 ease-out"
        style={{
          left: position.x,
          top: position.y,
          transform: `translate(-50%, -50%) scale(${isClicking ? 0.8 : isHovering ? 1.2 : 1})`,
        }}
      >
        <div className="relative">
             {/* Glow */}
             <div className="absolute inset-0 bg-white/50 blur-md rounded-full scale-150" />
             
             {/* Icon */}
             <div className="relative text-black drop-shadow-md animate-[bounce-slight_2s_ease-in-out_infinite]">
                 <Music size={24} strokeWidth={2.5} fill="white" />
             </div>
        </div>
      </div>
    </div>
  );
};
