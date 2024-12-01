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
    previewSection.classList.toggle('hidden', files.length === 0);
    if (uploadArea) {
        uploadArea.classList.toggle('hidden', files.length > 0);
    }
    
    // Update process button visibility
    const processButton = document.getElementById('process-button');
    if (processButton) {
        processButton.classList.toggle('hidden', files.length === 0);
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
        console.log('Attempting to delete file:', filename); // Debug log
        const response = await fetch(`/delete_file/${filename}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete file');
        }
        
        const data = await response.json();
        
        if (data.message === 'File deleted successfully') {
            console.log('File deleted successfully, updating state and UI'); // Debug log
            
            // Update state first
            removeFileFromUploadedFiles(filename);
            
            // Force UI refresh
            const files = getUploadedFiles();
            console.log('Current files after deletion:', files); // Debug log
            
            updateFilesList();
            console.log('UI updated after file deletion'); // Debug log
            
            // Show success message
            showToast('File deleted successfully', 'success');
            
            // Dispatch event
            const event = new CustomEvent('fileDeleted', {
                detail: { filename }
            });
            document.dispatchEvent(event);
            
            return true;
        } else {
            throw new Error(data.message || 'Failed to delete file');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast(error.message || 'Error deleting file', 'error');
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
    if (processButton) {
        processButton.addEventListener('click', () => {
            const taskId = getCurrentTaskId();
            if (taskId) {
                showToast('Starting data processing...', 'info');
                socket.emit('process_data', { task_id: taskId });
                console.log('Emitted process_data with task ID:', taskId);
            } else {
                console.error('No task ID available for processing');
                showToast('Error: Unable to start processing', 'error');
            }
        });
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
        files.push({
            name: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString()
        });
        localStorage.setItem('uploadedFiles', JSON.stringify(files));
        updateFilesList();
    } catch (error) {
        console.error('Error adding uploaded file:', error); // Debug log
    }
}

export function removeUploadedFile(fileName) {
    console.log('Removing uploaded file:', fileName); // Debug log
    try {
        const files = getUploadedFiles().filter(file => file.name !== fileName);
        localStorage.setItem('uploadedFiles', JSON.stringify(files));
        updateFilesList();
    } catch (error) {
        console.error('Error removing uploaded file:', error); // Debug log
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