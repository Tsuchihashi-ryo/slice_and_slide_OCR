import React, { useState, useMemo, useRef } from 'react';
import { Block, Page } from '../types';

interface PreviewAreaProps {
  page: Page;
  isProcessing: boolean;
  totalPages: number;
  currentPageIndex: number;
  onPageChange: (index: number) => void;
  onToggleBlockType?: (blockId: string) => void;
  selectedBlockIds?: Set<string>;
  onBlockSelect?: (blockId: string) => void;
  onMultiSelect?: (ids: Set<string>) => void;
  onMergeBlocks?: () => void;
  onToggleBackground?: (blockId: string) => void;
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({ 
  page, 
  isProcessing, 
  totalPages, 
  currentPageIndex, 
  onPageChange,
  onToggleBlockType,
  selectedBlockIds = new Set(),
  onBlockSelect,
  onMultiSelect,
  onMergeBlocks,
  onToggleBackground
}) => {
  const { imageSrc, blocks } = page;
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<{startX: number, startY: number, endX: number, endY: number} | null>(null);

  // Calculate Z-Index based on block size (Area).
  const blockZIndices = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...blocks].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    sorted.forEach((block, index) => {
      map.set(block.id, 10 + index);
    });
    return map;
  }, [blocks]);

  const singleSelectedBlockId = selectedBlockIds.size === 1 ? Array.from(selectedBlockIds)[0] : null;
  const singleSelectedBlock = singleSelectedBlockId ? blocks.find(b => b.id === singleSelectedBlockId) : null;

  // Drag Selection Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    // Calculate start position relative to container
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectionBox || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!selectionBox || !containerRef.current) return;
    
    // Final Selection Box
    const left = Math.min(selectionBox.startX, selectionBox.endX);
    const top = Math.min(selectionBox.startY, selectionBox.endY);
    const width = Math.abs(selectionBox.endX - selectionBox.startX);
    const height = Math.abs(selectionBox.endY - selectionBox.startY);
    
    // Threshold for drag vs click
    if (width > 5 && height > 5) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newSelectedIds = new Set<string>();
      
      // Check Intersections
      page.blocks.forEach(block => {
        const blockX = (block.x / page.width) * containerRect.width;
        const blockY = (block.y / page.height) * containerRect.height;
        const blockW = (block.width / page.width) * containerRect.width;
        const blockH = (block.height / page.height) * containerRect.height;
        
        if (
          left < blockX + blockW &&
          left + width > blockX &&
          top < blockY + blockH &&
          top + height > blockY
        ) {
          newSelectedIds.add(block.id);
        }
      });
      
      onMultiSelect?.(newSelectedIds);
    } else {
      // If it's a tiny drag (click) on background, deselect all
      // We assume if it was on a block, the block's stopPropagation prevented this from running (but we removed stopProp below)
      // Actually, if we click background, we deselect.
      onMultiSelect?.(new Set());
    }
    
    setSelectionBox(null);
  };

  // Helper to render selection box
  const renderSelectionBox = () => {
    if (!selectionBox) return null;
    const left = Math.min(selectionBox.startX, selectionBox.endX);
    const top = Math.min(selectionBox.startY, selectionBox.endY);
    const width = Math.abs(selectionBox.endX - selectionBox.startX);
    const height = Math.abs(selectionBox.endY - selectionBox.startY);
    
    return (
      <div 
        className="absolute border-2 border-indigo-500 bg-indigo-500/20 z-[2000] pointer-events-none"
        style={{ left, top, width, height }}
      />
    );
  };

  return (
    <div 
      className="flex-1 bg-slate-100 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center border border-slate-200 shadow-inner p-4 select-none"
    >
      <div 
        ref={containerRef}
        className="relative inline-block shadow-2xl cursor-crosshair" 
        style={{ fontSize: 0 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setSelectionBox(null)}
      >
        {/* Background: Original Image */}
        <img 
          src={imageSrc} 
          alt={`Page ${page.pageNumber}`} 
          className={`
            max-h-[75vh] max-w-full block w-auto h-auto object-contain transition-opacity duration-300 select-none
            ${blocks.length > 0 && !isProcessing ? 'opacity-30' : 'opacity-100'}
          `}
          draggable={false}
        />

        {renderSelectionBox()}

        {/* Overlay Layer: Detected Blocks */}
        {!isProcessing && blocks.length > 0 && (
          <div className="absolute inset-0 w-full h-full">
            {blocks.map((block, index) => {
               const isText = block.type === 'text';
               const isSelected = selectedBlockIds.has(block.id);
               // A block is pending OCR if it is marked as text but has no recognized content yet.
               const isPendingOcr = isText && !block.text;
               
               const baseZIndex = blockZIndices.get(block.id) || 10;
               const finalZIndex = isSelected ? 1000 : baseZIndex;

               // Hide badge if block is extremely tiny, but keep waiting ocr visible for smallish items
               const isTiny = block.width < 30 || block.height < 15;
               const isSmall = block.width < 50 || block.height < 30;

               // Strict Color Theme
               const baseColorClass = isText ? 'blue' : 'orange';
               const borderColor = isText ? '#2563eb' : '#ea580c'; // blue-600 vs orange-600
               const bgColor = isText ? 'rgba(37, 99, 235, 0.15)' : 'rgba(234, 88, 12, 0.15)'; 
               const badgeColor = isText ? '#1d4ed8' : '#c2410c'; // darker shade for badge bg

               return (
                 <div
                   key={block.id}
                   className="absolute cursor-pointer group"
                   style={{
                     left: `${(block.x / page.width) * 100}%`,
                     top: `${(block.y / page.height) * 100}%`,
                     width: `${(block.width / page.width) * 100}%`,
                     height: `${(block.height / page.height) * 100}%`,
                     // Distinct thick borders
                     border: isSelected ? `4px solid ${borderColor}` : `2px solid ${borderColor}`,
                     zIndex: finalZIndex,
                     // Add a white ring for contrast if selected
                     boxShadow: isSelected ? '0 0 0 3px white, 0 10px 25px rgba(0,0,0,0.5)' : 'none',
                   }} 
                   title={`Block ${index + 1}`}
                   onMouseDown={(e) => {
                     // Prevent drag selection starting from within a block, unless we are fine with it
                     // We stop propagation so clicking a block selects it immediately and doesn't trigger box select
                     e.stopPropagation();
                   }}
                   onClick={(e) => {
                     e.stopPropagation();
                     onBlockSelect?.(block.id);
                   }}
                 >
                    {/* Content Image */}
                    <img
                      src={block.dataUrl}
                      alt={`block-${index}`}
                      className="w-full h-full block relative z-0"
                      draggable={false}
                    />
                    
                    {/* Hover Tint */}
                    <div 
                      className="absolute inset-0 transition-opacity duration-200 z-10"
                      style={{ 
                        backgroundColor: bgColor,
                        opacity: isSelected ? 0.3 : 0.4, // Always visible tint
                        mixBlendMode: 'multiply' 
                      }}
                    />
                    
                    {/* Highlight Effect on Hover */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-${baseColorClass}-400/20`} />

                    {/* Pending OCR Indicator - CENTRAL OVERLAY */}
                    {isPendingOcr && !isTiny && (
                      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                         <div className="bg-blue-600/90 text-white text-[10px] md:text-xs px-2 py-1 rounded-md shadow-sm backdrop-blur-[1px] border border-blue-400 font-medium animate-pulse whitespace-nowrap">
                           Waiting for OCR
                         </div>
                      </div>
                    )}
                    
                    {/* TYPE INDICATOR BADGE */}
                    {!isSmall && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBlockType?.(block.id);
                        }}
                        className={`
                          absolute -top-3 left-0 pl-1.5 pr-2 py-0.5 rounded text-white text-[10px] font-bold uppercase tracking-wider
                          flex items-center shadow-md transition-transform z-30 hover:scale-105 active:scale-95
                          border border-white/20
                        `}
                        style={{ backgroundColor: badgeColor }}
                      >
                        <span className="opacity-70 mr-1.5 font-mono border-r border-white/20 pr-1.5">
                          {index + 1}
                        </span>
                        {isText ? (
                          <span className="flex items-center gap-1">
                             {/* Change Text Icon to Stack Icon if background is preserved */}
                             {block.preserveBackground ? (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                             ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                             )}
                             {block.preserveBackground ? "IMG+TXT" : "TEXT"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                             IMAGE
                          </span>
                        )}
                      </button>
                    )}

                    {/* Text Preview Tooltip */}
                    {isText && block.text && !isSelected && (
                       <div className="absolute -bottom-7 left-0 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap overflow-hidden max-w-[200px] truncate z-50">
                         {block.text}
                       </div>
                    )}
                 </div>
               );
            })}
          </div>
        )}

        {/* Processing Spinner */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-10 w-10 text-indigo-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-semibold text-indigo-900">Analyzing Layout...</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Floating Action Bar */}
      {selectedBlockIds.size > 0 && (
        <div className="absolute bottom-20 z-50 animate-bounce-in flex flex-col items-center gap-2 pointer-events-auto">
           
           {/* Multi Selection Actions */}
           {selectedBlockIds.size > 1 && (
              <button
                onClick={onMergeBlocks}
                className="bg-indigo-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 font-bold hover:bg-indigo-700 transition-transform active:scale-95 border-2 border-white"
              >
                Merge {selectedBlockIds.size} Blocks
              </button>
           )}

           {/* Single Selection Actions */}
           {singleSelectedBlock && (
             <div className="flex flex-col gap-2">
               
               {/* Context Menu for Text Blocks */}
               {singleSelectedBlock.type === 'text' && (
                 <div className="bg-white p-2 rounded-xl shadow-lg border border-slate-200 mb-2 flex items-center justify-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      <div className="relative inline-flex items-center">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={singleSelectedBlock.preserveBackground || false}
                          onChange={() => onToggleBackground?.(singleSelectedBlock.id)}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </div>
                      Keep Background Image
                    </label>
                 </div>
               )}

               <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-xl border border-slate-200">
                  <div className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-500">
                    Block #{blocks.indexOf(singleSelectedBlock) + 1}
                  </div>
                  
                  <button
                    onClick={() => onToggleBlockType?.(singleSelectedBlock.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors
                      ${singleSelectedBlock.type === 'text' 
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }
                    `}
                  >
                    {singleSelectedBlock.type === 'text' ? (
                      <>Switch to Image</>
                    ) : (
                      <>Switch to Text</>
                    )}
                  </button>
               </div>
             </div>
           )}
        </div>
      )}
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="absolute bottom-6 bg-white/90 backdrop-blur border border-slate-200 shadow-lg rounded-full px-4 py-2 flex items-center gap-4 z-30 pointer-events-auto">
          <button 
            onClick={() => onPageChange(currentPageIndex - 1)}
            disabled={currentPageIndex === 0}
            className="p-1 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span className="font-mono text-sm font-bold text-slate-700">
            Page {currentPageIndex + 1} / {totalPages}
          </span>

          <button 
            onClick={() => onPageChange(currentPageIndex + 1)}
            disabled={currentPageIndex === totalPages - 1}
            className="p-1 hover:bg-slate-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};