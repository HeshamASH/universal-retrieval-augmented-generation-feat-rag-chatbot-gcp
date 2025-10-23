"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

interface ChatInterfaceProps {
  userId: string;
  sessionContextText: string | null;
  backendUrl?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
    userId,
    sessionContextText,
    backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || "/api"
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaViewportRef.current) {
        scrollAreaViewportRef.current.scrollTo({ top: scrollAreaViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading || !userId) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: trimmedInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const queryUrl = `${backendUrl}/query`;

    try {
      const response = await axios.post<{ answer: string }>(queryUrl, {
        user_id: userId,
        query_text: userMessage.text,
        session_context_text: sessionContextText,
      });

      const botMessage: ChatMessage = { id: `bot-${Date.now()}`, sender: 'bot', text: response.data.answer || "Received empty answer." };
      setMessages((prev) => [...prev, botMessage]);

    } catch (error) {
        console.error('Query error:', error);
        const errorMsg = axios.isAxiosError(error)
            ? (error.response?.data?.detail || error.message)
            : "Failed to get response from bot";
        const botErrorMessage: ChatMessage = {
            id: `bot-error-${Date.now()}`,
            sender: 'bot',
            text: `Sorry, an error occurred: ${errorMsg}`
        };
        setMessages((prev) => [...prev, botErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, userId, backendUrl, sessionContextText, scrollToBottom]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

   return (
    <Card className="flex flex-col h-full w-full rounded-none border-0 border-l shadow-none font-sans">
        <CardHeader className="border-b">
           <CardTitle className="text-lg font-semibold">AI Document Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0">
           <ScrollArea className="h-full" viewportRef={scrollAreaViewportRef}>
             <div className="space-y-4 p-4">
               {messages.length === 0 && !isLoading && (
                   <div className="text-center text-muted-foreground text-sm p-4">
                       Ask a question about your pre-loaded documents, or add temporary context using the file handler on the left.
                   </div>
               )}
               {messages.map((msg) => (
                 <div key={msg.id} className={cn("flex items-start space-x-3", msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.sender === 'bot' && ( <div className="flex-shrink-0 bg-muted rounded-full p-2"><Bot className="h-5 w-5 text-foreground" /></div> )}
                     <div className={cn("max-w-[80%] rounded-lg px-4 py-2 text-sm shadow-sm", msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')} style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                       {msg.text}
                     </div>
                    {msg.sender === 'user' && ( <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 rounded-full p-2"><User className="h-5 w-5 text-blue-700 dark:text-blue-300" /></div> )}
                 </div>
               ))}
               {isLoading && (
                  <div className="flex items-start space-x-3 justify-start">
                      <div className="flex-shrink-0 bg-muted rounded-full p-2"><Bot className="h-5 w-5 text-foreground" /></div>
                      <div className="max-w-[75%] rounded-lg px-4 py-2 bg-muted text-muted-foreground italic flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> <span>Thinking...</span>
                      </div>
                  </div>
               )}
             </div>
             <ScrollBar orientation="vertical" />
           </ScrollArea>
        </CardContent>
         <CardFooter className="p-4 border-t bg-background">
           <div className="flex w-full items-center space-x-2">
             <Input type="text" placeholder="Ask a question..." value={input} onChange={handleInputChange} onKeyDown={handleKeyPress} disabled={isLoading} className="flex-grow rounded-full" autoComplete="off" />
             <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="rounded-full">
               {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
             </Button>
           </div>
         </CardFooter>
    </Card>
  );
};

export default ChatInterface;
