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
            // Add to uploaded files list with both original and server filenames
            addFileToUploadedFiles(file.name, result.filename);
            
            // Set the task ID from the upload response
            if (result.task_id) {
                setCurrentTaskId(result.task_id);
                
                // Subscribe to task updates
                if (socket && socket.connected) {
                    socket.emit('subscribe', { task_id: result.task_id });
                }
                
                // Show progress section and update progress bar
                const progressSection = document.getElementById('progress-section');
                if (progressSection) {
                    progressSection.classList.remove('hidden');
                    updateProgress(0, 'File uploaded successfully. Click Process to begin analysis.');
                }
            }
            
            showToast('File uploaded successfully', 'success');
            
            // Enable and update process button
            const processBtn = document.getElementById('process-btn');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                processBtn.classList.add('hover:bg-indigo-700');
                processBtn.dataset.taskId = result.task_id;
                processBtn.textContent = 'Process Data'; // Reset button text
            }
            
            // Only emit start_validation event
            if (socket && socket.connected) {
                socket.emit('start_validation', { 
                    filename: result.filename,
                    original_filename: file.name  // Added original filename
                });
            }
            
            // Show preview section and update UI
            updateFilesList();
            
            // Update preview if available
            if (result.preview && result.columns) {
                updatePreview(result.columns, result.preview);
            }
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast(error.message || 'Error uploading file', 'error');
    }
}

// New helper function to update preview
function updatePreview(columns, previewData) {
    const thead = document.querySelector('#preview-table thead');
    const tbody = document.querySelector('#preview-table tbody');
    
    if (thead && columns.length > 0) {
        thead.innerHTML = `
            <tr>
                ${columns.map(col => `
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ${col}
                    </th>
                `).join('')}
            </tr>
        `;
    }
    
    if (tbody && previewData.length > 0) {
        tbody.innerHTML = previewData.map(row => `
            <tr class="bg-white">
                ${columns.map(col => `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${row[col] !== null ? row[col] : ''}
                    </td>
                `).join('')}
            </tr>
        `).join('');
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
    // Check if document is still loading
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUpload);
        return;
    }
    
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-upload');
    const chooseFilesButton = document.getElementById('choose-files-button');
    const processButton = document.getElementById('process-btn');
    
    if (!uploadArea || !fileInput || !chooseFilesButton) {
        console.warn('Upload elements not found, please check your HTML');
        return;
    }
    
    console.log('Found all required elements, initializing...'); 
    
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
    fileInput.addEventListener('change', handleFileSelect);
    chooseFilesButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
    });
    
    // Process Data button handler
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

                // Get files directly from localStorage
                const storedFiles = localStorage.getItem('uploadedFiles');
                const files = storedFiles ? JSON.parse(storedFiles) : [];
                console.log('Files from localStorage:', files); // Debug log
                
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
    }
    
    console.log('Upload initialized successfully');
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUpload);
} else {
    initializeUpload();
}

// File input change handler
if (fileInput) {
    fileInput.addEventListener('change', async (event) => {
        console.log('File input change event triggered'); // Debug log
        
        const files = event.target.files;
        if (!files || files.length === 0) {
            console.log('No files selected');
            return;
        }

        // Show progress section and hide upload area
        if (progressSection) progressSection.classList.remove('hidden');
        if (uploadArea) uploadArea.classList.add('hidden');

        try {
            console.log('Starting new upload...');
            
            // Get or create task ID
            let taskId = getCurrentTaskId();
            if (!taskId) {
                taskId = generateUUID();
                setCurrentTaskId(taskId);
            }
            console.log('Set task ID:', taskId);

            // Create FormData and append file
            const formData = new FormData();
            formData.append('file', files[0]);
            formData.append('task_id', taskId);

            // Upload file
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            console.log('Upload response:', result);

            // Add file to state
            addFileToUploadedFiles(files[0].name);
            
            // Update UI
            updateFilesList();
            showToast('File uploaded successfully', 'success');

        } catch (error) {
            console.error('Upload error:', error);
            showToast('Upload failed: ' + error.message, 'error');
            
            // Reset UI on error
            if (progressSection) progressSection.classList.add('hidden');
            if (uploadArea) uploadArea.classList.remove('hidden');
        } finally {
            // Reset file input
            fileInput.value = '';
            console.log('Upload completed, resetting state...');
        }
    });
}

// Drag and drop handlers
if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('border-blue-500');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('border-blue-500');
    });

    uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('border-blue-500');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}
