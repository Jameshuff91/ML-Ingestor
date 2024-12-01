import { socket } from './socket.js';
import { showToast } from './utils.js';
import { updateProgress, showResults } from './validation.js';

// Socket event handlers
export function initializeSocketHandlers() {
    socket.on('upload_progress', (data) => {
        console.log('Upload progress:', data);
        updateProgress(data.progress);
    });

    socket.on('processing_complete', (data) => {
        console.log('Processing complete:', data);
        showResults(data);
    });

    socket.on('validation_results', (data) => {
        console.log('Validation results:', data);
        showResults(data);
    });

    socket.on('export_complete', (data) => {
        console.log('Export complete:', data);
        const downloadLink = document.createElement('a');
        downloadLink.href = data.download_url;
        downloadLink.download = data.filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        showToast('Export completed successfully!', 'success');
    });

    socket.on('error', (data) => {
        console.error('Socket error:', data);
        showToast(data.message || 'An error occurred', 'error');
        document.getElementById('error-message').textContent = data.message;
        document.getElementById('error-section').classList.remove('hidden');
    });
}
