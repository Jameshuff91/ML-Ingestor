/**
 * @jest-environment jsdom
 */

// Mock the module imports
jest.mock('../socket.js', () => ({
    initSocket: jest.fn(() => ({ emit: jest.fn() }))
}));

jest.mock('../utils.js', () => ({
    showToast: jest.fn(),
    toggleSection: jest.fn(),
    rotateERD: jest.fn()
}));

jest.mock('../upload.js', () => ({
    handleDrop: jest.fn(),
    handleFileSelect: jest.fn()
}));

// Import the mocked modules
import { initSocket } from '../socket.js';
import { toggleSection, rotateERD } from '../utils.js';
import { initializeApp } from '../main.js';

describe('Main', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <button class="info-button" data-tooltip="Test tooltip">
                <span class="tooltip">Test tooltip</span>
            </button>
            <div class="section" id="test-section">
                <div class="section-header"></div>
            </div>
            <button id="export-btn" data-task-id="test-task"></button>
            <button id="rotate-left"></button>
            <button id="rotate-right"></button>
        `;

        // Initialize the app
        initializeApp();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('initializes socket connection', () => {
        expect(initSocket).toHaveBeenCalled();
    });

    test('initializes tooltips', () => {
        const infoButton = document.querySelector('.info-button');
        const tooltip = infoButton.querySelector('.tooltip');
        
        expect(tooltip).not.toBeNull();
        expect(tooltip.textContent).toBe('Test tooltip');
    });

    test('initializes collapsible sections', () => {
        const header = document.querySelector('.section-header');
        header.click();
        expect(toggleSection).toHaveBeenCalledWith('test-section');
    });

    test('initializes export functionality', () => {
        const exportBtn = document.getElementById('export-btn');
        const mockSocket = { emit: jest.fn() };
        initSocket.mockReturnValue(mockSocket);
        
        exportBtn.click();
        
        expect(mockSocket.emit).toHaveBeenCalledWith('export_data', {
            task_id: 'test-task',
            format: 'csv'
        });
    });

    test('initializes ERD rotation', () => {
        const leftBtn = document.getElementById('rotate-left');
        const rightBtn = document.getElementById('rotate-right');
        
        leftBtn.click();
        rightBtn.click();
        
        expect(rotateERD).toHaveBeenCalledWith(-90);
        expect(rotateERD).toHaveBeenCalledWith(90);
    });
});
