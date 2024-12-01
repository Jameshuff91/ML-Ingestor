// File management functionality
import { getUploadedFiles } from './state.js';
import { showToast } from './utils.js';

export function updateFilesList() {
    const filesList = document.getElementById('uploaded-files-list');
    if (!filesList) return;
    
    filesList.innerHTML = '';
    const files = getUploadedFiles();
    
    files.forEach(filename => {
        const fileElement = document.createElement('div');
        fileElement.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
        fileElement.innerHTML = `
            <div class="flex items-center">
                <span class="text-gray-900">${filename}</span>
            </div>
            <div class="flex space-x-2">
                <button onclick="window.previewFile('${filename}')" 
                        class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Preview
                </button>
                <button onclick="window.deleteFile('${filename}')" 
                        class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">
                    Delete
                </button>
            </div>
        `;
        filesList.appendChild(fileElement);
    });
}

export async function previewFile(filename) {
    try {
        const response = await fetch(`/preview_file/${filename}`);
        const data = await response.json();
        
        const modal = document.getElementById('preview-modal');
        const filenameElement = document.getElementById('preview-filename');
        const table = document.getElementById('preview-table');
        
        filenameElement.textContent = filename;
        
        // Create table header
        let headerHTML = '<thead><tr>';
        data.columns.forEach(column => {
            headerHTML += `<th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${column}</th>`;
        });
        headerHTML += '</tr></thead>';
        
        // Create table body
        let bodyHTML = '<tbody>';
        data.rows.forEach((row, idx) => {
            bodyHTML += `<tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">`;
            row.forEach(cell => {
                bodyHTML += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${cell}</td>`;
            });
            bodyHTML += '</tr>';
        });
        bodyHTML += '</tbody>';
        
        table.innerHTML = headerHTML + bodyHTML;
        modal.classList.remove('hidden');
    } catch (error) {
        showToast('Error previewing file', 'error');
    }
}

export function closePreviewModal() {
    document.getElementById('preview-modal')?.classList.add('hidden');
}

export async function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    try {
        const response = await fetch(`/delete_file/${filename}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            updateFilesList();
            showToast('File deleted successfully', 'success');
        } else {
            throw new Error('Failed to delete file');
        }
    } catch (error) {
        showToast('Error deleting file', 'error');
    }
}

export function initializeFileManagement() {
    const fileListElement = document.getElementById('file-list');
    if (!fileListElement) return;

    // Initialize file list
    updateFileList();
}

function updateFileList() {
    const fileListElement = document.getElementById('file-list');
    if (!fileListElement) return;

    // Get uploaded files from state management
    const files = getUploadedFiles();

    // Clear existing list
    fileListElement.innerHTML = '';

    // Add each file to the list
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex justify-between items-center p-2 hover:bg-gray-50';
        fileItem.innerHTML = `
            <span class="text-sm text-gray-600">${file.name}</span>
            <button class="text-red-500 hover:text-red-700" onclick="window.removeFile('${file.name}')">
                <i class="fas fa-trash"></i>
            </button>
        `;
        fileListElement.appendChild(fileItem);
    });
}

export function addUploadedFile(file) {
    try {
        const files = getUploadedFiles();
        files.push({
            name: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString()
        });
        localStorage.setItem('uploadedFiles', JSON.stringify(files));
        updateFileList();
    } catch (error) {
        console.error('Error adding uploaded file:', error);
    }
}

export function removeUploadedFile(fileName) {
    try {
        const files = getUploadedFiles().filter(file => file.name !== fileName);
        localStorage.setItem('uploadedFiles', JSON.stringify(files));
        updateFileList();
    } catch (error) {
        console.error('Error removing uploaded file:', error);
    }
}

// Make functions available globally
window.removeFile = removeUploadedFile;

// Update the file list when files are uploaded
document.addEventListener('DOMContentLoaded', () => {
    updateFilesList();
});

// Listen for file list updates
document.addEventListener('fileListUpdated', () => {
    updateFilesList();
});