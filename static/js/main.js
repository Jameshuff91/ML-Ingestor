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
        // Initialize tooltips
        const tooltips = {};
        document.querySelectorAll('.info-button').forEach(button => {
            const tooltip = document.createElement('div');
            tooltip.className = 'hidden absolute z-50 p-2 bg-gray-900 text-white text-sm rounded shadow-lg max-w-xs';
            tooltip.style.width = '250px';
            tooltip.textContent = button.dataset.tooltip;
            
            button.appendChild(tooltip);
            tooltips[button] = tooltip;

            button.addEventListener('mouseenter', () => {
                tooltip.classList.remove('hidden');
                // Position the tooltip
                const rect = button.getBoundingClientRect();
                tooltip.style.left = `${rect.right + 5}px`;
                tooltip.style.top = `${rect.top}px`;
            });

            button.addEventListener('mouseleave', () => {
                tooltip.classList.add('hidden');
            });
        });

        // Display basic validation results
        let basicHtml = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
        
        // Missing Values
        basicHtml += `
            <div class="bg-white p-4 rounded shadow">
                <h5 class="font-medium mb-2">Missing Values</h5>
                <ul class="space-y-1">
        `;
        Object.entries(validation.basic_validation.missing_values.total_missing).forEach(([column, count]) => {
            const percentage = validation.basic_validation.missing_values.missing_percentages[column];
            basicHtml += `<li class="text-sm">${column}: ${count} (${percentage.toFixed(2)}%)</li>`;
        });
        basicHtml += '</ul></div>';

        // Negative Values
        if (Object.keys(validation.basic_validation.negative_values).length > 0) {
            basicHtml += `
                <div class="bg-white p-4 rounded shadow">
                    <h5 class="font-medium mb-2">Negative Values</h5>
                    <ul class="space-y-1">
            `;
            Object.entries(validation.basic_validation.negative_values).forEach(([column, count]) => {
                basicHtml += `<li class="text-sm">${column}: ${count}</li>`;
            });
            basicHtml += '</ul></div>';
        }

        // Duplicates
        basicHtml += `
            <div class="bg-white p-4 rounded shadow">
                <h5 class="font-medium mb-2">Duplicates</h5>
                <p class="text-sm">Total duplicate rows: ${validation.basic_validation.duplicates.total_duplicates}</p>
            </div>
        `;

        basicHtml += '</div>';
        document.getElementById('basic-validation-results').innerHTML = basicHtml;

        // Get LLM recommendations for basic validation
        getLLMRecommendation('basic_validation', validation.basic_validation)
            .then(recommendation => {
                const recDiv = document.getElementById('basic-validation-recommendation');
                recDiv.textContent = recommendation;
                recDiv.classList.remove('hidden');
            });

        // Display quality scores
        const qualityScores = validation.advanced_validation.quality_scores;
        document.getElementById('overall-quality-score').textContent = qualityScores.overall_score;
        document.getElementById('overall-quality-grade').textContent = `Grade ${qualityScores.overall_grade}`;
        
        let columnScoresHtml = '<div class="space-y-2">';
        Object.entries(qualityScores.column_scores).forEach(([col, data]) => {
            columnScoresHtml += `
                <div class="flex justify-between items-center">
                    <span class="text-sm font-medium">${col}</span>
                    <span class="text-sm">
                        ${data.score} (Grade ${data.grade})
                    </span>
                </div>
            `;
        });
        columnScoresHtml += '</div>';
        document.getElementById('column-quality-scores').innerHTML = columnScoresHtml;

        // Get LLM recommendations for quality scores
        getLLMRecommendation('quality_scores', qualityScores)
            .then(recommendation => {
                const recDiv = document.getElementById('quality-recommendation');
                recDiv.textContent = recommendation;
                recDiv.classList.remove('hidden');
            });

        // Display outliers
        let outliersHtml = '<div class="space-y-2">';
        Object.entries(validation.advanced_validation.outliers).forEach(([col, data]) => {
            outliersHtml += `
                <div class="flex justify-between items-center">
                    <span class="text-sm font-medium">${col}</span>
                    <span class="text-sm">
                        Z-score: ${data.z_score_outliers}, 
                        IQR: ${data.iqr_outliers}
                    </span>
                </div>
            `;
        });
        outliersHtml += '</div>';
        document.getElementById('outlier-results').innerHTML = outliersHtml;

        // Get LLM recommendations for outliers
        getLLMRecommendation('outliers', validation.advanced_validation.outliers)
            .then(recommendation => {
                const recDiv = document.getElementById('outlier-recommendation');
                recDiv.textContent = recommendation;
                recDiv.classList.remove('hidden');
            });

        // Display distributions
        let distributionHtml = '<div class="space-y-4">';
        Object.entries(validation.advanced_validation.distribution_analysis).forEach(([col, stats]) => {
            distributionHtml += `
                <div class="border-b pb-2">
                    <h5 class="font-medium mb-2">${col}</h5>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>Mean: ${stats.mean.toFixed(2)}</div>
                        <div>Median: ${stats.median.toFixed(2)}</div>
                        <div>Std: ${stats.std.toFixed(2)}</div>
                        <div>Skewness: ${stats.skewness.toFixed(2)}</div>
                        <div>Kurtosis: ${stats.kurtosis.toFixed(2)}</div>
                    </div>
                    ${renderNormalityTests(stats.normality_tests)}
                </div>
            `;
        });
        distributionHtml += '</div>';
        document.getElementById('distribution-results').innerHTML = distributionHtml;

        // Get LLM recommendations for distributions
        getLLMRecommendation('distributions', validation.advanced_validation.distribution_analysis)
            .then(recommendation => {
                const recDiv = document.getElementById('distribution-recommendation');
                recDiv.textContent = recommendation;
                recDiv.classList.remove('hidden');
            });

        // Display multicollinearity
        let multicollinearityHtml = '<div class="space-y-2">';
        const multicollinearity = validation.advanced_validation.multicollinearity;
        if (multicollinearity.high_correlations.length > 0) {
            multicollinearityHtml += `
                <div class="text-sm mb-2">
                    Features with correlation > ${multicollinearity.threshold}:
                </div>
                ${multicollinearity.high_correlations.map(corr => `
                    <div class="flex justify-between items-center">
                        <span class="text-sm">
                            ${corr.feature1} ↔ ${corr.feature2}
                        </span>
                        <span class="text-sm font-medium">
                            ${corr.correlation.toFixed(3)}
                        </span>
                    </div>
                `).join('')}
            `;
        } else {
            multicollinearityHtml += `
                <div class="text-sm text-gray-500">
                    No high correlations found
                </div>
            `;
        }
        multicollinearityHtml += '</div>';
        document.getElementById('multicollinearity-results').innerHTML = multicollinearityHtml;

        // Get LLM recommendations for multicollinearity
        getLLMRecommendation('multicollinearity', multicollinearity)
            .then(recommendation => {
                const recDiv = document.getElementById('multicollinearity-recommendation');
                recDiv.textContent = recommendation;
                recDiv.classList.remove('hidden');
            });
    }

    async function getLLMRecommendation(section, data) {
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    section: section,
                    data: data
                })
            });
            
            const result = await response.json();
            if (result.success) {
                return result.response;
            } else {
                console.error('Error getting recommendation:', result.error);
                return null;
            }
        } catch (error) {
            console.error('Error calling LLM API:', error);
            return null;
        }
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
