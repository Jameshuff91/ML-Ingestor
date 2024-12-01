// Shared state management
let currentTaskId = null;
let uploadedFiles = new Set();

// Initialize state from localStorage if available
try {
    const storedFiles = localStorage.getItem('uploadedFiles');
    if (storedFiles) {
        uploadedFiles = new Set(JSON.parse(storedFiles));
    }
} catch (error) {
    console.error('Error loading stored files:', error);
}

export function getCurrentTaskId() {
    return currentTaskId;
}

export function setCurrentTaskId(taskId) {
    currentTaskId = taskId;
}

export function addFileToUploadedFiles(filename) {
    uploadedFiles.add(filename);
    // Persist to localStorage
    try {
        localStorage.setItem('uploadedFiles', JSON.stringify(Array.from(uploadedFiles)));
    } catch (error) {
        console.error('Error saving files to storage:', error);
    }
}

export function removeFileFromUploadedFiles(filename) {
    uploadedFiles.delete(filename);
    // Persist to localStorage
    try {
        localStorage.setItem('uploadedFiles', JSON.stringify(Array.from(uploadedFiles)));
    } catch (error) {
        console.error('Error saving files to storage:', error);
    }
}

export function getUploadedFiles() {
    return Array.from(uploadedFiles);
}

export function clearUploadedFiles() {
    uploadedFiles.clear();
    // Clear localStorage
    try {
        localStorage.removeItem('uploadedFiles');
    } catch (error) {
        console.error('Error clearing stored files:', error);
    }
}
