import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, Source, ModelId, DataSource, Attachment } from '../types';
import Message from './Message';
import ModelSwitcher from './ModelSwitcher';
import AttachmentPreview from './AttachmentPreview';
import { blobToBase64 } from '../utils/fileUtils';

// --- Welcome Block Data ---
const WelcomeBlock: React.FC<{
  onConnectDataSource: () => void;
}> = ({ onConnectDataSource }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="max-w-xl">
                <div className="mx-auto bg-gradient-to-r from-cyan-500 to-blue-500 p-3 rounded-xl inline-block mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                    </svg>
                </div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome to Elastic CodeMind</h2>
                <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
                   Connect a data source to begin asking questions about your code, documents, and more.
                </p>
                <button
                    onClick={onConnectDataSource}
                    className="bg-cyan-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-cyan-500 transition-colors duration-200"
                >
                    Connect Data Source
                </button>
            </div>
        </div>
    );
};


// --- Icons ---
const SendIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
);

const MicIcon: React.FC<{ isListening: boolean }> = ({ isListening }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-6 h-6 ${isListening ? 'text-red-500' : ''}`}>
        <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
        <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.75 6.75 0 1 1-13.5 0v-1.5A.75.75 0 0 1 6 10.5Z" />
    </svg>
);

const AttachmentIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3.375 3.375 0 1 1 18.375 12.74Z" />
    </svg>
);


// --- Main Chat Interface ---

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (query: string, attachment?: Attachment) => void;
  onSelectSource: (source: Source) => void;
  onSuggestionAction: (messageIndex: number, action: 'accepted' | 'rejected') => void;
  selectedModel: ModelId;
  onModelChange: (modelId: ModelId) => void;
  activeDataSource: DataSource | undefined | null;
  onConnectDataSource: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, onSendMessage, onSelectSource, onSuggestionAction, selectedModel, onModelChange, activeDataSource, onConnectDataSource }) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
        };
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => console.error('Speech recognition error:', event.error);
        recognitionRef.current = recognition;
    }
  }, []);

  const handleToggleListening = () => {
    if (isListening) {
        recognitionRef.current?.stop();
    } else {
        recognitionRef.current?.start();
        setIsListening(true);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        try {
            const base64Content = await blobToBase64(file);
            setAttachment({
                name: file.name,
                type: file.type,
                size: file.size,
                content: base64Content,
            });
        } catch (error) {
            console.error("Error processing file for attachment:", error);
        }
    }
    // Reset file input to allow selecting the same file again
    event.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSendMessage(input, attachment ?? undefined);
    setInput('');
    setAttachment(null);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 && !activeDataSource ? (
            <WelcomeBlock onConnectDataSource={onConnectDataSource} />
        ) : (
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <Message key={index} message={msg} onSelectSource={onSelectSource} onSuggestionAction={(action) => onSuggestionAction(index, action)} />
            ))}
             {isLoading && messages.length > 0 && messages[messages.length-1].role === 'user' && (
                <Message message={{role: 'model', content: ''}} onSelectSource={()=>{}} onSuggestionAction={()=>{}} />
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900">
        <form onSubmit={handleSubmit}>
          {attachment && (
            <AttachmentPreview attachment={attachment} onRemove={() => setAttachment(null)} />
          )}
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : activeDataSource ? "Ask a follow-up..." : "Ask a question..."}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-12 pr-40 py-3 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition duration-200"
              disabled={isLoading}
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 rounded-lg p-2 disabled:text-slate-400 dark:disabled:text-slate-600 transition-colors duration-200"
                    aria-label="Attach file"
                >
                    <AttachmentIcon />
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,application/pdf"
                />
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <ModelSwitcher
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                disabled={isLoading}
              />
               {recognitionRef.current && (
                <button
                    type="button"
                    onClick={handleToggleListening}
                    disabled={isLoading}
                    className="text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 rounded-lg p-2 disabled:text-slate-400 dark:disabled:text-slate-600 transition-colors duration-200"
                    aria-label="Use microphone"
                >
                    <MicIcon isListening={isListening} />
                </button>
               )}
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !attachment)}
                className="bg-cyan-600 text-white rounded-lg p-2 hover:bg-cyan-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400 transition-colors duration-200"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;