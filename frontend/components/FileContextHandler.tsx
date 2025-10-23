"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UploadCloud, File as FileIcon, X, Loader2 } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';

const PDF_WORKER_URL = '/static/scripts/pdf.worker.min.mjs';

interface FileContextHandlerProps {
  onFileProcessed: (fileName: string, textContent: string | null) => void;
  onFileError: (fileName: string, errorMsg: string) => void;
}

const FileContextHandler: React.FC<FileContextHandlerProps> = ({
  onFileProcessed,
  onFileError,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
    } catch (error) {
         console.error("Error setting pdf.js worker source:", error);
         toast.error("Could not initialize PDF reader component.");
    }
  }, []);

  const processFile = useCallback(async (fileToProcess: File) => {
    setIsProcessing(true);
    setFileName(fileToProcess.name);
    let extractedText: string | null = null;
    let errorMsg: string | null = null;

    try {
      const fileType = fileToProcess.type;
      const reader = new FileReader();

      if (fileType === 'application/pdf') {
        extractedText = await new Promise<string>((resolve, reject) => {
          reader.onload = async (event) => {
            if (!event.target?.result) {
              return reject(new Error("Failed to read file content."));
            }
            try {
               const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
               const loadingTask = pdfjsLib.getDocument({ data: typedArray });
               const pdf = await loadingTask.promise;
               let textContent = '';
               for (let i = 1; i <= pdf.numPages; i++) {
                 const page = await pdf.getPage(i);
                 const text = await page.getTextContent();
                 textContent += text.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
               }
               resolve(textContent);
            } catch (pdfError) {
                console.error("PDF processing error:", pdfError);
                reject(new Error(`Failed to process PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`));
            }
          };
          reader.onerror = () => reject(new Error("Error reading file for PDF processing."));
          reader.readAsArrayBuffer(fileToProcess);
        });

      } else if (fileType === 'text/plain' || fileType === 'text/markdown') {
        extractedText = await new Promise<string>((resolve, reject) => {
          reader.onload = (event) => {
             resolve(event.target?.result as string);
          };
           reader.onerror = () => reject(new Error("Error reading text file."));
          reader.readAsText(fileToProcess, 'UTF-8');
        });
      } else {
        errorMsg = "Unsupported file type. Please use PDF, TXT, or MD.";
      }
    } catch (error) {
       console.error("File processing error:", error);
       errorMsg = error instanceof Error ? error.message : "An unknown error occurred during processing.";
    } finally {
      setIsProcessing(false);
      if (errorMsg) {
        onFileError(fileToProcess.name, errorMsg);
      } else {
        onFileProcessed(fileToProcess.name, extractedText);
      }
    }
  }, [onFileProcessed, onFileError]);


  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
     if (fileRejections.length > 0) {
       fileRejections.forEach(({ file, errors }) => {
         errors.forEach(err => {
            const msg = `Error selecting ${file.name}: ${err.message}`;
            toast.error(msg);
            onFileError(file.name, err.message);
         });
       });
       setFile(null);
       return;
     }

    if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        processFile(acceptedFiles[0]);
    }
  }, [processFile, onFileError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024,
    disabled: isProcessing,
  });

  const clearFileContext = () => {
     setFile(null);
     setFileName(null);
     onFileProcessed("", null);
  }

  return (
    <div className="flex flex-col space-y-3">
      <div
        {...getRootProps()}
        className={`relative flex flex-col items-center justify-center w-full p-4 border-2 border-dashed rounded-md cursor-pointer text-center transition-colors
                   ${isProcessing ? 'cursor-not-allowed bg-muted/50' : ''}
                   ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
      >
        <input {...getInputProps()} disabled={isProcessing} />
        {isProcessing ? (
           <>
              <Loader2 className="w-8 h-8 mb-2 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Processing '{fileName}'...</p>
           </>
        ) : isDragActive ? (
           <>
              <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Drop the file here...</p>
           </>
        ) : (
          <>
            <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="mb-1 text-sm text-muted-foreground">
              <span className="font-semibold">Click or drag</span> to add temporary context
            </p>
            <p className="text-xs text-muted-foreground">PDF, TXT, MD (max 10MB)</p>
          </>
        )}
      </div>

       {file && !isProcessing && (
         <div className="p-2 border rounded-md flex items-center justify-between bg-muted/50">
           <div className="flex items-center space-x-2 overflow-hidden">
             <FileIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
             <span className="text-sm font-medium truncate" title={file.name}>{file.name}</span>
           </div>
           <Button variant="ghost" size="sm" onClick={clearFileContext} className="text-muted-foreground hover:text-destructive">
             Clear
           </Button>
         </div>
       )}
    </div>
  );
};

export default FileContextHandler;
