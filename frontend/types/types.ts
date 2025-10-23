export interface ChatMessage {
    id: string;
    sender: 'user' | 'bot';
    text: string;
}
