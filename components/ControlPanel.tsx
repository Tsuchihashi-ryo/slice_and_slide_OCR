
import React from 'react';
import { Block } from '../types';

interface ControlPanelProps {
  granularity: number;
  setGranularity: (val: number) => void;
  blockCount: number;
  onDownload: () => void;
  onRunOcr: () => void;
  onReset: () => void;
  onUndo: () => void;
  canUndo: boolean;
  isProcessing: boolean;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  onShowReadme: () => void; // New prop
}

const FONT_OPTIONS = [
  { label: 'Arial (Standard)', value: 'Arial' },
  { label: 'Calibri', value: 'Calibri' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Meiryo (Japanese)', value: 'Meiryo' },
  { label: 'Yu Gothic (Japanese)', value: 'Yu Gothic' },
  { label: 'MS PGothic (Japanese)', value: 'MS PGothic' },
];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  granularity,
  setGranularity,
  blockCount,
  onDownload,
  onRunOcr,
  onReset,
  onUndo,
  canUndo,
  isProcessing,
  fontFamily,
  setFontFamily,
  onShowReadme,
}) => {
  return (
    <div className="w-full md:w-80 lg:w-96 bg-white border-l border-slate-200 p-6 flex flex-col h-full shadow-xl z-20 overflow-y-auto">
      
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="text-indigo-600">Slice</span> & Slide
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Decompose images into editable slides.
          </p>
        </div>
        <button 
          onClick={onShowReadme}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-indigo-600 transition-colors"
          title="Usage Guide"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
      
      {/* Undo Button */}
      <div className="mb-6">
        <button
          onClick={onUndo}
          disabled={!canUndo || isProcessing}
          className={`
            w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors border
            ${canUndo && !isProcessing
              ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
              : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Undo Action
        </button>
      </div>

      <div className="flex-1 space-y-8">
        
        {/* Granularity Control */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-slate-700">Detection Sensitivity</label>
            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
              Level {granularity}
            </span>
          </div>
          
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={granularity}
            onChange={(e) => setGranularity(parseInt(e.target.value))}
            disabled={isProcessing}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>Fine (Details)</span>
            <span>Coarse (Blocks)</span>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Detected Blocks</span>
            <span className="text-2xl font-bold text-slate-800">{blockCount}</span>
          </div>
        </div>

        {/* OCR Settings */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <button
            onClick={onRunOcr}
            disabled={blockCount === 0 || isProcessing}
            className={`
              w-full py-3 rounded-xl flex items-center justify-center gap-2 font-semibold shadow-sm transition-all border
              ${blockCount === 0 || isProcessing
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
              }
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Detect Text (OCR)
          </button>
        </div>

      </div>

      {/* Export Actions */}
      <div className="space-y-3 mt-4 pt-6 border-t border-slate-100">
        
        <label className="text-sm font-semibold text-slate-700 block">PPTX Font Family</label>
        <select 
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          disabled={isProcessing}
          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-2"
        >
          {FONT_OPTIONS.map(font => (
            <option key={font.value} value={font.value}>{font.label}</option>
          ))}
        </select>

        <button
          onClick={onDownload}
          disabled={blockCount === 0 || isProcessing}
          className={`
            w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-lg transition-all
            ${blockCount === 0 || isProcessing
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:-translate-y-0.5'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export to PPTX
        </button>

        <button
          onClick={onReset}
          className="w-full py-3 rounded-xl font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
        >
          Start Over
        </button>
      </div>
    </div>
  );
};
