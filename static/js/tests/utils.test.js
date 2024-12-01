// Utils tests
import { jest } from '@jest/globals';
import { showToast, toggleSection, showTab, updateProgress, rotateERD } from '../utils.js';

describe('Utils', () => {
    beforeEach(() => {
        // Setup DOM elements for all tests
        document.body.innerHTML = `
            <div id="test-section">
                <div class="section-content hidden"></div>
                <div class="toggle-icon"></div>
            </div>
            
            <div data-tab-content="test" class="hidden"></div>
            <button data-tab="test"></button>
            
            <div id="progress-section" class="hidden">
                <div id="progress-bar" style="width: 0%"></div>
                <div id="progress-status"></div>
            </div>
            
            <img id="erd-diagram" style="transform: none" />
        `;
        
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
    });
    
    describe('showToast', () => {
        test('creates and removes toast message', () => {
            showToast('Test message', 'info');
            
            const toast = document.querySelector('.fixed.bottom-4');
            expect(toast).not.toBeNull();
            expect(toast.textContent).toBe('Test message');
            expect(toast.classList.contains('bg-blue-500')).toBe(true);
            
            jest.advanceTimersByTime(3000);
            
            const removedToast = document.querySelector('.fixed.bottom-4');
            expect(removedToast).toBeNull();
        });
    });
    
    describe('toggleSection', () => {
        test('toggles section visibility', () => {
            const content = document.querySelector('.section-content');
            const icon = document.querySelector('.toggle-icon');
            
            toggleSection('test-section');
            expect(content.classList.contains('hidden')).toBe(false);
            expect(icon.classList.contains('rotate-180')).toBe(true);
            
            toggleSection('test-section');
            expect(content.classList.contains('hidden')).toBe(true);
            expect(icon.classList.contains('rotate-180')).toBe(false);
        });
    });
    
    describe('showTab', () => {
        test('shows selected tab and updates button state', () => {
            const tab = document.querySelector('[data-tab-content="test"]');
            const button = document.querySelector('[data-tab="test"]');
            
            showTab('test');
            
            expect(tab.classList.contains('hidden')).toBe(false);
            expect(button.classList.contains('bg-gray-200')).toBe(true);
            expect(button.getAttribute('aria-selected')).toBe('true');
        });
    });
    
    describe('updateProgress', () => {
        test('updates progress bar and status', () => {
            const progressSection = document.getElementById('progress-section');
            const progressBar = document.getElementById('progress-bar');
            const progressStatus = document.getElementById('progress-status');
            
            updateProgress(75, 'Processing...');
            
            expect(progressSection.classList.contains('hidden')).toBe(false);
            expect(progressBar.style.width).toBe('75%');
            expect(progressStatus.textContent).toBe('Processing...');
        });
    });
    
    describe('rotateERD', () => {
        test('rotates ERD diagram', () => {
            const erd = document.getElementById('erd-diagram');
            
            rotateERD(90);
            expect(erd.style.transform).toBe('rotate(90deg)');
            
            rotateERD(-90);
            expect(erd.style.transform).toBe('rotate(0deg)');
        });
    });
});
