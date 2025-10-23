import React, { useRef, useEffect, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';

declare var hljs: any;
declare var marked: any;

interface MarkdownRendererProps {
  text: string;
}

const FileIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 inline-block mr-1 align-text-bottom">
        <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h6.89a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061v5.758A1.5 1.5 0 0 1 12.5 13H3.5A1.5 1.5 0 0 1 2 11.5v-8Z" />
    </svg>
);

const CopyIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M5.75 3a.75.75 0 0 0-.75.75v9.5a.75.75 0 0 0 .75.75h4.5a.75.75 0 0 0 .75-.75V8.31l-2.22 2.22a.75.75 0 0 1-1.06-1.06L9.44 7.25l-1.72-1.72a.75.75 0 0 1-1.06-1.06L8.94 2.25l2.03 2.03a.75.75 0 0 1-1.06 1.06L8.53 4.06l-.5.5a.75.75 0 0 0 0 1.06l.5.5L9.59 7.5l-1.5 1.5v2.25h-1.5V3.75A.75.75 0 0 0 5.75 3Z" />
        <path d="M3 1.75A1.75 1.75 0 0 1 4.75 0h5.5A1.75 1.75 0 0 1 12 1.75v3.5A1.75 1.75 0 0 1 10.25 7h-1.5A.75.75 0 0 1 8 6.25v-1.5a.75.75 0 0 1 .75-.75h1.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25h-5.5a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h1.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-1.5A1.75 1.75 0 0 1 3 13.25v-11.5Z" />
    </svg>
);


const CopyToSheetsButton: React.FC<{ table: HTMLTableElement }> = ({ table }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        // FIX: Add explicit type to `rows` to help TypeScript infer correct types for `row` and `cell`.
        const rows: HTMLTableRowElement[] = Array.from(table.querySelectorAll('tr'));
        const csvContent = rows.map(row => 
            Array.from(row.querySelectorAll('th, td'))
                 .map(cell => `"${cell.textContent?.replace(/"/g, '""') ?? ''}"`)
                 .join(',')
        ).join('\n');

        navigator.clipboard.writeText(csvContent).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy table content: ', err);
        });
    };

    return (
        <button onClick={handleCopy} className="absolute top-2 right-2 flex items-center gap-1.5 text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
            <CopyIcon />
            {copied ? 'Copied!' : 'Copy for Sheets'}
        </button>
    );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ text }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    const postProcessHtml = useCallback(() => {
        if (!contentRef.current) return;
        
        // Enhance file mentions: `file:path/to/file.ext` -> styled span
        const fileRegex = /`file:([^`]+)`/g;
        contentRef.current.innerHTML = contentRef.current.innerHTML.replace(
            fileRegex,
            `<span class="inline-flex items-center font-mono text-sm text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/50 px-1.5 py-0.5 rounded-md"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 inline-block mr-1 align-text-bottom"><path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h6.89a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061v5.758A1.5 1.5 0 0 1 12.5 13H3.5A1.5 1.5 0 0 1 2 11.5v-8Z" /></svg>$1</span>`
        );
        
        // Inject React component for tables
        contentRef.current.querySelectorAll('table').forEach(tableEl => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative mt-4';
            tableEl.parentNode?.insertBefore(wrapper, tableEl);
            wrapper.appendChild(tableEl);

            const buttonContainer = document.createElement('div');
            wrapper.appendChild(buttonContainer);
            ReactDOM.render(<CopyToSheetsButton table={tableEl} />, buttonContainer);
        });

    }, []);

    useEffect(() => {
        if (contentRef.current && typeof marked !== 'undefined') {
            const rawHtml = marked.parse(text, { breaks: true, gfm: true });
            const sanitizedHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            contentRef.current.innerHTML = sanitizedHtml;

            contentRef.current.querySelectorAll('pre code').forEach((block) => {
                if (typeof hljs !== 'undefined') {
                    hljs.highlightElement(block as HTMLElement);
                }
            });
            
            postProcessHtml();
        }
    }, [text, postProcessHtml]);

    return <div ref={contentRef} className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-pre:bg-slate-200 dark:prose-pre:bg-slate-950 prose-pre:p-4 prose-code:text-cyan-600 dark:prose-code:text-cyan-300 prose-code:bg-slate-200 dark:prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono prose-table:border prose-table:border-slate-200 dark:prose-table:border-slate-700 prose-thead:bg-slate-100 dark:prose-thead:bg-slate-800 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2" />;
};

export default MarkdownRenderer;