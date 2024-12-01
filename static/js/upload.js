// File upload functionality
import { showToast, updateProgress } from './utils.js';
import { socket } from './socket.js';
import { setCurrentTaskId, addFileToUploadedFiles, removeFileFromUploadedFiles, getCurrentTaskId } from './state.js';
import { updateFilesList } from './file-management.js';

// Store mapping of original to unique filenames
let filenameMapping = {};
let isUploading = false; // Flag to track upload state

export function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

export function highlight(e) {
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.classList.add('border-indigo-500');
    }
}

export function unhighlight(e) {
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.classList.remove('border-indigo-500');
    }
}

export function handleDrop(e) {
    if (isUploading) return; // Prevent multiple uploads
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        uploadFiles(files);
    }
}

export function handleFileSelect(e) {
    if (isUploading) return; // Prevent multiple uploads
    
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        uploadFiles(files);
    }
}

// Make uploadFiles available globally and export it
export async function uploadFiles(files) {
    if (isUploading) {
        console.log('Upload already in progress, skipping...'); // Debug log
        return;
    }
    
    try {
        console.log('Starting new upload...'); // Debug log
        isUploading = true;
        
        // Show upload progress
        updateProgress(0, 'Starting upload...');
        
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files[]', file);
        });
        
        const requestId = 'req_' + Date.now();
        
        // Create promise to handle XMLHttpRequest
        const uploadPromise = new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    updateProgress(percentComplete, `Uploading: ${percentComplete}%`);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        updateProgress(100, 'Upload complete!');
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    reject(new Error('Upload failed'));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });
            
            xhr.open('POST', '/upload_multiple');
            xhr.setRequestHeader('X-Request-ID', requestId);
            xhr.send(formData);
        });
        
        const data = await uploadPromise;
        
        if (data.success) {
            // Store the task ID (use the first task ID if multiple files were uploaded)
            if (data.task_ids && data.task_ids.length > 0) {
                setCurrentTaskId(data.task_ids[0]);
                console.log('Set task ID:', data.task_ids[0]); // Debug log
            }
            
            // Update UI
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.value = '';
            }
            
            // Show success message
            showToast('Files uploaded successfully!', 'success');
            updateProgress(100, 'Upload complete!');
            
            // Add files to uploaded files list
            if (data.filenames) {
                data.filenames.forEach(filename => {
                    addFileToUploadedFiles(filename);
                });
                
                // Update the files list in the preview section
                updateFilesList();
            }
        } else {
            throw new Error(data.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error); // Debug log
        updateProgress(0, 'Upload failed');
        showToast(error.message || 'Error uploading files', 'error');
    } finally {
        console.log('Upload completed, resetting state...'); // Debug log
        isUploading = false;
    }
}

// Make uploadFiles available globally
window.uploadFiles = uploadFiles;

export async function handleFile(file) {
    try {
        // Check file type
        if (!file.name.match(/\.(csv|xlsx?)$/i)) {
            showToast('Please upload a CSV or Excel file', 'error');
            return;
        }
        
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            showToast('File size must be less than 10MB', 'error');
            return;
        }
        
        // Create FormData
        const formData = new FormData();
        formData.append('file', file);
        
        // Show upload started toast
        showToast('Starting file upload...', 'info');
        
        // Make upload request
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        if (result.success) {
            // Add to uploaded files list
            filenameMapping[file.name] = result.filename;
            addFileToUploadedFiles(file.name);
            
            // Set the task ID from the upload response
            if (result.task_id) {
                setCurrentTaskId(result.task_id);
                
                // Subscribe to task updates
                if (socket && socket.connected) {
                    socket.emit('subscribe', { task_id: result.task_id });
                }
                
                // Show progress section
                const progressSection = document.getElementById('progress-section');
                if (progressSection) {
                    progressSection.classList.remove('hidden');
                }
                
                // Reset progress bar
                updateProgress(0, 'File uploaded successfully. Click Process to begin analysis.');
            }
            
            showToast('File uploaded successfully', 'success');
            
            // Enable and update process button
            const processBtn = document.getElementById('process-btn');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                processBtn.classList.add('hover:bg-indigo-700');
                processBtn.dataset.taskId = result.task_id;
            }
            
            // Only emit start_validation event, remove start_processing
            if (socket && socket.connected) {
                socket.emit('start_validation', { filename: result.filename });
            } else {
                showToast('Not connected to server. Please refresh the page.', 'error');
            }
            
            // Show preview section
            const previewSection = document.getElementById('preview-section');
            if (previewSection) {
                previewSection.classList.remove('hidden');
            }
            
            // Create table headers
            if (result.columns && result.columns.length > 0) {
                const thead = document.querySelector('#preview-table thead');
                if (thead) {
                    thead.innerHTML = `
                        <tr>
                            ${result.columns.map(col => `
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    ${col}
                                </th>
                            `).join('')}
                        </tr>
                    `;
                }
                
                // Create table rows
                if (result.preview && result.preview.length > 0) {
                    const tbody = document.querySelector('#preview-table tbody');
                    if (tbody) {
                        tbody.innerHTML = result.preview.map(row => `
                            <tr class="bg-white">
                                ${result.columns.map(col => `
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ${row[col] !== null ? row[col] : ''}
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('');
                    }
                }
            }
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast(error.message || 'Error uploading file', 'error');
    }
}

export async function handleFiles(files) {
    for (const file of files) {
        await handleFile(file);
    }
}

// Update uploaded files list in UI
function updateUploadedFilesList() {
    const uploadedFilesContainer = document.getElementById('uploaded-files');
    const filesList = document.getElementById('uploaded-files-list');
    
    if (!uploadedFilesContainer || !filesList) {
        console.error('Upload UI elements not found');
        return;
    }
    
    if (getUploadedFiles().length > 0) {
        uploadedFilesContainer.classList.remove('hidden');
        
        filesList.innerHTML = getUploadedFiles().map(file => `
            <div class="flex items-center justify-between bg-gray-50 p-2 rounded mb-2">
                <span class="text-sm text-gray-700">${file}</span>
                <button data-filename="${filenameMapping[file]}" class="remove-file-btn text-red-600 hover:text-red-800">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        
        // Add event listeners to remove buttons
        filesList.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filename = btn.dataset.filename;
                removeFile(filename);
            });
        });
    } else {
        uploadedFilesContainer.classList.add('hidden');
        filesList.innerHTML = '';
    }
}

// Remove file from uploaded files list
function removeFile(filename) {
    // Remove from server
    fetch(`/remove_file/${filename}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                removeFileFromUploadedFiles(filename);
                showToast('File removed successfully');
            } else {
                showToast(data.error || 'Failed to remove file', 'error');
            }
        })
        .catch(() => {
            showToast('Failed to remove file', 'error');
        });
}

// Get list of uploaded files
export function getUploadedFiles() {
    return window.uploadedFiles || [];
}

// Initialize upload area and file list
export function initializeUpload() {
    console.log('Initializing upload...'); // Debug log
    
    // Wait for elements to be available
    const maxAttempts = 10;
    let attempts = 0;
    
    function tryInitialize() {
        // Wait for DOM to be ready
        if (document.readyState !== 'complete') {
            attempts++;
            if (attempts < maxAttempts) {
                console.log(`DOM not ready, retrying... (${attempts}/${maxAttempts})`);
                setTimeout(tryInitialize, 100);
                return false;
            }
            console.error('DOM not ready after maximum attempts');
            return false;
        }
        
        const uploadArea = document.getElementById('upload-area');
        let fileInput = document.getElementById('file-input');
        let chooseFilesButton = document.getElementById('choose-files-button');
        
        if (!uploadArea || !fileInput || !chooseFilesButton) {
            attempts++;
            if (attempts < maxAttempts) {
                console.log(`Elements not found, retrying... (${attempts}/${maxAttempts})`);
                setTimeout(tryInitialize, 100);
                return false;
            }
            console.error('Upload elements not found after maximum attempts');
            return false;
        }
        
        console.log('Found all required elements, initializing...'); // Debug log
        
        // Reset file input
        fileInput.value = '';
        
        // Drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        uploadArea.addEventListener('drop', handleDrop);
        
        // Remove existing event listeners from file input
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        fileInput = newFileInput; // Update reference to new element
        
        // Add fresh event listener
        fileInput.addEventListener('change', handleFileSelect);
        
        // Choose files button event
        if (chooseFilesButton) {
            // Remove existing event listeners
            const newButton = chooseFilesButton.cloneNode(true);
            chooseFilesButton.parentNode.replaceChild(newButton, chooseFilesButton);
            chooseFilesButton = newButton; // Update reference to new element
            
            // Add fresh event listener
            chooseFilesButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
        }
        
        console.log('Upload initialized successfully'); // Debug log
        return true;
    }
    
    return tryInitialize();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (initializeUpload()) {
        console.log('Initial upload setup complete'); // Debug log
    }
});
