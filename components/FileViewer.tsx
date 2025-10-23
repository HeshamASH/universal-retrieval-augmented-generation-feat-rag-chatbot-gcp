import React, { useRef, useEffect } from 'react';
import { Source } from '../types';

declare var hljs: any;
declare var marked: any;

interface FileViewerProps {
  file: Source;
  content: string;
  onClose: () => void;
}

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const FileViewer: React.FC<FileViewerProps> = ({ file, content, onClose }) => {
  const codeRef = useRef<HTMLElement>(null);
  const markdownRef = useRef<HTMLDivElement>(null);
  
  const isMarkdown = file.fileName.toLowerCase().endsWith('.md');

  useEffect(() => {
    if (content === 'Loading...') return;

    if (isMarkdown && markdownRef.current && typeof marked !== 'undefined') {
        const rawHtml = marked.parse(content, { breaks: true, gfm: true });
        // Basic sanitization to prevent script injection
        const sanitizedHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        markdownRef.current.innerHTML = sanitizedHtml;
        markdownRef.current.querySelectorAll('pre code').forEach((block) => {
            if (typeof hljs !== 'undefined') {
              hljs.highlightElement(block as HTMLElement);
            }
        });
    } else if (!isMarkdown && codeRef.current && typeof hljs !== 'undefined') {
       // For non-markdown, just highlight the whole block
       const language = file.fileName.split('.').pop() || 'plaintext';
       codeRef.current.className = `language-${language}`;
       hljs.highlightElement(codeRef.current);
    }
  }, [content, isMarkdown, file.fileName]);

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
          <div>
            <h3 className="font-bold text-lg text-cyan-600 dark:text-cyan-400">{file.fileName}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{file.path}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Close file viewer">
            <CloseIcon />
          </button>
        </header>
        <main className="p-4 overflow-auto">
          {content === 'Loading...' ? (
             <div className="flex justify-center items-center h-full">
                <span className="w-3 h-3 bg-slate-400 rounded-full inline-block animate-pulse"></span>
             </div>
          ) : isMarkdown ? (
             <div 
              ref={markdownRef}
              className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-pre:bg-slate-200 dark:prose-pre:bg-slate-950 prose-pre:p-4 prose-code:text-cyan-600 dark:prose-code:text-cyan-300 prose-code:bg-slate-200 dark:prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono"
             />
          ) : (
            <pre className="bg-slate-50 dark:bg-slate-950 rounded-md p-4 overflow-x-auto">
              <code ref={codeRef} className="text-sm font-mono whitespace-pre-wrap">
                {content}
              </code>
            </pre>
          )}
        </main>
      </div>
    </div>
  );
};

export default FileViewer;