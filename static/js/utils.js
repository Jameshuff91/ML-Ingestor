// Utility functions

export function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.fixed.bottom-4');
    if (existingToast) {
        document.body.removeChild(existingToast);
    }
    
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded ${
        type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    } text-white`;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

export function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const content = section.querySelector('.section-content');
    const icon = section.querySelector('.toggle-icon');
    
    if (!content || !icon) return;
    
    const isHidden = content.classList.contains('hidden');
    content.classList.toggle('hidden');
    icon.classList.toggle('rotate-180');
}

export function showTab(tabId) {
    const allTabs = document.querySelectorAll('[data-tab-content]');
    const allButtons = document.querySelectorAll('[data-tab]');
    const selectedTab = document.querySelector(`[data-tab-content="${tabId}"]`);
    const selectedButton = document.querySelector(`[data-tab="${tabId}"]`);
    
    if (!selectedTab || !selectedButton) return;
    
    // Hide all tabs and remove active state from buttons
    allTabs.forEach(tab => tab.classList.add('hidden'));
    allButtons.forEach(button => {
        button.classList.remove('bg-gray-200');
        button.setAttribute('aria-selected', 'false');
    });
    
    // Show selected tab and set button as active
    selectedTab.classList.remove('hidden');
    selectedButton.classList.add('bg-gray-200');
    selectedButton.setAttribute('aria-selected', 'true');
}

export function updateProgress(percent, status) {
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('progress-status');
    
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
    }
    
    if (statusText) {
        statusText.textContent = status || `${percent}%`;
    }

    // Show the progress section if it's hidden
    const progressSection = document.getElementById('progress-section');
    if (progressSection && progressSection.classList.contains('hidden')) {
        progressSection.classList.remove('hidden');
    }
}

export function rotateERD(degrees) {
    const erdContainer = document.querySelector('.erd-container');
    if (erdContainer) {
        erdContainer.style.transform = `rotate(${degrees}deg)`;
    }
}
