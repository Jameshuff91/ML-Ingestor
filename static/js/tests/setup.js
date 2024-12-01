// Test setup file
import { jest } from '@jest/globals';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
    io: jest.fn(() => ({
        on: jest.fn(),
        emit: jest.fn()
    }))
}));

// Mock chart.js
jest.mock('chart.js/auto', () => {
    return jest.fn().mockImplementation(() => ({
        destroy: jest.fn(),
        update: jest.fn()
    }));
});

// Mock DOM elements
document.body.innerHTML = `
    <div id="upload-area"></div>
    <div id="progress-section" class="hidden">
        <div id="progress-bar"></div>
        <div id="progress-status"></div>
    </div>
    <div id="toast" class="hidden"></div>
    <div id="correlation-matrix"></div>
    <div id="chat-messages"></div>
    <form id="chat-form">
        <input id="chat-input" type="text" />
        <button id="chat-send" type="submit"></button>
    </form>
    <div id="test-section" class="section">
        <div class="section-header">
            <span class="toggle-icon"></span>
        </div>
        <div class="section-content overflow-hidden"></div>
    </div>
    <button class="info-button" data-tooltip="Test tooltip"></button>
    <div id="export-btn"></div>
    <div id="rotate-left"></div>
    <div id="rotate-right"></div>
    <div id="erd-diagram"></div>
`;

// Mock global functions
global.showToast = jest.fn();
global.toggleSection = jest.fn();
global.rotateERD = jest.fn();
global.initSocket = jest.fn();
global.updateProgress = jest.fn();
global.showResults = jest.fn();

// Mock FormData
global.FormData = jest.fn(() => ({
    append: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn(() => 
    Promise.resolve({
        json: () => Promise.resolve({ success: true })
    })
);

// Reset all mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
});

// Set up Jest timers
jest.useFakeTimers();
