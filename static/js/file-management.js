// File management functionality
import { getUploadedFiles, removeFileFromUploadedFiles } from './state.js';
import { showToast } from './utils.js';
import { socket } from './socket.js';
import { getCurrentTaskId } from './state.js';

export function updateFilesList() {
    console.log('Updating files list...'); // Debug log
    const filesList = document.getElementById('preview-files-list');
    const previewSection = document.getElementById('preview-section');
    const uploadArea = document.getElementById('upload-area');
    const progressSection = document.getElementById('progress-section');
    const processingProgressSection = document.getElementById('processing-progress-section');
    
    if (!filesList || !previewSection) {
        console.error('Required elements not found'); // Debug log
        return;
    }
    
    const files = getUploadedFiles();
    console.log('Files to display:', files); // Debug log
    
    // Clear existing content
    filesList.innerHTML = '';
    
    // Always update the files list content first
    files.forEach(filename => {
        const fileElement = document.createElement('div');
        fileElement.className = 'py-4 flex items-center justify-between';
        fileElement.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="fas fa-file-alt text-gray-400"></i>
                <span class="text-gray-900 font-medium">${filename}</span>
            </div>
            <div class="flex items-center space-x-2">
                <button class="preview-btn inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <i class="fas fa-eye mr-1"></i>
                    Preview
                </button>
                <button class="delete-btn inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                    <i class="fas fa-trash-alt mr-1"></i>
                    Delete
                </button>
            </div>
        `;
        
        // Add event listeners
        const previewBtn = fileElement.querySelector('.preview-btn');
        const deleteBtn = fileElement.querySelector('.delete-btn');
        
        previewBtn.addEventListener('click', () => previewFile(filename));
        deleteBtn.addEventListener('click', () => deleteFile(filename));
        
        filesList.appendChild(fileElement);
    });
    
    // Show/hide sections based on files
    const hasFiles = files.length > 0;
    previewSection.classList.toggle('hidden', !hasFiles);
    uploadArea.classList.toggle('hidden', hasFiles);
    
    // Reset progress bars if no files
    if (!hasFiles) {
        if (progressSection) {
            const progressBar = progressSection.querySelector('#progress-bar');
            const progressStatus = progressSection.querySelector('#progress-status');
            if (progressBar) progressBar.style.width = '0%';
            if (progressStatus) progressStatus.textContent = '0%';
            progressSection.classList.add('hidden');
        }
        
        if (processingProgressSection) {
            const processingProgressBar = processingProgressSection.querySelector('#processing-progress-bar');
            const processingProgressStatus = processingProgressSection.querySelector('#processing-progress-status');
            const processingProgressPercentage = processingProgressSection.querySelector('#processing-progress-percentage');
            if (processingProgressBar) processingProgressBar.style.width = '0%';
            if (processingProgressStatus) processingProgressStatus.textContent = 'Processing';
            if (processingProgressPercentage) processingProgressPercentage.textContent = '0%';
            processingProgressSection.classList.add('hidden');
        }
    }
    
    // Update process button visibility
    const processButton = document.getElementById('process-button');
    if (processButton) {
        processButton.classList.toggle('hidden', !hasFiles);
    }
}

export async function previewFile(filename) {
    console.log('Previewing file:', filename);
    try {
        const response = await fetch(`/preview_file/${filename}`);
        if (!response.ok) {
            throw new Error('Failed to fetch preview data');
        }
        const data = await response.json();
        
        if (!data.columns || !data.rows) {
            throw new Error('Invalid preview data format');
        }

        // Get the preview section and tables container
        const previewSection = document.getElementById('preview-section');
        const tablesContainer = document.getElementById('preview-tables-container');
        
        if (!previewSection || !tablesContainer) {
            console.error('Required elements not found');
            throw new Error('Preview elements not found');
        }

        // Show the preview section
        previewSection.classList.remove('hidden');

        // Check if a preview for this file already exists
        const existingPreview = document.getElementById(`preview-${filename}`);
        if (existingPreview) {
            existingPreview.remove(); // Remove existing preview if it exists
        }

        // Create a new preview section for this file
        const previewDiv = document.createElement('div');
        previewDiv.id = `preview-${filename}`;
        previewDiv.className = 'bg-white shadow rounded-lg p-6';

        // Add file name header
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-4';
        header.innerHTML = `
            <h3 class="text-lg font-medium text-gray-900">${filename}</h3>
            <button onclick="document.getElementById('preview-${filename}').remove()" 
                    class="text-gray-400 hover:text-gray-500">
                <i class="fas fa-times"></i>
            </button>
        `;
        previewDiv.appendChild(header);

        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto';
        
        // Create and populate table
        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200';
        
        // Create table header
        let headerHTML = '<thead><tr>';
        data.columns.forEach(column => {
            headerHTML += `<th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${column}</th>`;
        });
        headerHTML += '</tr></thead>';
        
        // Create table body
        let bodyHTML = '<tbody class="bg-white divide-y divide-gray-200">';
        data.rows.forEach((row, idx) => {
            bodyHTML += `<tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">`;
            row.forEach(cell => {
                bodyHTML += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${cell !== null ? cell : ''}</td>`;
            });
            bodyHTML += '</tr>';
        });
        bodyHTML += '</tbody>';
        
        // Update table content
        table.innerHTML = headerHTML + bodyHTML;
        
        // Add table to container
        tableContainer.appendChild(table);
        previewDiv.appendChild(tableContainer);
        
        // Add the new preview section to the tables container
        tablesContainer.insertBefore(previewDiv, tablesContainer.firstChild);
        
        // Show success message
        showToast('Preview loaded successfully', 'success');
    } catch (error) {
        console.error('Error previewing file:', error);
        showToast(error.message || 'Error loading preview', 'error');
    }
}

export async function deleteFile(filename) {
    try {
        console.log('Attempting to delete file:', filename);
        const response = await fetch(`/delete_file/${filename}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete file');
        }
        
        const data = await response.json();
        
        if (data.message === 'File deleted successfully') {
            console.log('File deleted successfully, updating state and UI');
            
            // Update state first
            removeFileFromUploadedFiles(filename);
            
            // Force UI refresh
            const files = getUploadedFiles();
            console.log('Current files after deletion:', files);
            
            // Update UI
            updateFilesList();
            console.log('UI updated after file deletion');
            
            // If no files left, reinitialize upload functionality
            if (files.length === 0) {
                console.log('No files left, reinitializing upload...');
                
                // Reset upload area visibility
                const uploadArea = document.getElementById('upload-area');
                const uploadedFiles = document.getElementById('uploaded-files');
                if (uploadArea && uploadedFiles) {
                    uploadArea.style.display = 'block';
                    uploadedFiles.classList.add('hidden');
                }
                
                // Wait longer for DOM updates and try multiple times if needed
                let attempts = 0;
                const maxAttempts = 5;
                const tryReinitialize = () => {
                    attempts++;
                    import('/static/js/upload.js').then(module => {
                        if (module.initializeUpload()) {
                            console.log('Upload reinitialized successfully');
                        } else if (attempts < maxAttempts) {
                            console.log(`Retrying reinitialization... (${attempts}/${maxAttempts})`);
                            setTimeout(tryReinitialize, 500);
                        } else {
                            console.error('Failed to reinitialize upload after maximum attempts');
                        }
                    }).catch(err => {
                        console.error('Error reinitializing upload:', err);
                    });
                };
                
                setTimeout(tryReinitialize, 500);
            }
            
            showToast('File deleted successfully', 'success');
            return true;
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        showToast('Error deleting file', 'error');
        return false;
    }
}

export function closePreviewModal() {
    console.log('Closing preview modal...'); // Debug log
    document.getElementById('preview-modal')?.classList.add('hidden');
}

export function initializeFileManagement() {
    console.log('Initializing file management...'); // Debug log
    
    // Initialize process button handler
    const processButton = document.getElementById('process-button');
    console.log('Process button found:', processButton !== null); // Debug log
    
    if (processButton) {
        processButton.addEventListener('click', async () => {
            try {
                // Disable button and show loading state
                processButton.disabled = true;
                processButton.innerHTML = '<span class="animate-spin">↻</span> Processing...';

                const taskId = getCurrentTaskId();
                if (!taskId) {
                    throw new Error('No task ID available');
                }

                const files = getUploadedFiles();
                console.log('Files to process:', files); // Debug log
                
                if (!files || files.length === 0) {
                    throw new Error('No files available to process');
                }

                // Emit process_data event via socket
                socket.emit('process_data', { 
                    task_id: taskId,
                    filename: files[0] // Send the first file to process
                });
                
                showToast('Processing started successfully', 'success');

            } catch (error) {
                console.error('Error processing data:', error);
                showToast(error.message || 'Failed to start processing', 'error');
            } finally {
                // Reset button state
                processButton.disabled = false;
                processButton.innerHTML = 'Process Data';
            }
        });
        
        // Add initial visibility check
        const hasFiles = getUploadedFiles().length > 0;
        processButton.classList.toggle('hidden', !hasFiles);
        console.log('Initial process button visibility:', !processButton.classList.contains('hidden')); // Debug log
    }
    
    const fileListElement = document.getElementById('file-list');
    if (!fileListElement) return;

    // Initialize file list
    updateFilesList();
}

export function addUploadedFile(file) {
    console.log('Adding uploaded file:', file); // Debug log
    try {
        const files = getUploadedFiles();
        if (!files.includes(file.name)) {
            files.push(file.name);
            localStorage.setItem('uploadedFiles', JSON.stringify(files));
            updateFilesList();
            console.log('Updated files list:', files); // Debug log
        }
    } catch (error) {
        console.error('Error adding uploaded file:', error);
    }
}

export function removeUploadedFile(fileName) {
    console.log('Removing uploaded file:', fileName);
    try {
        const files = getUploadedFiles().filter(name => name !== fileName);
        localStorage.setItem('uploadedFiles', JSON.stringify(files));
        updateFilesList();
        console.log('Updated files list after removal:', files); // Debug log
    } catch (error) {
        console.error('Error removing uploaded file:', error);
    }
}

// Make functions available globally
window.previewFile = previewFile;
window.deleteFile = deleteFile;
window.removeFile = removeUploadedFile;

// Update the file list when files are uploaded
document.addEventListener('DOMContentLoaded', () => {
    updateFilesList();
});

// Listen for file list updates
document.addEventListener('fileListUpdated', () => {
    updateFilesList();
});