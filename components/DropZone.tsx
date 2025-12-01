import React, { useCallback, useState } from 'react';

interface DropZoneProps {
  onFileLoaded: (file: File) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileLoaded(file);
    }
  }, [onFileLoaded]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileLoaded(file);
    }
  }, [onFileLoaded]);

  // Handle Paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
          if (item.type.indexOf("image") !== -1) {
              const blob = item.getAsFile();
              if (blob) {
                 onFileLoaded(blob);
              }
          }
      }
  }, [onFileLoaded]);

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      // Add tabIndex to make div focusable for paste events
      tabIndex={0}
      onPaste={handlePaste} 
      className={`
        w-full h-96 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center 
        transition-all duration-300 cursor-pointer outline-none group
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' 
          : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
        }
      `}
    >
      <input 
        type="file" 
        accept="image/png, image/jpeg, image/webp, application/pdf" 
        className="hidden" 
        id="file-upload"
        onChange={handleFileChange}
      />
      <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
        <div className={`
          p-5 rounded-full mb-4 transition-colors
          ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}
        `}>
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-700 mb-2">Drop image or PDF here</h3>
        <p className="text-slate-500 mb-6 text-center max-w-sm">
          Supports JPG, PNG, WEBP, PDF. <br/>
          <span className="text-sm opacity-75">Or paste from clipboard (Ctrl+V)</span>
        </p>
        <span className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
          Browse Files
        </span>
      </label>
    </div>
  );
};