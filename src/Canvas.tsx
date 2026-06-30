import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface DrawingCanvasProps {
  promptText?: string;
  allowMouse?: boolean;
  children?: React.ReactNode;
}

export const DrawingCanvas = ({ promptText = "Draw Here", allowMouse = false, children }: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  // We use this ref to track if we've calibrated the canvas dimensions yet
  const hasSized = useRef(false); 

  const calibrateCanvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // By calculating this right when the user touches the screen, 
    // we bypass any layout shifts that happened during the initial mount.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
    
    hasSized.current = true;
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'pen' && (!allowMouse || e.pointerType !== 'mouse')) return;
    
    if (!hasSized.current) {
      calibrateCanvasSize();
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = e.pointerType === 'pen' ? (e.pressure * 6 + 1) : 3;
    ctx.strokeStyle = '#1e293b';
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (e.pointerType !== 'pen' && (!allowMouse || e.pointerType !== 'mouse')) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Expose clear to parent (a standard React forwardRef is better here for real apps)
  useEffect(() => {
    (window as any).__clearCanvas = clearCanvas;
    return () => { delete (window as any).__clearCanvas; };
  }, []);

  return (
    <div className="relative w-full max-w-none aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/9] lg:aspect-[32/9] max-h-[50vh] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm select-none">
      <div className="absolute top-4 left-4 text-xs font-medium text-slate-300 uppercase tracking-widest pointer-events-none">
        {promptText}
      </div>
      {children}
      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerOut={stopDrawing}
        className="w-full h-full cursor-crosshair touch-none"
        style={{ touchAction: 'none' }} 
      />
      <button 
        onPointerDown={(e) => {
          if (e.pointerType === 'pen' || allowMouse) clearCanvas();
        }}
        className="absolute bottom-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors select-none touch-none"
      >
        <RefreshCw size={18} />
      </button>
    </div>
  );
};
