"use client";

import React, { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import FileContextHandler from '@/components/FileContextHandler';
import { toast } from "sonner";

export default function Home() {
  const [userId] = useState<string>("user_" + Math.random().toString(36).substring(7));
  const [sessionContextText, setSessionContextText] = useState<string | null>(null);
  const [sessionFileName, setSessionFileName] = useState<string | null>(null);

  const handleFileProcessed = (fileName: string, textContent: string | null) => {
    setSessionFileName(fileName);
    setSessionContextText(textContent);
    if (textContent) {
        toast.success(`Context from '${fileName}' loaded for this session.`);
    } else {
         toast.info(`Context from '${fileName}' cleared.`);
    }
  };

  const handleFileError = (fileName: string, errorMsg: string) => {
      toast.error(`Error processing '${fileName}': ${errorMsg}`);
      setSessionFileName(null);
      setSessionContextText(null);
  };

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      <div className="w-full max-w-xs md:max-w-sm lg:max-w-md border-r border-border p-4 flex flex-col overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4 text-center sticky top-0 bg-background py-2">
          Session Context
        </h2>
        <FileContextHandler
          onFileProcessed={handleFileProcessed}
          onFileError={handleFileError}
        />
         {sessionFileName && (
             <div className="mt-4 pt-4 border-t border-border text-center">
                 <p className="text-sm font-medium">Active Session File:</p>
                 <p className="text-xs text-muted-foreground truncate" title={sessionFileName}>{sessionFileName}</p>
                 <p className="text-xs text-muted-foreground mt-1">({sessionContextText ? `${sessionContextText.length.toLocaleString()} chars` : 'Cleared'})</p>
             </div>
         )}
        <div className="mt-auto pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            User ID: <span className="font-mono text-xs">{userId}</span>
          </p>
        </div>
      </div>

      <div className="flex-grow flex flex-col">
        <ChatInterface userId={userId} sessionContextText={sessionContextText} />
      </div>
    </main>
  );
}