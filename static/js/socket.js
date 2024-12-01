// Socket.IO functionality
import { showToast } from './utils.js';
import { showResults } from './validation.js';
import { updateProgress } from './utils.js';
import { getCurrentTaskId, setCurrentTaskId } from './state.js';

let socket;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function initializeSocket() {
    // Initialize Socket.IO with reconnection options
    socket = io({
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });

    // Connection event handlers
    socket.on('connect', () => {
        console.log('Socket connected with ID:', socket.id);
        reconnectAttempts = 0;
        
        // Re-subscribe to task updates if we were monitoring one
        if (getCurrentTaskId()) {
            socket.emit('subscribe', { task_id: getCurrentTaskId() });
        }
    });

    socket.on('ready', (data) => {
        console.log('Server ready:', data);
        showToast('Connected to server', 'success');
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        
        if (reason === 'io server disconnect' || reason === 'parse error') {
            // Server disconnected us, try to reconnect
            setTimeout(() => {
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                    socket.connect();
                }
            }, 1000);
        }
        
        showToast('Connection interrupted. Attempting to reconnect...', 'warning');
    });

    // Task event handlers
    socket.on('task_started', (data) => {
        console.log('Task started:', data);
        setCurrentTaskId(data.task_id);
        
        // Show progress section and hide results
        const progressSection = document.getElementById('progress-section');
        const resultsSection = document.getElementById('results-section');
        
        if (progressSection) progressSection.classList.remove('hidden');
        if (resultsSection) resultsSection.classList.add('hidden');
        
        // Reset progress UI
        updateProgress(0, 'Starting...');
        showToast('Processing started', 'info');
    });

    socket.on('progress', (data) => {
        console.log('Progress update:', data);
        
        if (data.task_id === getCurrentTaskId()) {
            // Update progress bar and status
            updateProgress(data.progress || 0, data.status || 'Processing...');
            
            // Handle results if available and processing is complete
            if (data.status === 'Complete' && data.results && Object.keys(data.results).length > 0) {
                try {
                    // Replace any null values with empty strings in the results
                    const cleanResults = JSON.parse(JSON.stringify(data.results), (key, value) => {
                        return value === null ? '' : value;
                    });
                    
                    showResults(cleanResults);
                    showToast('Processing complete!', 'success');
                } catch (error) {
                    console.error('Error showing results:', error);
                    showToast('Error displaying results', 'error');
                }
            }
            
            // Handle errors
            if (data.status === 'Failed' || data.error) {
                showToast(data.error || 'Processing failed', 'error');
                const progressSection = document.getElementById('progress-section');
                if (progressSection) progressSection.classList.add('hidden');
            }
            
            // Reset task ID when complete
            if (data.status === 'Complete' || data.status === 'Failed') {
                setCurrentTaskId(null);
            }
        }
    });

    return socket;
}

// Initialize socket when the module loads
const socketInstance = initializeSocket();
export { socketInstance as socket, initializeSocket };
