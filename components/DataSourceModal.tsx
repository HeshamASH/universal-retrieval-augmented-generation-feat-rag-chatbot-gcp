import React, { useRef, useState, useCallback } from 'react';
import { DataSource } from '../types';

interface DataSourceModalProps {
  onClose: () => void;
  onConnect: (files: File[], dataSource: DataSource) => void;
}

// --- Icons ---
const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const FolderIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0A2.25 2.25 0 0 1 3.75 7.5h16.5a2.25 2.25 0 0 1 2.25 2.25m-18.75 0h18.75v.008c0 .022 0 .041 0 .061a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25v-.06a2.25 2.25 0 0 1 0-.008Z" />
    </svg>
);

const FileIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
);

const DriveIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.71,3.5,1.5,13.9,4.44,19.5,10.65,9.1ZM9.15,20.5,12.09,15,18.3,20.5ZM12.29,8.71,6.54,18.23H17.45L14.71,13.3,12.29,8.71ZM22.5,13.9,16.29,3.5,13.35,9.1,19.56,19.5Z"/>
    </svg>
);

const DatabaseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5-1.125v.113" />
    </svg>
);



const DataSourceModal: React.FC<DataSourceModalProps> = ({ onClose, onConnect }) => {
    const folderInputRef = useRef<HTMLInputElement>(null);
    const filesInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: 'folder' | 'files') => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList);
        const name = type === 'folder' 
            ? (files[0] as any).webkitRelativePath.split('/')[0] || 'Project Folder'
            : `${files.length} file${files.length > 1 ? 's' : ''}`;
        
        const dataSource: DataSource = {
            type,
            name,
            fileCount: files.length,
        };
        onConnect(files, dataSource);
    }, [onConnect]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700/50">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Connect a Data Source</h2>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Close">
                        <CloseIcon />
                    </button>
                </header>
                <main className="p-6">
                    <p className="text-slate-600 dark:text-slate-400 mb-6 text-center">
                        Select a source to begin a new chat session. The AI will use this data as its primary context.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Folder Upload */}
                        <button
                            onClick={() => folderInputRef.current?.click()}
                            className="flex flex-col items-center justify-center text-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <FolderIcon className="text-cyan-600 dark:text-cyan-400 mb-3" />
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Upload Folder</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Codebases, projects, etc.</p>
                        </button>
                        <input type="file" ref={folderInputRef} onChange={(e) => handleFileChange(e, 'folder')} className="hidden" multiple {...{ webkitdirectory: "true" }} />

                        {/* Files Upload */}
                        <button
                             onClick={() => filesInputRef.current?.click()}
                            className="flex flex-col items-center justify-center text-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <FileIcon className="text-cyan-600 dark:text-cyan-400 mb-3" />
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Upload Files</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">PDFs, .txt, .md, etc.</p>
                        </button>
                        <input type="file" ref={filesInputRef} onChange={(e) => handleFileChange(e, 'files')} className="hidden" multiple accept=".pdf,.txt,.md,.html,.json,.js,.ts,.py,.css" />

                        {/* Google Drive - Mock */}
                         <button className="flex flex-col items-center justify-center text-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 transition-colors opacity-50 cursor-not-allowed">
                            <DriveIcon className="text-slate-500 dark:text-slate-400 mb-3" />
                            <h3 className="font-semibold text-slate-600 dark:text-slate-400">Google Drive</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-500">Coming Soon</p>
                        </button>
                        
                        {/* Database - Mock */}
                        <button className="flex flex-col items-center justify-center text-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 transition-colors opacity-50 cursor-not-allowed">
                            <DatabaseIcon className="text-slate-500 dark:text-slate-400 mb-3" />
                            <h3 className="font-semibold text-slate-600 dark:text-slate-400">SQL Database</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-500">Coming Soon</p>
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DataSourceModal;
