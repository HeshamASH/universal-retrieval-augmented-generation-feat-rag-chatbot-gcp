import React, { useState, useMemo } from 'react';
import { Source } from '../types';

interface EditedFileRecord {
  file: Source;
  originalContent: string;
  currentContent: string;
}

type DiffViewMode = 'split' | 'unified';

interface DiffLine {
    type: 'add' | 'remove' | 'same';
    text: string;
}

interface SplitDiffLine {
    left?: { type: 'remove' | 'same'; text: string; };
    right?: { type: 'add' | 'same'; text: string; };
}

// --- Diff Calculation Logic ---

const createUnifiedDiff = (original: string, suggested: string): DiffLine[] => {
    // This is a simplified version of the LCS-based diff algorithm for unified view.
    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');
    const dp = Array(originalLines.length + 1).fill(null).map(() => Array(suggestedLines.length + 1).fill(0));
    for (let i = 1; i <= originalLines.length; i++) {
        for (let j = 1; j <= suggestedLines.length; j++) {
            if (originalLines[i - 1] === suggestedLines[j - 1]) dp[i][j] = 1 + dp[i - 1][j - 1];
            else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    let i = originalLines.length, j = suggestedLines.length;
    const diff: DiffLine[] = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalLines[i - 1] === suggestedLines[j - 1]) {
            diff.unshift({ type: 'same', text: `  ${originalLines[i - 1]}` }); i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            diff.unshift({ type: 'add', text: `+ ${suggestedLines[j - 1]}` }); j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            diff.unshift({ type: 'remove', text: `- ${originalLines[i - 1]}` }); i--;
        } else break;
    }
    return diff;
};

const createSplitDiff = (original: string, suggested: string): SplitDiffLine[] => {
    // This logic generates a line-by-line diff suitable for side-by-side display.
    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');
    const dp = Array(originalLines.length + 1).fill(null).map(() => Array(suggestedLines.length + 1).fill(0));
    for (let i = 1; i <= originalLines.length; i++) {
        for (let j = 1; j <= suggestedLines.length; j++) {
            if (originalLines[i - 1] === suggestedLines[j - 1]) dp[i][j] = 1 + dp[i - 1][j - 1];
            else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    let i = originalLines.length, j = suggestedLines.length;
    const diff: SplitDiffLine[] = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalLines[i - 1] === suggestedLines[j - 1]) {
            diff.unshift({ left: { type: 'same', text: originalLines[i - 1] }, right: { type: 'same', text: suggestedLines[j - 1] } }); i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            diff.unshift({ right: { type: 'add', text: suggestedLines[j - 1] } }); j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            diff.unshift({ left: { type: 'remove', text: originalLines[i - 1] } }); i--;
        } else break;
    }
    return diff;
};

// --- Icons ---

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// --- Component ---

interface DiffViewerModalProps {
  record: EditedFileRecord;
  onClose: () => void;
}

const DiffViewerModal: React.FC<DiffViewerModalProps> = ({ record, onClose }) => {
    const [viewMode, setViewMode] = useState<DiffViewMode>('split');
    
    const unifiedDiff = useMemo(() => createUnifiedDiff(record.originalContent, record.currentContent), [record]);
    const splitDiff = useMemo(() => createSplitDiff(record.originalContent, record.currentContent), [record]);
    
    const getUnifiedLineClass = (type: DiffLine['type']) => {
        switch (type) {
            case 'add': return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300';
            case 'remove': return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300';
            default: return 'text-slate-600 dark:text-slate-400';
        }
    };
    
    const getSplitLineClass = (type?: 'add' | 'remove' | 'same') => {
        switch (type) {
            case 'add': return 'bg-green-100 dark:bg-green-900/30';
            case 'remove': return 'bg-red-100 dark:bg-red-900/30';
            default: return '';
        }
    };

    const ViewModeToggle = () => (
        <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-800 rounded-lg">
            <button 
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${viewMode === 'split' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
            >
                Split
            </button>
            <button 
                onClick={() => setViewMode('unified')}
                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${viewMode === 'unified' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
            >
                Unified
            </button>
        </div>
    );

    return (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div>
                    <h3 className="font-bold text-lg text-cyan-600 dark:text-cyan-400">{record.file.fileName}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{record.file.path}</p>
                </div>
                <ViewModeToggle />
              </div>
              <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Close diff viewer">
                <CloseIcon />
              </button>
            </header>
            <main className="overflow-auto bg-slate-50 dark:bg-slate-950">
                {viewMode === 'unified' ? (
                     <pre className="p-4 text-sm font-mono">
                        <code>
                            {unifiedDiff.length > 0 ? (
                                unifiedDiff.map((line, index) => (
                                    <div key={index} className={`whitespace-pre-wrap ${getUnifiedLineClass(line.type)}`}>
                                        {line.text || ' '}
                                    </div>
                                ))
                            ) : (
                               <div className="text-slate-500">No changes detected in this file.</div>
                            )}
                        </code>
                    </pre>
                ) : (
                    <div className="grid grid-cols-2 text-sm font-mono">
                        <pre className="p-4 overflow-x-auto border-r border-slate-200 dark:border-slate-800">
                            <code>
                                {splitDiff.map((line, index) => (
                                    <div key={`left-${index}`} className={`whitespace-pre-wrap ${getSplitLineClass(line.left?.type)}`}>
                                        {line.left ? `- ${line.left.text}` : ' '}
                                    </div>
                                ))}
                            </code>
                        </pre>
                         <pre className="p-4 overflow-x-auto">
                            <code>
                                 {splitDiff.map((line, index) => (
                                    <div key={`right-${index}`} className={`whitespace-pre-wrap ${getSplitLineClass(line.right?.type)}`}>
                                       {line.right ? `+ ${line.right.text}` : ' '}
                                    </div>
                                ))}
                            </code>
                        </pre>
                    </div>
                )}
            </main>
          </div>
        </div>
    );
};

export default DiffViewerModal;