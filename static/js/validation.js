// Data validation functionality
import { renderCorrelationMatrix } from './correlation.js';
import { showToast } from './utils.js';

export function updateProgress(progress, status) {
    const progressBar = document.querySelector('#progress-section .progress-bar');
    const statusText = document.getElementById('status-text');
    
    if (progressBar && statusText) {
        progressBar.style.width = `${progress}%`;
        statusText.textContent = status;
    }
}

export function showResults(results) {
    console.log('Showing results:', results);
    
    // Show results section
    const resultsSection = document.getElementById('results-section');
    if (resultsSection) {
        resultsSection.classList.remove('hidden');
    }
    
    // Update basic validation results
    const basicResults = document.getElementById('basic-validation-results-content');
    if (basicResults && results.basic_validation) {
        basicResults.innerHTML = generateBasicValidationHTML(results.basic_validation);
        
        // Show recommendation if needed
        const recommendation = document.getElementById('basic-validation-recommendation');
        if (recommendation && results.basic_validation.recommendation) {
            recommendation.innerHTML = results.basic_validation.recommendation;
            recommendation.classList.remove('hidden');
        }
    }
    
    // Update advanced validation results (excluding multicollinearity)
    const advancedResults = document.getElementById('advanced-validation-results');
    if (advancedResults && results.advanced_validation) {
        const { multicollinearity, ...otherAdvancedResults } = results.advanced_validation;
        advancedResults.innerHTML = generateAdvancedValidationHTML(otherAdvancedResults);
    }
    
    // Initialize correlation tab first if correlation data exists
    if (results.correlation_analysis || (results.advanced_validation && results.advanced_validation.multicollinearity)) {
        const correlationTab = document.getElementById('correlation-tab');
        const correlationTabBtn = document.getElementById('correlation-tab-btn');
        
        if (correlationTab && correlationTabBtn) {
            correlationTab.classList.remove('hidden');
            // Make sure the correlation tab exists in the tab structure
            correlationTab.innerHTML = '<div id="correlation-data"></div>';
            
            // Display multicollinearity results
            if (results.advanced_validation?.multicollinearity) {
                const multicollinearityResults = document.createElement('div');
                multicollinearityResults.id = 'multicollinearity-results';
                correlationTab.appendChild(multicollinearityResults);
                
                multicollinearityResults.innerHTML = generateMulticollinearityHTML(results.advanced_validation.multicollinearity);
                
                // Update threshold input if it exists
                const thresholdInput = document.getElementById('correlation-threshold');
                if (thresholdInput && results.advanced_validation.multicollinearity.threshold) {
                    thresholdInput.value = results.advanced_validation.multicollinearity.threshold;
                }
                
                // Show recommendations if available
                const recommendationDiv = document.getElementById('multicollinearity-recommendation');
                if (recommendationDiv && results.advanced_validation.multicollinearity.recommendation) {
                    recommendationDiv.innerHTML = results.advanced_validation.multicollinearity.recommendation;
                    recommendationDiv.classList.remove('hidden');
                }
            }
            
            // Display correlation analysis results using the dedicated function
            if (results.correlation_analysis) {
                const correlationData = document.getElementById('correlation-data');
                if (correlationData) {
                    renderCorrelationMatrix(results.correlation_analysis);
                }
            }
            
            // Hide the correlation tab initially if we're not on it
            if (!correlationTabBtn.classList.contains('active')) {
                correlationTab.classList.add('hidden');
            }
        }
    }
    
    // Show export section
    const exportSection = document.getElementById('export-section');
    if (exportSection) {
        exportSection.classList.remove('hidden');
    }
}

function generateBasicValidationHTML(basicValidation) {
    return `
        <div class="space-y-4">
            ${generateMissingValuesHTML(basicValidation.missing_values)}
            ${generateDataTypesHTML(basicValidation.data_types)}
            ${generateDuplicatesHTML(basicValidation.duplicates)}
            ${generateNegativeValuesHTML(basicValidation.negative_values)}
        </div>
    `;
}

function generateAdvancedValidationHTML(advancedValidation) {
    return `
        <div class="space-y-6">
            ${generateQualityScoresHTML(advancedValidation.quality_scores)}
            ${generateOutliersHTML(advancedValidation.outliers)}
            ${generateDistributionAnalysisHTML(advancedValidation.distribution_analysis)}
        </div>
    `;
}

function generateMissingValuesHTML(missingValues) {
    if (!missingValues) return '';
    
    const columns = Object.entries(missingValues.total_missing)
        .map(([col, count]) => ({
            name: col,
            count: count,
            percentage: missingValues.missing_percentages[col].toFixed(2)
        }))
        .filter(col => col.count > 0);
    
    return `
        <div class="bg-white p-4 rounded-lg shadow">
            <div class="flex items-center space-x-2 mb-4">
                <h4 class="font-medium text-gray-900">Missing Values</h4>
                <div class="relative group">
                    <svg class="w-5 h-5 text-gray-400 hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="hidden group-hover:block absolute z-10 w-72 px-4 py-3 text-sm bg-gray-900 text-white rounded-lg shadow-lg ml-2">
                        Missing values analysis identifies columns with incomplete data. High percentages of missing values may indicate data quality issues or collection problems that need attention.
                    </div>
                </div>
            </div>
            ${columns.length > 0 ? `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Column</th>
                                <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">Count</th>
                                <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${columns.map(col => `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${col.name}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900 text-right">${col.count}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900 text-right">${col.percentage}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-sm text-gray-500">No missing values found</p>'}
        </div>
    `;
}

function generateDataTypesHTML(dataTypes) {
    if (!dataTypes) return '';
    
    const columns = Object.entries(dataTypes)
        .map(([col, type]) => ({
            name: col,
            type: type
        }));
    
    return `
        <div class="bg-white p-4 rounded-lg shadow">
            <div class="flex items-center space-x-2 mb-4">
                <h4 class="font-medium text-gray-900">Data Types</h4>
                <div class="relative group">
                    <svg class="w-5 h-5 text-gray-400 hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="hidden group-hover:block absolute z-10 w-72 px-4 py-3 text-sm bg-gray-900 text-white rounded-lg shadow-lg ml-2">
                        Data type analysis ensures each column contains the appropriate type of data (numeric, categorical, etc.). Mismatched data types can lead to processing errors and incorrect analysis.
                    </div>
                </div>
            </div>
            ${columns.length > 0 ? `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Column</th>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${columns.map(col => `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${col.name}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900">${col.type}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-sm text-gray-500">No data types found</p>'}
        </div>
    `;
}

function generateDuplicatesHTML(duplicates) {
    if (!duplicates) return '';
    
    const columns = Object.entries(duplicates)
        .map(([col, count]) => ({
            name: col,
            count: count
        }))
        .filter(col => col.count > 0);
    
    return `
        <div class="bg-white p-4 rounded-lg shadow">
            <div class="flex items-center space-x-2 mb-4">
                <h4 class="font-medium text-gray-900">Duplicate Records</h4>
                <div class="relative group">
                    <svg class="w-5 h-5 text-gray-400 hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="hidden group-hover:block absolute z-10 w-72 px-4 py-3 text-sm bg-gray-900 text-white rounded-lg shadow-lg ml-2">
                        Duplicate records can skew analysis results and waste storage. This check identifies identical rows that might need to be removed or investigated.
                    </div>
                </div>
            </div>
            ${columns.length > 0 ? `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Column</th>
                                <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${columns.map(col => `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${col.name}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900 text-right">${col.count}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-sm text-gray-500">No duplicates found</p>'}
        </div>
    `;
}

function generateNegativeValuesHTML(negativeValues) {
    if (!negativeValues) return '';
    
    const columns = Object.entries(negativeValues)
        .map(([col, count]) => ({
            name: col,
            count: count
        }))
        .filter(col => col.count > 0);
    
    return `
        <div class="bg-white p-4 rounded-lg shadow">
            <div class="flex items-center space-x-2 mb-4">
                <h4 class="font-medium text-gray-900">Negative Values</h4>
                <div class="relative group">
                    <svg class="w-5 h-5 text-gray-400 hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="hidden group-hover:block absolute z-10 w-72 px-4 py-3 text-sm bg-gray-900 text-white rounded-lg shadow-lg ml-2">
                        Some features should never contain negative values (e.g., age, price). This check identifies columns with unexpected negative values that might indicate data errors.
                    </div>
                </div>
            </div>
            ${columns.length > 0 ? `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Column</th>
                                <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${columns.map(col => `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${col.name}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900 text-right">${col.count}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-sm text-gray-500">No negative values found</p>'}
        </div>
    `;
}

function generateQualityScoresHTML(qualityScores) {
    if (!qualityScores) return '';
    
    // Helper function to get color class based on score
    const getScoreColorClass = (score) => {
        if (score >= 90) return 'text-green-600';
        if (score >= 80) return 'text-blue-600';
        if (score >= 70) return 'text-yellow-600';
        return 'text-red-600';
    };

    // Helper function to get grade color class
    const getGradeColorClass = (grade) => {
        const gradeColors = {
            'A': 'text-green-600',
            'B': 'text-blue-600',
            'C': 'text-yellow-600',
            'D': 'text-orange-600',
            'F': 'text-red-600'
        };
        return gradeColors[grade] || 'text-gray-600';
    };

    // Parse column scores if they're in string format
    let columnScores = {};
    if (qualityScores.column_scores) {
        try {
            columnScores = typeof qualityScores.column_scores === 'string' 
                ? JSON.parse(qualityScores.column_scores) 
                : qualityScores.column_scores;
        } catch (e) {
            console.error('Error parsing column scores:', e);
            // If parsing fails, try to use the raw scores
            columnScores = qualityScores.column_scores;
        }
    }

    return `
        <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center space-x-2">
                    <h4 class="font-medium text-gray-900">Data Quality Scores</h4>
                    <div class="relative group">
                        <svg class="w-5 h-5 text-gray-400 hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div class="hidden group-hover:block absolute z-10 w-72 px-4 py-3 text-sm bg-gray-900 text-white rounded-lg shadow-lg ml-2">
                            Quality scores provide an overall assessment of data quality based on completeness, consistency, and validity of values in each column.
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="text-center">
                        <div class="text-sm text-gray-500 mb-1">Overall Score</div>
                        <div class="text-2xl font-bold ${getScoreColorClass(qualityScores.overall_score)}">
                            ${Number(qualityScores.overall_score).toFixed(1)}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-sm text-gray-500 mb-1">Grade</div>
                        <div class="text-2xl font-bold ${getGradeColorClass(qualityScores.overall_grade)}">
                            ${qualityScores.overall_grade}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Column</th>
                            <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">Score</th>
                            <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Grade</th>
                            <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Quality Level</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${Object.entries(columnScores).map(([column, info]) => {
                            const score = typeof info === 'object' ? info.score : info;
                            const grade = typeof info === 'object' ? info.grade : 
                                        score >= 90 ? 'A' :
                                        score >= 80 ? 'B' :
                                        score >= 70 ? 'C' :
                                        score >= 60 ? 'D' : 'F';
                            return `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${column}</td>
                                    <td class="px-4 py-2 text-sm font-medium ${getScoreColorClass(score)} text-right">
                                        ${typeof score === 'number' ? score.toFixed(1) : score}
                                    </td>
                                    <td class="px-4 py-2 text-sm font-medium ${getGradeColorClass(grade)}">
                                        ${grade}
                                    </td>
                                    <td class="px-4 py-2 text-sm text-gray-500">
                                        ${score >= 90 ? 'Excellent' :
                                          score >= 80 ? 'Good' :
                                          score >= 70 ? 'Fair' :
                                          'Needs Improvement'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
}

function generateOutliersHTML(outliers) {
    if (!outliers) return '';
    
    const columns = Object.entries(outliers)
        .map(([col, count]) => ({
            name: col,
            count: count
        }))
        .filter(col => col.count > 0);
    
    return `
        <div class="bg-white p-4 rounded-lg shadow">
            <div class="flex items-center space-x-2 mb-4">
                <h4 class="font-medium text-gray-900">Outliers Detection</h4>
                <div class="relative group">
                    <svg class="w-5 h-5 text-gray-400 hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="hidden group-hover:block absolute z-10 w-72 px-4 py-3 text-sm bg-gray-900 text-white rounded-lg shadow-lg ml-2">
                        Outliers are values that deviate significantly from the normal range. While some outliers may be valid, they could also indicate data errors or interesting anomalies.
                    </div>
                </div>
            </div>
            ${columns.length > 0 ? `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Column</th>
                                <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${columns.map(col => `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${col.name}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900 text-right">${col.count}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-sm text-gray-500">No outliers found</p>'}
        </div>
    `;
}

function generateDistributionAnalysisHTML(distributionAnalysis) {
    if (!distributionAnalysis) return '';
    
    const columns = Object.entries(distributionAnalysis)
        .map(([col, analysis]) => ({
            name: col,
            analysis: formatDistributionAnalysis(analysis)
        }));
    
    return `
        <div class="bg-white p-4 rounded-lg shadow">
            <div class="flex items-center space-x-2 mb-4">
                <h4 class="font-medium text-gray-900">Distribution Analysis</h4>
                <div class="relative group">
                    <svg class="w-5 h-5 text-gray-400 hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="hidden group-hover:block absolute z-10 w-72 px-4 py-3 text-sm bg-gray-900 text-white rounded-lg shadow-lg ml-2">
                        Distribution analysis examines how values are spread across each column, helping identify potential biases, skewness, or unusual patterns in the data.
                    </div>
                </div>
            </div>
            ${columns.length > 0 ? `
                <div class="grid gap-4 md:grid-cols-2">
                    ${columns.map(col => `
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <h5 class="font-medium text-gray-900 mb-2">${col.name}</h5>
                            <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">${col.analysis}</div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-sm text-gray-500">No distribution analysis found</p>'}
        </div>
    `;
}

function formatDistributionAnalysis(analysis) {
    if (typeof analysis !== 'object') return analysis;
    
    let result = [];
    
    // Basic statistics
    if ('mean' in analysis) result.push(`📊 Mean: ${analysis.mean.toFixed(2)}`);
    if ('median' in analysis) result.push(`📊 Median: ${analysis.median.toFixed(2)}`);
    if ('std' in analysis) result.push(`📈 Standard Deviation: ${analysis.std.toFixed(2)}`);
    if ('skewness' in analysis) {
        const skewValue = analysis.skewness;
        const isHighSkew = Math.abs(skewValue) > 1;
        result.push(`📉 Skewness: <span class="${isHighSkew ? 'text-red-600 font-medium' : ''}">${skewValue.toFixed(2)}</span>${isHighSkew ? ' (High skewness detected)' : ''}`);
    }
    if ('kurtosis' in analysis) {
        const kurtValue = analysis.kurtosis;
        const isHighKurt = Math.abs(kurtValue) > 3;
        result.push(`📊 Kurtosis: <span class="${isHighKurt ? 'text-red-600 font-medium' : ''}">${kurtValue.toFixed(2)}</span>${isHighKurt ? ' (Unusual distribution)' : ''}`);
    }
    
    // Normality tests
    if (analysis.normality_tests) {
        if (typeof analysis.normality_tests === 'string') {
            result.push(`\n🔍 Normality Tests: ${analysis.normality_tests}`);
        } else {
            result.push('\n🔍 Normality Tests:');
            
            // Shapiro-Wilk test
            if (analysis.normality_tests.shapiro_wilk) {
                const sw = analysis.normality_tests.shapiro_wilk;
                const isNormal = sw.p_value > 0.05;
                result.push(`  • Shapiro-Wilk Test:`);
                result.push(`    - Statistic: ${sw.statistic.toFixed(3)}`);
                result.push(`    - p-value: <span class="${!isNormal ? 'text-red-600 font-medium' : ''}">${sw.p_value.toFixed(3)}</span>`);
                result.push(`    - Normal Distribution: <span class="${!isNormal ? 'text-red-600 font-medium' : 'text-green-600'}">${isNormal ? 'Yes' : 'No'}</span>`);
            }
            
            // Anderson-Darling test
            if (analysis.normality_tests.anderson_darling) {
                const ad = analysis.normality_tests.anderson_darling;
                result.push(`  • Anderson-Darling Test:`);
                result.push(`    - Statistic: ${ad.statistic.toFixed(3)}`);
                if (ad.critical_values && ad.significance_level) {
                    result.push('    - Critical Values:');
                    ad.critical_values.forEach((val, idx) => {
                        const isCritical = ad.statistic > val;
                        result.push(`      ${ad.significance_level[idx]}%: <span class="${isCritical ? 'text-red-600 font-medium' : ''}">${val.toFixed(3)}</span>`);
                    });
                }
            }
        }
    }
    
    return result.join('\n');
}

function generateMulticollinearityHTML(multicollinearity) {
    if (!multicollinearity) return '';
    
    const { correlation_matrix, high_correlations, threshold } = multicollinearity;
    
    let html = `
        <div class="bg-white p-4 rounded-lg shadow space-y-6">
            <h4 class="font-medium text-gray-900 mb-2">Multicollinearity</h4>`;
    
    // Add threshold information
    if (threshold !== undefined) {
        html += `
            <div>
                <h5 class="text-sm font-medium text-gray-700 mb-2">Correlation Threshold</h5>
                <p class="text-sm text-gray-900">${threshold}</p>
            </div>`;
    }
    
    // Add correlation matrix
    if (correlation_matrix) {
        const matrixRows = Object.entries(correlation_matrix).map(([col1, correlations]) => {
            return `
                <tr>
                    <td class="px-4 py-2 text-sm font-medium text-gray-900">${col1}</td>
                    ${Object.entries(correlations).map(([col2, value]) => `
                        <td class="px-4 py-2 text-sm text-gray-900 text-right">${typeof value === 'number' ? value.toFixed(3) : value}</td>
                    `).join('')}
                </tr>
            `;
        });

        html += `
            <div>
                <h5 class="text-sm font-medium text-gray-700 mb-2">Correlation Matrix</h5>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500"></th>
                                ${Object.keys(correlation_matrix).map(col => `
                                    <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">${col}</th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${matrixRows.join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }
    
    // Add high correlations
    if (high_correlations && high_correlations.length > 0) {
        html += `
            <div>
                <h5 class="text-sm font-medium text-gray-700 mb-2">High Correlations</h5>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Column 1</th>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Column 2</th>
                                <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">Correlation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${high_correlations.map(corr => `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${corr.column1}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900">${corr.column2}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900 text-right">${typeof corr.correlation === 'number' ? corr.correlation.toFixed(3) : corr.correlation}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }
    
    html += `</div>`;
    return html;
}

function generateCorrelationHTML(correlationData) {
    if (!correlationData) return '';
    
    let html = '<div class="space-y-6">';
    
    // Add top 5 correlations section
    if (correlationData.top_correlations && correlationData.top_correlations.length > 0) {
        html += `
            <div class="bg-white p-4 rounded-lg shadow">
                <h4 class="font-medium text-gray-900 mb-4">Top 5 Correlations</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Feature 1</th>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Feature 2</th>
                                <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">Correlation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${correlationData.top_correlations.map(corr => `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${corr.column1}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900">${corr.column2}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900 text-right">
                                        <span class="font-medium ${Math.abs(corr.correlation) > 0.9 ? 'text-red-600' : 'text-gray-900'}">
                                            ${typeof corr.correlation === 'number' ? corr.correlation.toFixed(3) : corr.correlation}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }
    
    // Add high correlations section
    if (correlationData.high_correlations && correlationData.high_correlations.length > 0) {
        html += `
            <div class="bg-white p-4 rounded-lg shadow mt-6">
                <div class="flex items-center justify-between">
                    <h4 class="font-medium text-gray-900">High Correlations</h4>
                    <span class="text-sm text-gray-500">Threshold: ${correlationData.threshold || 0.8}</span>
                </div>
                <div class="overflow-x-auto mt-4">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Feature 1</th>
                                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Feature 2</th>
                                <th class="px-4 py-2 text-right text-sm font-medium text-gray-500">Correlation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${correlationData.high_correlations.map(corr => `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${corr.column1}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900">${corr.column2}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900 text-right">
                                        <span class="font-medium ${Math.abs(corr.correlation) > 0.9 ? 'text-red-600' : 'text-gray-900'}">
                                            ${typeof corr.correlation === 'number' ? corr.correlation.toFixed(3) : corr.correlation}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }
    
    html += '</div>';
    return html;
}

// Section toggle functionality
export function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const arrow = document.getElementById(`${sectionId}-arrow`);
    
    if (content && arrow) {
        // Toggle content visibility
        content.classList.toggle('expanded');
        
        // Rotate arrow
        if (content.classList.contains('expanded')) {
            arrow.style.transform = 'rotate(180deg)';
        } else {
            arrow.style.transform = 'rotate(0deg)';
        }
    }
}

// Initialize all collapsible sections
export function initializeCollapsibleSections() {
    const sections = document.querySelectorAll('[data-section]');
    sections.forEach(section => {
        const header = section.querySelector('[data-section-header]');
        const content = section.querySelector('[data-section-content]');
        
        if (header && content) {
            header.addEventListener('click', () => {
                const sectionId = section.getAttribute('data-section');
                toggleSection(sectionId);
            });
            
            // Initialize section state
            content.style.maxHeight = '0px';
            content.classList.add('overflow-hidden', 'transition-all');
        }
    });
}

// Tab functionality
export function showTab(tabId) {
    // Hide all tab content
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.add('hidden'));
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabId + '-tab');
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
    }
    
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        if (button.id === tabId + '-tab-btn') {
            button.classList.add('active');
            button.classList.add('text-indigo-600', 'border-indigo-600');
            button.classList.remove('text-gray-500', 'border-transparent');
        } else {
            button.classList.remove('active');
            button.classList.remove('text-indigo-600', 'border-indigo-600');
            button.classList.add('text-gray-500', 'border-transparent');
        }
    });
}

// Make showTab available globally
window.showTab = showTab;

// Toggle validation sections
export function toggleValidationSection(sectionId) {
    const content = document.getElementById(sectionId);
    const arrow = document.getElementById(`${sectionId}-arrow`);
    
    if (!content || !arrow) return;

    // Toggle content visibility
    content.classList.toggle('hidden');
    
    // Rotate arrow
    if (content.classList.contains('hidden')) {
        arrow.style.transform = 'rotate(0deg)';
    } else {
        arrow.style.transform = 'rotate(180deg)';
    }
}

// Initialize validation sections
export function initializeValidationSections() {
    const sections = [
        'basic-validation-content',
        'advanced-validation-header',
        'data-quality-content',
        'distribution-content'
    ];

    sections.forEach(sectionId => {
        const content = document.getElementById(sectionId);
        const arrow = document.getElementById(`${sectionId}-arrow`);
        
        if (content && arrow) {
            // Initially show all sections
            content.classList.remove('hidden');
            arrow.style.transform = 'rotate(180deg)';
        }
    });
}

// Update section content and adjust height
export function updateSectionContent(sectionId, content) {
    const contentDiv = document.getElementById(`${sectionId}-results`);
    const sectionContent = document.getElementById(`${sectionId}-content`);
    
    if (contentDiv && sectionContent) {
        contentDiv.innerHTML = content;
        // If section is expanded, update its height
        if (sectionContent.style.maxHeight) {
            sectionContent.style.maxHeight = sectionContent.scrollHeight + "px";
        }
    }
}

// Add to the document ready event listener
document.addEventListener('DOMContentLoaded', () => {
    initializeCollapsibleSections();
});
