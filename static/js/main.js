document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const validationResults = document.getElementById('validation-results');
    const correlationResults = document.getElementById('correlation-results');
    const erdDiagram = document.getElementById('erd-diagram');

    // Drag and drop handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        uploadArea.classList.add('dragover');
    }

    function unhighlight(e) {
        uploadArea.classList.remove('dragover');
    }

    // Handle file drop
    uploadArea.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            uploadFile(file);
        }
    }

    function uploadFile(file) {
        // Show loading state
        showLoading();

        const formData = new FormData();
        formData.append('file', file);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading state
            hideLoading();

            if (data.error) {
                showError(data.error);
            } else {
                displayResults(data);
            }
        })
        .catch(error => {
            hideLoading();
            showError('Error uploading file: ' + error.message);
        });
    }

    function showLoading() {
        // Add loading spinner
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.innerHTML = `
            <div class="loading-spinner"></div>
            <p class="mt-3">Processing file...</p>
        `;
        uploadArea.appendChild(loading);
        loading.style.display = 'block';
    }

    function hideLoading() {
        const loading = uploadArea.querySelector('.loading');
        if (loading) {
            loading.remove();
        }
    }

    function showError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger';
        alert.textContent = message;
        uploadArea.appendChild(alert);
        setTimeout(() => alert.remove(), 5000);
    }

    function displayResults(data) {
        // Display validation results
        displayValidationResults(data.validation);
        
        // Display correlation results
        displayCorrelationResults(data.correlations);
        
        // Display ERD
        displayERD(data.erd);
    }

    function displayValidationResults(validation) {
        let html = '<div class="list-group">';
        
        // Missing values
        html += `
            <div class="list-group-item">
                <h6 class="mb-1">Missing Values</h6>
                <ul class="list-unstyled mb-0">
        `;
        for (const [column, count] of Object.entries(validation.missing_values.total_missing)) {
            const percentage = validation.missing_values.missing_percentages[column];
            html += `<li>${column}: ${count} (${percentage.toFixed(2)}%)</li>`;
        }
        html += '</ul></div>';

        // Negative values
        if (Object.keys(validation.negative_values).length > 0) {
            html += `
                <div class="list-group-item">
                    <h6 class="mb-1">Negative Values</h6>
                    <ul class="list-unstyled mb-0">
            `;
            for (const [column, count] of Object.entries(validation.negative_values)) {
                html += `<li>${column}: ${count}</li>`;
            }
            html += '</ul></div>';
        }

        // Duplicates
        html += `
            <div class="list-group-item">
                <h6 class="mb-1">Duplicates</h6>
                <p class="mb-0">Total duplicate rows: ${validation.duplicates.total_duplicates}</p>
            </div>
        `;

        html += '</div>';
        validationResults.innerHTML = html;
    }

    function displayCorrelationResults(correlations) {
        if (correlations.correlation_matrix_path) {
            const img = document.createElement('img');
            img.src = correlations.correlation_matrix_path;
            img.className = 'correlation-matrix';
            correlationResults.innerHTML = '';
            correlationResults.appendChild(img);

            // Display high correlations
            if (correlations.high_correlations.length > 0) {
                const highCorr = document.createElement('div');
                highCorr.className = 'mt-3';
                highCorr.innerHTML = `
                    <h6>High Correlations</h6>
                    <ul class="list-unstyled">
                        ${correlations.high_correlations.map(corr => 
                            `<li>${corr.column1} ↔ ${corr.column2}: ${corr.correlation.toFixed(3)}</li>`
                        ).join('')}
                    </ul>
                `;
                correlationResults.appendChild(highCorr);
            }
        }
    }

    function displayERD(erd) {
        if (erd.erd_path) {
            const img = document.createElement('img');
            img.src = erd.erd_path;
            img.className = 'img-fluid';
            erdDiagram.innerHTML = '';
            erdDiagram.appendChild(img);
        }
    }
});
