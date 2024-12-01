// Tab management
export function initializeTabs() {
    const tabs = [
        { id: 'validation', button: 'validation-tab-btn', content: 'validation-tab' },
        { id: 'correlation', button: 'correlation-tab-btn', content: 'correlation-tab' },
        { id: 'distribution', button: 'distribution-tab-btn', content: 'distribution-tab' }
    ];

    // Set initial active tab
    setActiveTab('validation');

    // Add click handlers
    tabs.forEach(tab => {
        const button = document.getElementById(tab.button);
        if (button) {
            button.addEventListener('click', () => setActiveTab(tab.id));
        }
    });

    function setActiveTab(tabId) {
        // Update button styles
        tabs.forEach(tab => {
            const button = document.getElementById(tab.button);
            const content = document.getElementById(tab.content);
            
            if (button && content) {
                if (tab.id === tabId) {
                    button.classList.remove('border-transparent', 'text-gray-500');
                    button.classList.add('border-blue-500', 'text-blue-600');
                    content.classList.remove('hidden');
                } else {
                    button.classList.remove('border-blue-500', 'text-blue-600');
                    button.classList.add('border-transparent', 'text-gray-500');
                    content.classList.add('hidden');
                }
            }
        });
    }
}
