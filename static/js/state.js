// Shared state management
let currentTaskId = null;
let uploadedFiles = [];
let filenameMapping = {};

// Initialize state from localStorage if available
try {
    const storedFiles = localStorage.getItem('uploadedFiles');
    const storedMapping = localStorage.getItem('filenameMapping');
    
    if (storedFiles) {
        uploadedFiles = JSON.parse(storedFiles);
        console.log('Loaded stored files:', uploadedFiles);
    }
    
    if (storedMapping) {
        filenameMapping = JSON.parse(storedMapping);
        console.log('Loaded filename mapping:', filenameMapping);
    }
    
    // Load stored task ID
    const storedTaskId = localStorage.getItem('currentTaskId');
    if (storedTaskId) {
        currentTaskId = storedTaskId;
    }
} catch (error) {
    console.error('Error loading stored state:', error);
    // Reset state if loading fails
    uploadedFiles = [];
    filenameMapping = {};
}

// Add a new function to initialize state
export function initializeState() {
    try {
        const storedFiles = localStorage.getItem('uploadedFiles');
        const storedMapping = localStorage.getItem('filenameMapping');
        
        if (storedFiles) {
            uploadedFiles = JSON.parse(storedFiles);
            console.log('Initialized stored files:', uploadedFiles);
        }
        
        if (storedMapping) {
            filenameMapping = JSON.parse(storedMapping);
            console.log('Initialized filename mapping:', filenameMapping);
        }
        
        // Load stored task ID
        const storedTaskId = localStorage.getItem('currentTaskId');
        if (storedTaskId) {
            currentTaskId = storedTaskId;
        }
    } catch (error) {
        console.error('Error initializing state:', error);
        // Reset state if loading fails
        uploadedFiles = [];
        filenameMapping = {};
    }
}

export function getCurrentTaskId() {
    return currentTaskId;
}

export function setCurrentTaskId(taskId) {
    currentTaskId = taskId;
    // Persist to localStorage
    try {
        if (taskId) {
            localStorage.setItem('currentTaskId', taskId);
            console.log('Stored task ID:', taskId); // Debug log
        } else {
            localStorage.removeItem('currentTaskId');
            console.log('Cleared stored task ID'); // Debug log
        }
    } catch (error) {
        console.error('Error saving task ID to storage:', error);
    }
}

export function addFileToUploadedFiles(originalFilename, serverFilename) {
    // Initialize state first
    initializeState();
    
    if (!uploadedFiles.includes(originalFilename)) {
        uploadedFiles.push(originalFilename);
    }
    
    if (serverFilename) {
        filenameMapping[originalFilename] = serverFilename;
    }
    
    // Persist both to localStorage
    try {
        localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
        localStorage.setItem('filenameMapping', JSON.stringify(filenameMapping));
        console.log('Stored files:', uploadedFiles);
        console.log('Stored mapping:', filenameMapping);
        
        // Dispatch event to notify of file list update
        window.dispatchEvent(new CustomEvent('filesUpdated', {
            detail: { files: uploadedFiles }
        }));
    } catch (error) {
        console.error('Error saving files to storage:', error);
    }
}

export function removeFileFromUploadedFiles(filename) {
    uploadedFiles = uploadedFiles.filter(f => f !== filename);
    delete filenameMapping[filename];
    
    // Persist to localStorage
    try {
        localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
        localStorage.setItem('filenameMapping', JSON.stringify(filenameMapping));
    } catch (error) {
        console.error('Error saving files to storage:', error);
    }
}

export function getUploadedFiles() {
    // Initialize state before returning
    initializeState();
    return uploadedFiles;
}

export function getMappedFilename(originalFilename) {
    return filenameMapping[originalFilename] || originalFilename;
}

export function clearUploadedFiles() {
    uploadedFiles = [];
    filenameMapping = {};
    try {
        localStorage.removeItem('uploadedFiles');
        localStorage.removeItem('filenameMapping');
        console.log('Cleared stored files and mapping');
    } catch (error) {
        console.error('Error clearing files from storage:', error);
    }
}
