// Shared state management
let currentTaskId = null;
let uploadedFiles = new Set();

export function getCurrentTaskId() {
    return currentTaskId;
}

export function setCurrentTaskId(taskId) {
    currentTaskId = taskId;
}

export function addFileToUploadedFiles(filename) {
    uploadedFiles.add(filename);
}

export function removeFileFromUploadedFiles(filename) {
    uploadedFiles.delete(filename);
}

export function getUploadedFiles() {
    return Array.from(uploadedFiles);
}

export function clearUploadedFiles() {
    uploadedFiles.clear();
}
