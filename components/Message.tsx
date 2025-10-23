import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChatMessage, MessageRole, Source, ResponseType, ModelId, MODELS } from '../types';
import SourcePill from './SourcePill';
import CodeSuggestionViewer from './CodeSuggestionViewer';
import MarkdownRenderer from './MarkdownRenderer';
import AttachmentPreview from './AttachmentPreview';

interface MessageProps {
  message: ChatMessage;
  onSelectSource: (source: Source) => void;
  onSuggestionAction: (action: 'accepted' | 'rejected') => void;
}

const UserIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
);

const ModelIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M9.315 7.585c.932-1.003 2.443-1.003 3.375 0l1.453 1.559c.466.502.706 1.168.706 1.846 0 .678-.24 1.344-.706 1.846l-1.453 1.559c-.932 1.003-2.443 1.003-3.375 0l-1.453-1.559a2.983 2.983 0 0 1-.706-1.846c0-.678.24-1.344.706-1.846l1.453-1.559Z" clipRule="evenodd" />
        <path d="M21.565 4.435a.75.75 0 0 0-1.06 0l-2.5 2.5a.75.75 0 0 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06Z" />
        <path d="M3.5 6.995a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 0 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1 0-1.06Z" />
        <path d="M17.005 20.5a.75.75 0 0 0 0-1.06l-2.5-2.5a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0Z" />
        <path d="M6.995 3.5a.75.75 0 0 0-1.06 0l-2.5 2.5a.75.75 0 0 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06Z" />
    </svg>
);

const SpeakerOnIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M7.125 5.334A.75.75 0 0 0 6 6v8a.75.75 0 0 0 1.125.666l5.417-4a.75.75 0 0 0 0-1.332l-5.417-4ZM12.5 6.012a.75.75 0 0 0-1.125-.666l-5.417 4a.75.75 0 0 0 0 1.332l5.417 4A.75.75 0 0 0 12.5 14V6.012Z" />
    </svg>
);

const SpeakerOffIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M9.53 3.219a.75.75 0 0 1 .94 0l6.25 5.5a.75.75 0 0 1-.94 1.162L15 9.498v1.002a3.5 3.5 0 0 1-3.5 3.5h-1a3.5 3.5 0 0 1-3.5-3.5v-1.002L5.22 9.881a.75.75 0 0 1-.94-1.162l5.25-4.5ZM8.5 8.5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1Z" />
    </svg>
);

const MessageMetadata: React.FC<{ responseType?: ResponseType, modelId?: ModelId }> = ({ responseType, modelId }) => {
    if (!responseType || !modelId) return null;
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return null;

    return (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-2">
            <span>{responseType}</span>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span>{model.name}</span>
        </div>
    );
};


const Message: React.FC<MessageProps> = ({ message, onSelectSource, onSuggestionAction }) => {
  const isModel = message.role === MessageRole.MODEL;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handleToggleSpeech = useCallback(() => {
    if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    } else {
        const utterance = new SpeechSynthesisUtterance(message.content);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
            console.error("Speech synthesis error", e);
            setIsSpeaking(false);
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    }
  }, [isSpeaking, message.content]);

  useEffect(() => {
    return () => {
        // Cleanup speech synthesis on component unmount
        if (utteranceRef.current) {
            window.speechSynthesis.cancel();
        }
    };
  }, []);

  return (
    <div className={`flex items-start gap-4 ${!isModel && 'flex-row-reverse'}`}>
      <div className={`rounded-full p-2 flex-shrink-0 ${isModel ? 'bg-cyan-100 dark:bg-cyan-800 text-cyan-600 dark:text-cyan-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
        {isModel ? <ModelIcon /> : <UserIcon />}
      </div>
      <div className={`max-w-3xl w-full flex flex-col ${!isModel && 'items-end'}`}>
        {isModel && <MessageMetadata responseType={message.responseType} modelId={message.modelId} />}
        <div className={`group relative rounded-lg px-5 py-3 ${isModel ? 'bg-slate-100 dark:bg-slate-800' : 'bg-cyan-600 text-white dark:bg-cyan-700'}`}>
          {message.attachment && (
            <div className="mb-2">
                <AttachmentPreview attachment={message.attachment} onRemove={() => {}} isReadOnly />
            </div>
          )}
          <div>
             {message.content ? (
                <MarkdownRenderer text={message.content} />
             ) : (
                isModel && <span className="w-2.5 h-2.5 bg-slate-400 rounded-full inline-block animate-pulse"></span>
             )}
          </div>
           {isModel && message.content && (
                <button 
                    onClick={handleToggleSpeech} 
                    className="absolute -bottom-4 right-2 p-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={isSpeaking ? "Stop speaking" : "Read message aloud"}
                >
                    {isSpeaking ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
                </button>
            )}
        </div>
        {isModel && message.suggestion && (
            <div className="mt-3 w-full">
                <CodeSuggestionViewer 
                    suggestion={message.suggestion} 
                    onAction={onSuggestionAction}
                />
            </div>
        )}
        {isModel && message.editedFile && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-2 self-center">Edited File:</span>
            <SourcePill 
              key={message.editedFile.id} 
              source={message.editedFile} 
              onClick={() => onSelectSource(message.editedFile)}
              isEdited={true} 
            />
          </div>
        )}
        {isModel && message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-2 self-center">Sources:</span>
            {message.sources.map((source) => (
              <SourcePill key={source.id} source={source} onClick={() => onSelectSource(source)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;