import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, UserRole } from '../types';
import { ChatIcon, SendIcon } from './icons';

interface ChatProps {
    messages: ChatMessage[];
    currentUserRole: UserRole;
    onSendMessage: (message: string, senderRole: UserRole) => void;
}

const Chat: React.FC<ChatProps> = ({ messages, currentUserRole, onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim(), currentUserRole);
            setNewMessage('');
        }
    };

    const timeSince = (date: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        let interval = seconds / 3600;
        if (interval > 1) return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return "just now";
      };

    return (
        <div className="bg-gray-900 rounded-lg flex flex-col h-[400px]">
            <h2 className="text-lg font-semibold text-gray-300 p-4 border-b border-gray-700 flex items-center gap-2">
                <ChatIcon className="w-6 h-6 text-cyan-400" />
                Inspection Chat
            </h2>
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => {
                    const isCurrentUser = msg.senderRole === currentUserRole;
                    return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                                <div className={`px-3 py-2 rounded-lg max-w-xs ${isCurrentUser ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-300 rounded-bl-none'}`}>
                                    <p className="text-sm">{msg.message}</p>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {isCurrentUser ? 'You' : msg.senderRole} - {timeSince(msg.timestamp)}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700 flex items-center gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-grow bg-gray-700 border-gray-600 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
                <button type="submit" className="p-2 bg-cyan-600 hover:bg-cyan-700 rounded-full text-white transition-colors">
                    <SendIcon className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
};

export default Chat;