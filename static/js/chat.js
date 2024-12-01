// Chat functionality
import { socket } from './socket.js';
import { showToast } from './utils.js';
import { getCurrentTaskId } from './state.js';

export function addChatMessage(message, isUser = true) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `p-2 rounded-lg mb-2 ${
        isUser ? 'bg-indigo-100 ml-8' : 'bg-gray-100 mr-8'
    }`;
    messageDiv.textContent = message;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage(message) {
    try {
        if (!getCurrentTaskId()) {
            showToast('Please upload and process a file first', 'error');
            return;
        }

        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                task_id: getCurrentTaskId(),
                message: message
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        const data = await response.json();
        if (data.success) {
            addChatMessage(data.response, false);
        } else {
            showToast(data.error || 'Failed to get response', 'error');
        }
    } catch (error) {
        console.error('Chat error:', error);
        showToast('Failed to send message', 'error');
    }
}

export function handleChatSubmit(event) {
    event.preventDefault();
    
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addChatMessage(message, true);
    
    // Send message to server
    sendChatMessage(message);
    
    // Clear input
    input.value = '';
}

// Initialize chat functionality
export function initChat() {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-chat');
    
    if (chatInput && sendButton) {
        // Handle send button click
        sendButton.addEventListener('click', (event) => {
            event.preventDefault();
            handleChatSubmit(event);
        });
        
        // Handle enter key
        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleChatSubmit(event);
            }
        });
    }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', initChat);
