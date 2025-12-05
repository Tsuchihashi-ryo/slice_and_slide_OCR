
import React, { useState, useEffect, useCallback } from 'react';
import { DropZone } from './components/DropZone';
import { PreviewArea } from './components/PreviewArea';
import { ControlPanel } from './components/ControlPanel';
import { ReadmeModal } from './components/ReadmeModal';
import { detectBlocks, extractRegion } from './services/imageProcessing';
import { generatePptx } from './services/pptxService';
import { convertPdfToImages } from './services/pdfLoader';
import { performOcrOnPages } from './services/ocrService';
import { Block, Page, ProcessingStatus } from './types';

// Debounce helper
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [globalStatus, setGlobalStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState<string>("Processing Document...");
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  
  // Settings
  const [fontFamily, setFontFamily] = useState<string>('Yu Gothic');
  
  // UI State
  const [isReadmeOpen, setIsReadmeOpen] = useState(false);

  // Undo History
  const [history, setHistory] = useState<Page[][]>([]);

  const activePage = pages[activePageIndex];
  const currentGranularity = activePage?.granularity ?? 5;
  const debouncedGranularity = useDebounce(currentGranularity, 500);

  const addToHistory = useCallback(() => {
    setHistory(prev => {
      // Deep copy pages for history
      const snapshot = JSON.parse(JSON.stringify(pages));
      const newHistory = [...prev, snapshot];
      // Limit history size to 20
      if (newHistory.length > 20) return newHistory.slice(newHistory.length - 20);
      return newHistory;
    });
  }, [pages]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    
    const previousPages = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    
    // Restore state
    setPages(previousPages);
    setSelectedBlockIds(new Set()); 
  }, [history]);

  // Initial file loading
  const handleFileLoaded = async (file: File) => {
    setGlobalStatus(ProcessingStatus.PROCESSING);
    setStatusMessage("Loading Document...");
    setPages([]);
    setHistory([]); // Clear history on new file
    setActivePageIndex(0);
    setSelectedBlockIds(new Set());

    try {
      let loadedPages: { src: string; width: number; height: number }[] = [];

      if (file.type === 'application/pdf') {
        loadedPages = await convertPdfToImages(file);
      } else if (file.type.startsWith('image/')) {
        const src = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        // We need dimensions
        const img = new Image();
        img.src = src;
        await new Promise((resolve) => { img.onload = resolve; });
        loadedPages = [{ src, width: img.width, height: img.height }];
      }

      // Initialize Page objects
      const newPages: Page[] = loadedPages.map((p, index) => ({
        id: `page-${Date.now()}-${index}`,
        pageNumber: index + 1,
        imageSrc: p.src,
        width: p.width,
        height: p.height,
        blocks: [],
        status: ProcessingStatus.IDLE,
        granularity: 5 // Default
      }));

      setPages(newPages);
      setGlobalStatus(ProcessingStatus.READY);
    } catch (error) {
      console.error(error);
      setGlobalStatus(ProcessingStatus.ERROR);
      alert("Error loading file. " + error);
    }
  };

  const handleGranularityChange = (newVal: number) => {
    if (!activePage) return;
    
    setPages(prev => prev.map((p, i) => {
      if (i === activePageIndex) {
        return { ...p, granularity: newVal };
      }
      return p;
    }));
  };

  // Processing Effect
  useEffect(() => {
    const processCurrentPage = async () => {
      if (pages.length === 0 || !activePage) return;

      const currentPage = activePage;
      const targetGranularity = debouncedGranularity;
      
      // We only process if:
      // 1. The page is IDLE (first load)
      // 2. OR The debounce matches the current setting AND it is different from what we last processed.
      // This prevents processing when switching pages causes a mismatch between debounced value and new page value.
      const isStable = currentPage.granularity === targetGranularity;
      const isStale = currentPage.processedGranularity !== targetGranularity;
      const needsProcessing = currentPage.status === ProcessingStatus.IDLE || (isStable && isStale);

      if (!needsProcessing) return;
      if (currentPage.status === ProcessingStatus.PROCESSING) return;

      // Optimistic update
      setPages(prev => prev.map((p, i) => i === activePageIndex ? { ...p, status: ProcessingStatus.PROCESSING } : p));
      setSelectedBlockIds(new Set()); // Clear selection on re-process

      try {
        // Use the target granularity (or default 5 for IDLE if somehow undefined)
        const g = targetGranularity || 5;
        const result = await detectBlocks(currentPage.imageSrc, g);
        
        setPages(prev => prev.map((p, i) => {
          if (i === activePageIndex) {
            return {
              ...p,
              blocks: result.blocks,
              status: ProcessingStatus.READY,
              granularity: g,
              processedGranularity: g
            };
          }
          return p;
        }));
      } catch (e) {
        setPages(prev => prev.map((p, i) => i === activePageIndex ? { ...p, status: ProcessingStatus.ERROR } : p));
      }
    };

    processCurrentPage();
  }, [debouncedGranularity, activePageIndex, pages.length]); // Intentionally omitting activePage to avoid loops, relying on index

  const handleToggleBlockType = (pageIndex: number, blockId: string) => {
    addToHistory();
    setPages(prev => prev.map((p, i) => {
      if (i !== pageIndex) return p;
      return {
        ...p,
        blocks: p.blocks.map(b => {
          if (b.id === blockId) {
            // Toggle between text and image
            if (b.type === 'text') {
              return { ...b, type: 'image' };
            } else {
              // CHANGE: Default preserveBackground to false as requested
              return { ...b, type: 'text', preserveBackground: false };
            }
          }
          return b;
        })
      };
    }));
  };
  
  const handleToggleBackground = (pageIndex: number, blockId: string) => {
    addToHistory();
    setPages(prev => prev.map((p, i) => {
      if (i !== pageIndex) return p;
      return {
        ...p,
        blocks: p.blocks.map(b => {
          if (b.id === blockId && b.type === 'text') {
             return { ...b, preserveBackground: !b.preserveBackground };
          }
          return b;
        })
      };
    }));
  };

  // Handle block selection for merging
  const handleBlockSelect = (blockId: string) => {
    setSelectedBlockIds(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  const handleMultiSelect = (ids: Set<string>) => {
    setSelectedBlockIds(ids);
  };

  const handleMergeBlocks = async () => {
    if (selectedBlockIds.size < 2) return;
    addToHistory();
    
    const page = pages[activePageIndex];
    const blocksToMerge = page.blocks.filter(b => selectedBlockIds.has(b.id));
    
    if (blocksToMerge.length < 2) return;

    // Calculate union bounding box
    const minX = Math.min(...blocksToMerge.map(b => b.x));
    const minY = Math.min(...blocksToMerge.map(b => b.y));
    const maxX = Math.max(...blocksToMerge.map(b => b.x + b.width));
    const maxY = Math.max(...blocksToMerge.map(b => b.y + b.height));
    
    const width = maxX - minX;
    const height = maxY - minY;

    try {
      // Create new merged image
      const mergedDataUrl = await extractRegion(page.imageSrc, minX, minY, width, height);
      
      const newBlock: Block = {
        id: `block-merged-${Date.now()}`,
        x: minX,
        y: minY,
        width,
        height,
        dataUrl: mergedDataUrl,
        type: 'image' // Reset to image, user can OCR again if needed
      };

      setPages(prev => prev.map((p, i) => {
        if (i !== activePageIndex) return p;
        return {
          ...p,
          blocks: [
            ...p.blocks.filter(b => !selectedBlockIds.has(b.id)), // Remove merged
            newBlock
          ]
        };
      }));
      
      setSelectedBlockIds(new Set());

    } catch (e) {
      console.error("Failed to merge blocks", e);
      alert("Failed to merge blocks.");
    }
  };

  const handleRunOcr = async () => {
    if (pages.length === 0) return;
    addToHistory();
    setGlobalStatus(ProcessingStatus.PROCESSING);
    
    try {
      // 1. Ensure all pages are sliced
      const processedPages = [...pages];
      
      for (let i = 0; i < processedPages.length; i++) {
        const p = processedPages[i];
        // If status is not ready, process it using its stored granularity or default
        if (p.status !== ProcessingStatus.READY) {
           setStatusMessage(`Analyzing Page ${i + 1} / ${processedPages.length}...`);
           const g = p.granularity || 5;
           const result = await detectBlocks(p.imageSrc, g);
           processedPages[i] = {
             ...p,
             blocks: result.blocks,
             status: ProcessingStatus.READY,
             granularity: g,
             processedGranularity: g
           };
        }
      }

      // 2. Perform OCR
      setStatusMessage("Recognizing Text (OCR)...");
      // Use 'eng+jpn' by default (automatic detection of both)
      const ocrPages = await performOcrOnPages(processedPages, 'eng+jpn');
      setPages(ocrPages);
      
      setGlobalStatus(ProcessingStatus.READY);
    } catch (e) {
      console.error(e);
      setGlobalStatus(ProcessingStatus.ERROR);
      alert("OCR Processing failed.");
    }
  };

  const handleDownload = async () => {
    if (pages.length === 0) return;

    setGlobalStatus(ProcessingStatus.PROCESSING);
    setStatusMessage("Generating PowerPoint...");

    try {
      const processedPages = [...pages];
      let needsUpdate = false;

      for (let i = 0; i < processedPages.length; i++) {
        // Ensure every page is processed with its specific granularity
        if (processedPages[i].status !== ProcessingStatus.READY) {
           const g = processedPages[i].granularity || 5;
           const result = await detectBlocks(processedPages[i].imageSrc, g);
           processedPages[i] = {
             ...processedPages[i],
             blocks: result.blocks,
             status: ProcessingStatus.READY,
             granularity: g,
             processedGranularity: g
           };
           needsUpdate = true;
        }
      }
      
      if (needsUpdate) setPages(processedPages);

      await generatePptx(processedPages, fontFamily);
      
      setGlobalStatus(ProcessingStatus.READY);
    } catch (error) {
      alert("Failed to generate PowerPoint.");
      console.error(error);
      setGlobalStatus(ProcessingStatus.ERROR);
    }
  };

  const handleReset = () => {
    setPages([]);
    setHistory([]);
    setActivePageIndex(0);
    setGlobalStatus(ProcessingStatus.IDLE);
    setSelectedBlockIds(new Set());
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-slate-50">
      
      <ReadmeModal 
        isOpen={isReadmeOpen} 
        onClose={() => setIsReadmeOpen(false)} 
      />

      {pages.length === 0 ? (
        // Empty State / Upload Screen
        <div className="w-full h-screen flex flex-col items-center justify-center p-6 animate-fade-in relative">
          {/* Help button for initial screen */}
          <button 
            onClick={() => setIsReadmeOpen(true)}
            className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 bg-white rounded-full text-slate-500 font-medium shadow-sm hover:shadow-md hover:text-indigo-600 transition-all border border-slate-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to use
          </button>

          <div className="max-w-2xl w-full text-center space-y-8">
            <div>
              <h1 className="text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                <span className="text-indigo-600">Slice</span> & Slide
              </h1>
              <p className="text-xl text-slate-500">
                Turn flat images and PDFs into editable PowerPoint slides instantly.
                <br/>Intelligent layout decomposition using Computer Vision.
              </p>
            </div>
            
            {globalStatus === ProcessingStatus.PROCESSING ? (
              <div className="h-96 w-full flex items-center justify-center border-4 border-dashed border-slate-200 rounded-3xl bg-white">
                 <div className="flex flex-col items-center">
                    <svg className="animate-spin h-10 w-10 text-indigo-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-slate-500 font-medium">{statusMessage}</span>
                 </div>
              </div>
            ) : (
              <DropZone onFileLoaded={handleFileLoaded} />
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left mt-12">
              <FeatureCard 
                icon="📄" 
                title="PDF Support" 
                desc="Upload multi-page PDFs; we handle every page." 
              />
              <FeatureCard 
                icon="✂️" 
                title="Smart Slicing" 
                desc="Automatically detects paragraphs, charts, and images." 
              />
              <FeatureCard 
                icon="🔤" 
                title="OCR Text" 
                desc="Automatically converts recognized text blocks into editable text." 
              />
            </div>
          </div>
        </div>
      ) : (
        // Editor Interface
        <>
          <main className="flex-1 h-screen p-4 md:p-6 lg:p-8 flex flex-col relative">
            <header className="md:hidden flex justify-between items-center mb-4">
              <h1 className="font-bold text-slate-800">Slice & Slide</h1>
              <button onClick={handleReset} className="text-sm text-slate-500">Reset</button>
            </header>
            
            {activePage && (
              <PreviewArea 
                page={activePage}
                isProcessing={activePage.status === ProcessingStatus.PROCESSING}
                totalPages={pages.length}
                currentPageIndex={activePageIndex}
                onPageChange={setActivePageIndex}
                onToggleBlockType={(blockId) => handleToggleBlockType(activePageIndex, blockId)}
                selectedBlockIds={selectedBlockIds}
                onBlockSelect={handleBlockSelect}
                onMultiSelect={handleMultiSelect}
                onMergeBlocks={handleMergeBlocks}
                onToggleBackground={(blockId) => handleToggleBackground(activePageIndex, blockId)}
              />
            )}
            
            <div className="mt-4 text-center text-slate-400 text-xs md:hidden">
              Use desktop for best experience
            </div>
          </main>

          {activePage && (
            <ControlPanel 
              granularity={currentGranularity}
              setGranularity={handleGranularityChange}
              blockCount={activePage.blocks.length}
              onDownload={handleDownload}
              onRunOcr={handleRunOcr}
              onReset={handleReset}
              onUndo={handleUndo}
              canUndo={history.length > 0}
              isProcessing={globalStatus === ProcessingStatus.PROCESSING}
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
              onShowReadme={() => setIsReadmeOpen(true)}
            />
          )}

          {/* Global Processing Overlay (for Export) */}
          {globalStatus === ProcessingStatus.PROCESSING && pages.length > 0 && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full">
                <svg className="animate-spin h-12 w-12 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Processing</h3>
                <p className="text-slate-500 text-center">{statusMessage}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const FeatureCard = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="text-2xl mb-2">{icon}</div>
    <h3 className="font-bold text-slate-800 mb-1">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
  </div>
);
