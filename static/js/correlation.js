// Correlation matrix visualization
import { showToast } from './utils.js';
import { getUploadedFiles } from './state.js';

let correlationChart = null;

export function renderCorrelationMatrix(correlationData) {
    try {
        const correlationTab = document.getElementById('correlation-tab');
        const correlationDiv = document.getElementById('correlation-data');
        
        if (!correlationTab || !correlationDiv) {
            console.error('Correlation elements not found');
            return;
        }

        // Show the correlation tab
        correlationTab.classList.remove('hidden');

        // Generate HTML for correlation analysis
        let html = '<div class="space-y-6">';
        
        // Add correlation threshold info card
        if (correlationData.threshold) {
            html += `
                <div class="bg-white p-6 rounded-lg shadow-sm">
                    <div class="flex items-center space-x-2">
                        <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <h4 class="font-medium text-gray-900">Correlation Analysis</h4>
                    </div>
                    <p class="mt-2 text-sm text-gray-600">
                        Features with correlation above <span class="font-medium text-blue-600">${correlationData.threshold}</span> are considered highly correlated.
                        High correlation may indicate redundant features or strong relationships between variables.
                    </p>
                </div>`;
        }

        // Add top correlations section
        if (correlationData.top_correlations && correlationData.top_correlations.length > 0) {
            html += `
                <div class="bg-white p-6 rounded-lg shadow-sm">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="font-medium text-gray-900">Top 5 Correlations</h4>
                        <span class="text-sm text-gray-500">${correlationData.top_correlations.length} pairs found</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature 1</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature 2</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Correlation</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${correlationData.top_correlations.map(corr => {
                                    const corrValue = typeof corr.correlation === 'number' ? corr.correlation : parseFloat(corr.correlation);
                                    const isVeryHigh = Math.abs(corrValue) > 0.9;
                                    return `
                                        <tr class="hover:bg-gray-50">
                                            <td class="px-6 py-4 text-sm text-gray-900">${corr.column1}</td>
                                            <td class="px-6 py-4 text-sm text-gray-900">${corr.column2}</td>
                                            <td class="px-6 py-4 text-sm text-right">
                                                <span class="font-medium ${isVeryHigh ? 'text-red-600' : 'text-gray-900'}">
                                                    ${corrValue.toFixed(3)}
                                                </span>
                                                ${isVeryHigh ? `
                                                    <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                        Very High
                                                    </span>
                                                ` : ''}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
        }

        // Add high correlations section
        if (correlationData.high_correlations && correlationData.high_correlations.length > 0) {
            html += `
                <div class="bg-white p-6 rounded-lg shadow-sm mt-6">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="font-medium text-gray-900">High Correlations</h4>
                        <span class="text-sm text-gray-500">${correlationData.high_correlations.length} pairs found</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature 1</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature 2</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Correlation</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${correlationData.high_correlations.map(corr => {
                                    const corrValue = typeof corr.correlation === 'number' ? corr.correlation : parseFloat(corr.correlation);
                                    const isVeryHigh = Math.abs(corrValue) > 0.9;
                                    return `
                                        <tr class="hover:bg-gray-50">
                                            <td class="px-6 py-4 text-sm text-gray-900">${corr.column1}</td>
                                            <td class="px-6 py-4 text-sm text-gray-900">${corr.column2}</td>
                                            <td class="px-6 py-4 text-sm text-right">
                                                <span class="font-medium ${isVeryHigh ? 'text-red-600' : 'text-gray-900'}">
                                                    ${corrValue.toFixed(3)}
                                                </span>
                                                ${isVeryHigh ? `
                                                    <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                        Very High
                                                    </span>
                                                ` : ''}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
        }

        // Add correlation matrix visualization
        if (correlationData.correlation_matrix_path) {
            html += `
                <div class="bg-white p-6 rounded-lg shadow-sm mt-6">
                    <h4 class="font-medium text-gray-900 mb-4">Correlation Matrix Visualization</h4>
                    <div class="overflow-x-auto">
                        <img src="/${correlationData.correlation_matrix_path}" alt="Correlation Matrix" class="w-full">
                    </div>
                </div>`;
        }

        // Add correlation matrix table
        if (correlationData.correlation_matrix) {
            const matrix = correlationData.correlation_matrix;
            const features = Object.keys(matrix);

            html += `
                <div class="bg-white p-6 rounded-lg shadow-sm">
                    <h4 class="font-medium text-gray-900 mb-4">Correlation Matrix</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                                    ${features.map(feature => `
                                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">${feature}</th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${features.map(feature1 => `
                                    <tr class="hover:bg-gray-50">
                                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${feature1}</td>
                                        ${features.map(feature2 => {
                                            const value = matrix[feature1][feature2];
                                            const corrValue = typeof value === 'number' ? value : parseFloat(value);
                                            const isHigh = Math.abs(corrValue) > correlationData.threshold;
                                            const isVeryHigh = Math.abs(corrValue) > 0.9;
                                            const bgColor = feature1 === feature2 ? 'bg-gray-50' : 
                                                          isVeryHigh ? 'bg-red-50' :
                                                          isHigh ? 'bg-yellow-50' : '';
                                            const textColor = feature1 === feature2 ? 'text-gray-400' :
                                                            isVeryHigh ? 'text-red-600' :
                                                            isHigh ? 'text-yellow-700' : 'text-gray-900';
                                            return `
                                                <td class="px-4 py-3 text-sm text-right ${bgColor}">
                                                    <span class="font-medium ${textColor}">
                                                        ${typeof corrValue === 'number' ? corrValue.toFixed(3) : corrValue}
                                                    </span>
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
        }

        html += '</div>';
        correlationDiv.innerHTML = html;

        // Initialize and render correlation chart
        const correlationCanvas = document.getElementById('correlation-canvas');
        if (correlationCanvas) {
            initializeCorrelationChart(correlationCanvas, correlationData.correlation_matrix);
        }

    } catch (error) {
        console.error('Error rendering correlation matrix:', error);
        showToast('Error rendering correlation matrix', 'error');
    }
}

function processData(data) {
    const labels = Object.keys(data);
    const values = labels.map(row => 
        labels.map(col => data[row][col])
    );
    return { labels, values };
}

function initializeCorrelationChart(container, data) {
    if (correlationChart) {
        correlationChart.destroy();
    }

    const ctx = container.getContext('2d');
    const { labels, values } = processData(data);

    correlationChart = new Chart(ctx, {
        type: 'matrix',
        data: {
            labels: labels,
            datasets: [{
                data: values.flat().map((value, i) => ({
                    x: i % labels.length,
                    y: Math.floor(i / labels.length),
                    v: value
                })),
                backgroundColor: generateColors,
                borderWidth: 1,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const item = items[0];
                            return `${labels[item.dataIndex % labels.length]} vs ${labels[Math.floor(item.dataIndex / labels.length)]}`;
                        },
                        label: (item) => {
                            return `Correlation: ${item.raw.v.toFixed(3)}`;
                        }
                    }
                },
                datalabels: {
                    display: true,
                    color: (context) => {
                        const value = context.dataset.data[context.dataIndex].v;
                        return Math.abs(value) > 0.7 ? '#fff' : '#666';
                    },
                    font: {
                        size: 8
                    },
                    formatter: (value) => value.v.toFixed(2)
                }
            },
            scales: {
                x: {
                    type: 'category',
                    offset: true,
                    display: true,
                    ticks: {
                        font: {
                            size: 10
                        },
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: false,
                        color: '#666',
                        padding: 10
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'category',
                    offset: true,
                    display: true,
                    position: 'left',
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#666',
                        padding: 10,
                        mirror: true,
                        labelOffset: -10,
                        align: 'end'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            layout: {
                padding: {
                    left: 100,
                    right: 30,
                    top: 30,
                    bottom: 70
                }
            }
        }
    });
}

function generateColors(context) {
    const value = context.raw;
    const alpha = Math.abs(value);
    return value > 0
        ? `rgba(0, 0, 255, ${alpha})`
        : `rgba(255, 0, 0, ${alpha})`;
}

// Export chart instance and functions for testing
export { correlationChart, processData, generateColors };

export function renderCorrelationTable(correlationData) {
    const container = document.getElementById('correlation-table');
    if (!container) return;
    
    // Extract correlation matrix from the nested structure
    const data = correlationData.correlations || correlationData;
    const labels = Object.keys(data);
    
    // Create table
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th')); // Empty corner cell
    
    labels.forEach(label => {
        const th = document.createElement('th');
        th.className = 'px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = label;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    labels.forEach(rowLabel => {
        const row = document.createElement('tr');
        
        // Add row label as a td instead of th
        const labelCell = document.createElement('td');
        labelCell.className = 'px-2 py-1 text-xs text-gray-500';
        labelCell.textContent = rowLabel;
        row.appendChild(labelCell);
        
        // Add correlation values
        labels.forEach(colLabel => {
            const td = document.createElement('td');
            td.className = 'px-2 py-1 text-xs text-gray-500';
            td.textContent = data[rowLabel][colLabel].toFixed(2);
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
    
    // Display high correlations if available
    if (correlationData.high_correlations) {
        const highCorrelationsContainer = document.getElementById('high-correlations');
        if (highCorrelationsContainer) {
            const highCorrelationsHtml = `
                <div class="mt-4">
                    <h3 class="text-lg font-medium text-gray-900 mb-2">High Correlations</h3>
                    <ul class="space-y-1">
                        ${correlationData.high_correlations.map(([col1, col2, corr]) => 
                            `<li class="text-sm">${col1} ↔ ${col2}: ${corr.toFixed(2)}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
            highCorrelationsContainer.innerHTML = highCorrelationsHtml;
        }
    }
    
    // Display top correlations if available
    if (correlationData.top_correlations) {
        const topCorrelationsContainer = document.getElementById('top-correlations');
        if (topCorrelationsContainer) {
            const topCorrelationsHtml = `
                <div class="mt-4">
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Top Correlations</h3>
                    <ul class="space-y-1">
                        ${correlationData.top_correlations.map(([col1, col2, corr]) => 
                            `<li class="text-sm">${col1} ↔ ${col2}: ${corr.toFixed(2)}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
            topCorrelationsContainer.innerHTML = topCorrelationsHtml;
        }
    }
}

// Handle multi-file analysis
export function initializeMultiFileAnalysis() {
    const analyzeButton = document.getElementById('analyze-multiple-btn');
    if (!analyzeButton) return;
    
    analyzeButton.addEventListener('click', async () => {
        const uploadedFiles = getUploadedFiles();
        if (uploadedFiles.length < 2) {
            showToast('Please upload at least 2 files for cross-file analysis', 'error');
            return;
        }
        
        try {
            analyzeButton.disabled = true;
            const statusSpan = document.getElementById('multi-analysis-status');
            if (statusSpan) {
                statusSpan.textContent = 'Starting analysis...';
            }
            
            // Start analysis
            const response = await fetch('/analyze_multiple', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: uploadedFiles
                })
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Analysis failed');
            }
            
            // Poll for results
            const taskId = data.task_id;
            pollAnalysisResults(taskId);
            
        } catch (error) {
            showToast(error.message || 'Analysis failed', 'error');
            analyzeButton.disabled = false;
            const statusSpan = document.getElementById('multi-analysis-status');
            if (statusSpan) {
                statusSpan.textContent = 'Analysis failed';
            }
        }
    });
}

function pollAnalysisResults(taskId) {
    const statusSpan = document.getElementById('multi-analysis-status');
    const analyzeButton = document.getElementById('analyze-multiple-btn');
    
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/results/${taskId}`);
            const data = await response.json();
            
            if (data.status === 'Complete') {
                clearInterval(pollInterval);
                analyzeButton.disabled = false;
                statusSpan.textContent = 'Analysis complete';
                displayMultiFileResults(data.results);
            } else if (data.status === 'Failed') {
                clearInterval(pollInterval);
                analyzeButton.disabled = false;
                statusSpan.textContent = 'Analysis failed';
                showToast(data.error, 'error');
            } else {
                statusSpan.textContent = `Analysis in progress: ${data.progress}%`;
            }
        } catch (error) {
            clearInterval(pollInterval);
            analyzeButton.disabled = false;
            statusSpan.textContent = 'Analysis failed';
            showToast('Failed to get analysis results', 'error');
        }
    }, 1000);
}

function displayMultiFileResults(results) {
    // Display cross-file correlation matrix
    const crossMatrixDiv = document.getElementById('cross-correlation-matrix');
    const crossMatrixContent = document.getElementById('cross-correlation-heatmap');
    
    if (results.cross_correlation_matrix_path) {
        crossMatrixDiv.classList.remove('hidden');
        crossMatrixContent.innerHTML = `<img src="${results.cross_correlation_matrix_path}" alt="Cross-file Correlation Matrix" class="max-w-full h-auto">`;
    }
    
    // Display similar columns
    const similarColumnsDiv = document.getElementById('similar-columns');
    const similarColumnsContent = document.getElementById('similar-columns-content');
    
    if (results.similar_columns && results.similar_columns.length > 0) {
        similarColumnsDiv.classList.remove('hidden');
        
        const html = results.similar_columns.map(col => `
            <div class="mb-2">
                <span class="font-medium">${col.file1}:${col.column1}</span>
                ↔
                <span class="font-medium">${col.file2}:${col.column2}</span>
                <span class="text-sm text-gray-600">(Similarity: ${(col.similarity * 100).toFixed(1)}%)</span>
            </div>
        `).join('');
        
        similarColumnsContent.innerHTML = html;
    }
    
    // Display cross-file correlations in a table
    if (results.cross_correlations && results.cross_correlations.length > 0) {
        const correlationTable = document.getElementById('correlation-table');
        
        const html = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr>
                        <th class="px-4 py-2">File 1</th>
                        <th class="px-4 py-2">Column 1</th>
                        <th class="px-4 py-2">File 2</th>
                        <th class="px-4 py-2">Column 2</th>
                        <th class="px-4 py-2">Correlation</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.cross_correlations.map(corr => `
                        <tr>
                            <td class="px-4 py-2">${corr.file1}</td>
                            <td class="px-4 py-2">${corr.column1}</td>
                            <td class="px-4 py-2">${corr.file2}</td>
                            <td class="px-4 py-2">${corr.column2}</td>
                            <td class="px-4 py-2">${corr.correlation.toFixed(3)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        correlationTable.innerHTML = html;
    }
}
