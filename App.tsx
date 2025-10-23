import React, { useState, useCallback, useEffect } from 'react';
import { ChatMessage, MessageRole, Source, ElasticResult, Intent, CodeSuggestion, ModelId, MODELS, ResponseType, Chat, Theme, Attachment, DataSource } from './types';
import { searchDocuments, getAllFiles, getFileContent, createDatasetFromSources, updateFileContent } from './services/elasticService';
import { streamAiResponse, classifyIntent, streamChitChatResponse, streamCodeGenerationResponse } from './services/geminiService';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import FileSearch from './components/FileSearch';
import FileViewer from './components/FileViewer';
import EditedFilesViewer from './components/EditedFilesViewer';
import DiffViewerModal from './components/DiffViewerModal';
import ChatHistory from './components/ChatHistory';
import DataSourceModal from './components/DataSourceModal';

const HISTORY_KEY = 'elastic-codemind-state';

export interface EditedFileRecord {
  file: Source;
  originalContent: string;
  currentContent: string;
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme') as Theme;
      if (storedTheme) return storedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allFiles, setAllFiles] = useState<Source[]>([]);
  const [isFileSearchVisible, setIsFileSearchVisible] = useState<boolean>(false);
  const [isEditedFilesVisible, setIsEditedFilesVisible] = useState<boolean>(false);
  const [isDataSourceModalVisible, setIsDataSourceModalVisible] = useState<boolean>(false);
  const [editedFiles, setEditedFiles] = useState<Map<string, EditedFileRecord>>(new Map());
  const [selectedFile, setSelectedFile] = useState<Source | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<ModelId>(ModelId.GEMINI_FLASH_LITE);
  const [diffViewerRecord, setDiffViewerRecord] = useState<EditedFileRecord | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // --- Effects ---

  useEffect(() => {
    try {
      const savedState = localStorage.getItem(HISTORY_KEY);
      if (savedState) {
        const { chats: savedChats, activeChatId: savedActiveChatId, model: savedModel } = JSON.parse(savedState);
        // We don't save the large dataset in localStorage, so we restore chats without it.
        const restoredChats = (savedChats || []).map((chat: any) => ({...chat, dataset: []}));
        setChats(restoredChats);
        setActiveChatId(savedActiveChatId || null);
        setSelectedModel(savedModel || ModelId.GEMINI_FLASH_LITE);
        if (!savedActiveChatId && restoredChats.length > 0) {
            setActiveChatId(restoredChats[0].id);
        }
      } else {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to parse state from localStorage", error);
      handleNewChat();
    }
  }, []);

  useEffect(() => {
    try {
      // Create a version of chats without the dataset for saving to localStorage
      const chatsToSave = chats.map(({ dataset, ...rest }) => rest);
      const stateToSave = JSON.stringify({ chats: chatsToSave, activeChatId, model: selectedModel });
      localStorage.setItem(HISTORY_KEY, stateToSave);
    } catch (error)
      {
      console.error("Failed to save state to localStorage", error);
    }
  }, [chats, activeChatId, selectedModel]);
  
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const activeChat = chats.find(c => c.id === activeChatId);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!activeChat || !activeChat.dataSource) {
        setAllFiles([]);
        return;
      }
      try {
        const files = await getAllFiles(activeChat.dataset);
        setAllFiles(files);
      } catch (error) {
        console.error("Failed to fetch file list:", error);
      }
    };
    fetchFiles();
  }, [activeChat]);

  const messages = activeChat?.messages || [];

  const updateActiveChat = (updater: (chat: Chat) => Chat) => {
    setChats(prevChats => prevChats.map(chat =>
      chat.id === activeChatId ? updater(chat) : chat
    ));
  };

  const addMessageToActiveChat = (message: ChatMessage) => {
    updateActiveChat(chat => ({ ...chat, messages: [...chat.messages, message] }));
  };
  
  const updateLastMessageInActiveChat = (updater: (message: ChatMessage) => ChatMessage) => {
    updateActiveChat(chat => ({
        ...chat,
        messages: chat.messages.map((msg, index) => 
            index === chat.messages.length - 1 ? updater(msg) : msg
        )
    }));
  };

  // --- Handlers ---
  
  const handleQueryDocuments = async (currentMessages: ChatMessage[]) => {
    if (!activeChat) return;

    addMessageToActiveChat({
      role: MessageRole.MODEL,
      content: '',
      sources: [],
      responseType: ResponseType.RAG,
      modelId: selectedModel
    });

    const latestQuery = currentMessages[currentMessages.length -1];
    const searchResults = await searchDocuments(latestQuery.content, activeChat.dataset);
    const sources: Source[] = searchResults.map(r => r.source);

    const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
    const responseStream = await streamAiResponse(currentMessages, searchResults, modelToUse);
    
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      updateLastMessageInActiveChat(msg => ({ ...msg, content: msg.content + chunkText }));
    }
    updateLastMessageInActiveChat(msg => ({ ...msg, sources }));
  };
  
  const handleChitChat = async (currentMessages: ChatMessage[]) => {
    addMessageToActiveChat({
      role: MessageRole.MODEL,
      content: '',
      responseType: ResponseType.CHIT_CHAT,
      modelId: selectedModel
    });
    const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
    const responseStream = await streamChitChatResponse(currentMessages, modelToUse);
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      updateLastMessageInActiveChat(msg => ({ ...msg, content: msg.content + chunkText }));
    }
  };

  const handleCodeGeneration = async (currentMessages: ChatMessage[]) => {
    if (!activeChat) return;

    addMessageToActiveChat({
      role: MessageRole.MODEL,
      content: 'Thinking about the file...',
      responseType: ResponseType.CODE_GENERATION,
      modelId: selectedModel
    });

    const latestQuery = currentMessages[currentMessages.length - 1].content;
    const searchResults = await searchDocuments(latestQuery, activeChat.dataset);
    
    if (searchResults.length === 0) {
        updateLastMessageInActiveChat(msg => ({ ...msg, content: "I couldn't find any relevant files to modify for your request." }));
        return;
    }
    
    const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
    const responseStream = await streamCodeGenerationResponse(currentMessages, searchResults, modelToUse);
    let responseJsonText = '';
    for await (const chunk of responseStream) {
        responseJsonText += chunk.text;
    }

    try {
        const responseObject = JSON.parse(responseJsonText);
        if (responseObject.error) throw new Error(responseObject.error);
        
        const fullPath = responseObject.filePath;
        const file = allFiles.find(f => `${f.path}/${f.fileName}` === fullPath);
        
        if (!file) throw new Error(`The model suggested editing a file I couldn't find: ${fullPath}`);

        const originalContent = await getFileContent(file, activeChat.dataset);
        if (originalContent === null) throw new Error(`Could not fetch original content for ${file.fileName}.`);

        const suggestion: CodeSuggestion = {
            file,
            thought: responseObject.thought,
            originalContent,
            suggestedContent: responseObject.newContent,
            status: 'pending',
        };
        updateLastMessageInActiveChat(msg => ({ ...msg, content: `I have a suggestion for \`file:${file.fileName}\`. Here are the changes:`, suggestion }));
    } catch (e) {
        console.error("Code generation parsing error:", e);
        const errorMessage = e instanceof Error ? e.message : "Sorry, I couldn't generate the edit correctly.";
        updateLastMessageInActiveChat(msg => ({ ...msg, content: errorMessage }));
    }
  };

  const handleSendMessage = useCallback(async (query: string, attachment?: Attachment) => {
    if (!query.trim() || isLoading || !activeChat) return;
    setIsLoading(true);
    
    const userMessage: ChatMessage = { role: MessageRole.USER, content: query, attachment };
    const newMessages = [...messages, userMessage];
    updateActiveChat(chat => ({ 
      ...chat, 
      messages: [...chat.messages, userMessage],
      title: chat.messages.length === 0 ? query.substring(0, 30) : chat.title
    }));
    
    try {
      if (activeChat.dataSource) {
        const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
        const intent = await classifyIntent(query, modelToUse);
        console.log("Detected Intent:", intent);
        
        // If there's an image, it's almost always a document query
        if (attachment?.type.startsWith('image/')) {
            await handleQueryDocuments(newMessages);
        } else {
            switch (intent) {
              case Intent.GENERATE_CODE: await handleCodeGeneration(newMessages); break;
              case Intent.CHIT_CHAT: await handleChitChat(newMessages); break;
              default: await handleQueryDocuments(newMessages); break;
            }
        }
      } else {
        await handleChitChat(newMessages);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessageContent = error instanceof Error ? error.message : "An unknown error occurred.";
      addMessageToActiveChat({ role: MessageRole.MODEL, content: `Sorry, I encountered an error: ${errorMessageContent}` });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, allFiles, messages, selectedModel, activeChatId, chats]);
  
  const handleNewChat = useCallback(() => {
    const newChat: Chat = {
      id: `chat_${Date.now()}`,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      dataSource: null,
      dataset: [],
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setEditedFiles(new Map());
  }, []);
  
  const handleConnectDataSource = useCallback(async (files: File[], dataSource: DataSource) => {
    setIsLoading(true);
    setIsDataSourceModalVisible(false);
    try {
        const newDataset = await createDatasetFromSources(files);
        const newChat: Chat = {
          id: `chat_${Date.now()}`,
          title: dataSource.name,
          messages: [],
          createdAt: Date.now(),
          dataSource,
          dataset: newDataset,
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setEditedFiles(new Map());
    } catch (error) {
        console.error("Error processing data source:", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleSuggestionAction = useCallback(async (messageIndex: number, action: 'accepted' | 'rejected') => {
      if (!activeChat) return;
      const message = messages[messageIndex];
      if (!message || !message.suggestion) return;

      const updatedSuggestion = { ...message.suggestion, status: action };
      
      updateActiveChat(chat => ({
        ...chat,
        messages: chat.messages.map((msg, index) => 
            index === messageIndex ? { ...msg, suggestion: updatedSuggestion } : msg)
      }));
      
      let followUpMessage: ChatMessage;
      if (action === 'accepted') {
          setIsLoading(true);
          const { file, originalContent, suggestedContent } = message.suggestion;
          try {
              const { success, newDataset } = await updateFileContent(file, suggestedContent, activeChat.dataset);
              if (!success) throw new Error("File not found or update failed.");
              
              updateActiveChat(c => ({...c, dataset: newDataset}));
              setEditedFiles(prev => new Map(prev).set(file!.id, { file: file!, originalContent: prev.get(file!.id)?.originalContent ?? originalContent, currentContent: suggestedContent }));
              setAllFiles(await getAllFiles(newDataset));
              followUpMessage = { role: MessageRole.MODEL, content: `Great! I've applied the changes to \`file:${file.fileName}\`.`, editedFile: file };
          } catch(e) {
              const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
              followUpMessage = { role: MessageRole.MODEL, content: `Sorry, I failed to apply the changes to \`file:${file.fileName}\`. Reason: ${errorMessage}` };
          } finally {
              setIsLoading(false);
          }
      } else {
          followUpMessage = { role: MessageRole.MODEL, content: "Okay, I've discarded the changes." };
      }
      addMessageToActiveChat(followUpMessage);
  }, [messages, activeChat]);

  const handleSelectFile = useCallback(async (file: Source) => {
    if (!activeChat) return;
    const editedRecord = editedFiles.get(file.id);
    if (editedRecord) {
        handleViewDiff(editedRecord);
    } else {
        setSelectedFile(file);
        setSelectedFileContent('Loading...');
        const content = await getFileContent(file, activeChat.dataset);
        setSelectedFileContent(content ?? 'Could not load file content.');
    }
  }, [activeChat, editedFiles]);

  const handleViewDiff = useCallback((record: EditedFileRecord) => setDiffViewerRecord(record), []);
  const handleCloseDiffViewer = useCallback(() => setDiffViewerRecord(null), []);
  const handleCloseFileViewer = useCallback(() => { setSelectedFile(null); setSelectedFileContent(''); }, []);
  const handleToggleFileSearch = useCallback(() => setIsFileSearchVisible(prev => !prev), []);
  const handleToggleEditedFiles = useCallback(() => setIsEditedFilesVisible(prev => !prev), []);
  const handleToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const handleToggleDataSourceModal = useCallback(() => setIsDataSourceModalVisible(prev => !prev), []);


  return (
    <div className={`flex flex-col h-screen font-sans transition-colors duration-300 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200`}>
      <Header 
        onToggleFileSearch={handleToggleFileSearch} 
        onToggleEditedFiles={handleToggleEditedFiles}
        onToggleSidebar={handleToggleSidebar}
        onConnectDataSource={handleToggleDataSourceModal}
        theme={theme}
        setTheme={setTheme}
        activeDataSource={activeChat?.dataSource ?? null}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <ChatHistory 
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={setActiveChatId}
          onNewChat={handleNewChat}
          setChats={setChats}
          isOpen={isSidebarOpen}
        />
        <main className="flex-1 overflow-hidden transition-all duration-300">
           <ChatInterface 
              messages={messages} 
              isLoading={isLoading} 
              onSendMessage={handleSendMessage} 
              onSelectSource={handleSelectFile}
              onSuggestionAction={handleSuggestionAction}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              activeDataSource={activeChat?.dataSource}
              onConnectDataSource={handleToggleDataSourceModal}
            />
        </main>
        
        <div className={`absolute top-0 right-0 h-full w-full md:w-80 lg:w-96 z-20 transition-transform duration-300 ease-in-out ${isFileSearchVisible ? 'translate-x-0' : 'translate-x-full'}`}>
          <FileSearch files={allFiles} onClose={handleToggleFileSearch} onSelectFile={handleSelectFile}/>
        </div>

        <div className={`absolute top-0 right-0 h-full w-full md:w-80 lg:w-96 z-20 transition-transform duration-300 ease-in-out ${isEditedFilesVisible ? 'translate-x-0' : 'translate-x-full'}`}>
          <EditedFilesViewer
            editedFiles={Array.from(editedFiles.values())}
            onClose={handleToggleEditedFiles}
            onSelectFile={handleViewDiff}
          />
        </div>

        {selectedFile && <FileViewer file={selectedFile} content={selectedFileContent} onClose={handleCloseFileViewer} />}
        {diffViewerRecord && <DiffViewerModal record={diffViewerRecord} onClose={handleCloseDiffViewer} />}
        {isDataSourceModalVisible && <DataSourceModal onClose={handleToggleDataSourceModal} onConnect={handleConnectDataSource} />}
      </div>
    </div>
  );
};

export default App;