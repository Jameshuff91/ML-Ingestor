// Socket tests
import { jest } from '@jest/globals';
import { io } from 'socket.io-client';

// Mock modules
jest.mock('socket.io-client', () => ({
    io: jest.fn()
}));

jest.mock('../utils.js');
jest.mock('../validation.js');

// Import after mocks
import { initSocket } from '../socket.js';
import * as utils from '../utils.js';
import * as validation from '../validation.js';

describe('Socket', () => {
    let mockSocket;
    let handlers = {};
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSocket = {
            on: jest.fn((event, handler) => {
                handlers[event] = handler;
            }),
            emit: jest.fn(),
        };
        
        io.mockReturnValue(mockSocket);
        initSocket();
    });
    
    test('initializes socket with websocket transport', () => {
        expect(io).toHaveBeenCalledWith({
            transports: ['websocket']
        });
    });
    
    test('handles validation progress updates', () => {
        expect(handlers.validation_progress).toBeDefined();
        handlers.validation_progress({ progress: 50, status: 'Processing data' });
        expect(utils.updateProgress).toHaveBeenCalledWith(50, 'Processing data');
    });
    
    test('handles validation completion', () => {
        const results = {
            basic: { valid: true },
            advanced: { valid: false }
        };
        
        expect(handlers.validation_complete).toBeDefined();
        handlers.validation_complete(results);
        expect(utils.updateProgress).toHaveBeenCalledWith(100, 'Validation complete');
        expect(validation.showResults).toHaveBeenCalledWith(results);
    });
    
    test('handles errors', () => {
        const error = {
            message: 'Test error message'
        };
        
        expect(handlers.error).toBeDefined();
        handlers.error(error);
        expect(utils.showToast).toHaveBeenCalledWith('Test error message', 'error');
    });
});
