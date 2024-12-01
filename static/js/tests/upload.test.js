/**
 * @jest-environment jsdom
 */

import { handleFile, preventDefaults, highlight, unhighlight } from '../upload.js';
import { showToast } from '../utils.js';
import { socket } from '../socket.js';

jest.mock('../utils.js', () => ({
    showToast: jest.fn()
}));

jest.mock('../socket.js', () => ({
    socket: {
        emit: jest.fn()
    }
}));

describe('Upload', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="progress-section"></div>
            <div id="upload-area"></div>
        `;
        
        showToast.mockClear();
        socket.emit.mockClear();
        
        global.fetch = jest.fn();
        
        // Mock successful fetch response
        global.fetch.mockImplementation(() => 
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, data: 'test data' })
            })
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('preventDefaults', () => {
        test('prevents default event behavior', () => {
            const event = {
                preventDefault: jest.fn(),
                stopPropagation: jest.fn()
            };
            
            preventDefaults(event);
            
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
        });
    });

    describe('highlight/unhighlight', () => {
        test('adds and removes border highlight class', () => {
            const uploadArea = document.getElementById('upload-area');
            
            highlight();
            expect(uploadArea.classList.contains('border-indigo-500')).toBe(true);
            
            unhighlight();
            expect(uploadArea.classList.contains('border-indigo-500')).toBe(false);
        });
    });

    describe('handleFile', () => {
        test('handles successful file upload', async () => {
            const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
            
            await handleFile(file);
            
            expect(showToast).toHaveBeenCalledWith('File uploaded successfully');
            expect(socket.emit).toHaveBeenCalledWith('start_validation', { filename: 'test.csv' });
        }, 10000);

        test('handles upload error', async () => {
            const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
            
            global.fetch.mockImplementationOnce(() => 
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: false, error: 'Upload failed' })
                })
            );
            
            await handleFile(file);
            
            expect(showToast).toHaveBeenCalledWith('Upload failed', 'error');
        }, 10000);

        test('handles network error', async () => {
            const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
            
            global.fetch.mockImplementationOnce(() => 
                Promise.reject(new Error('Network error'))
            );
            
            await handleFile(file);
            
            expect(showToast).toHaveBeenCalledWith('Network error', 'error');
        }, 10000);

        test('validates file type', async () => {
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
            
            await handleFile(file);
            
            expect(showToast).toHaveBeenCalledWith('Please upload a CSV file', 'error');
            expect(global.fetch).not.toHaveBeenCalled();
        }, 10000);

        test('validates file size', async () => {
            const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.csv', { type: 'text/csv' });
            
            await handleFile(largeFile);
            
            expect(showToast).toHaveBeenCalledWith('File size must be less than 10MB', 'error');
            expect(global.fetch).not.toHaveBeenCalled();
        }, 10000);
    });
});
