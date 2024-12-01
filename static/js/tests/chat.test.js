/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { socket } from '../socket.js';
import { addChatMessage, handleChatSubmit, initChat } from '../chat.js';

jest.mock('../socket.js', () => ({
    socket: {
        emit: jest.fn(),
        on: jest.fn()
    }
}));

describe('Chat', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `
            <div id="chat-messages"></div>
            <form id="chat-form">
                <input type="text" id="chat-input" value="Test message">
                <button id="chat-send">Send</button>
            </form>
        `;
        
        // Initialize chat handlers
        initChat();
    });
    
    describe('addChatMessage', () => {
        test('adds user message with correct styling', () => {
            addChatMessage('Hello', true);
            
            const messageDiv = document.querySelector('#chat-messages > div');
            expect(messageDiv).not.toBeNull();
            expect(messageDiv.classList.contains('bg-indigo-100')).toBe(true);
            expect(messageDiv.classList.contains('ml-8')).toBe(true);
            expect(messageDiv.textContent).toBe('Hello');
        });
        
        test('adds bot message with correct styling', () => {
            addChatMessage('Hi there', false);
            
            const messageDiv = document.querySelector('#chat-messages > div');
            expect(messageDiv).not.toBeNull();
            expect(messageDiv.classList.contains('bg-gray-100')).toBe(true);
            expect(messageDiv.classList.contains('mr-8')).toBe(true);
            expect(messageDiv.textContent).toBe('Hi there');
        });
        
        test('scrolls chat to bottom after adding message', () => {
            const chatMessages = document.getElementById('chat-messages');
            Object.defineProperty(chatMessages, 'scrollHeight', { value: 1000 });
            
            addChatMessage('Test message');
            
            expect(chatMessages.scrollTop).toBe(1000);
        });
    });
    
    describe('handleChatSubmit', () => {
        test('sends message and clears input', () => {
            const input = document.getElementById('chat-input');
            input.value = 'Test message';
            
            const event = { preventDefault: jest.fn() };
            handleChatSubmit(event);
            
            expect(event.preventDefault).toHaveBeenCalled();
            expect(socket.emit).toHaveBeenCalledWith('chat_message', {
                message: 'Test message'
            });
            expect(input.value).toBe('');
        });
        
        test('does not send empty message', () => {
            const input = document.getElementById('chat-input');
            input.value = '   ';
            
            const event = { preventDefault: jest.fn() };
            handleChatSubmit(event);
            
            expect(event.preventDefault).toHaveBeenCalled();
            expect(socket.emit).not.toHaveBeenCalled();
            expect(input.value).toBe('   ');
        });
    });
    
    describe('Event Listeners', () => {
        test('sends message on form submit', () => {
            const form = document.getElementById('chat-form');
            const input = document.getElementById('chat-input');
            input.value = 'Test message';
            
            form.dispatchEvent(new Event('submit'));
            
            expect(socket.emit).toHaveBeenCalledWith('chat_message', {
                message: 'Test message'
            });
            expect(input.value).toBe('');
        });
        
        test('sends message on Enter key', () => {
            const input = document.getElementById('chat-input');
            input.value = 'Test message';
            
            const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
            input.dispatchEvent(enterEvent);
            
            expect(socket.emit).toHaveBeenCalledWith('chat_message', {
                message: 'Test message'
            });
            expect(input.value).toBe('');
        });
    });
});
