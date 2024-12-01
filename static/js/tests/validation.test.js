import { jest } from '@jest/globals';
import {
    updateProgress,
    showResults,
    generateBasicValidationHTML,
    generateAdvancedValidationHTML,
    generateColumnSummaryHTML,
    generateNormalityTestsHTML
} from '../validation.js';

describe('Validation', () => {
    beforeEach(() => {
        // Reset the DOM
        document.body.innerHTML = `
            <div id="progress-section">
                <div class="progress-bar"></div>
                <div id="status-text"></div>
            </div>
            <div id="results-section" class="hidden">
                <div id="basic-validation-results"></div>
                <div id="advanced-validation-results"></div>
            </div>
            <div id="export-section" class="hidden"></div>
        `;
        jest.clearAllMocks();
    });

    describe('updateProgress', () => {
        test('updates progress bar and status text', () => {
            updateProgress(75, 'Processing data...');
            
            const progressBar = document.querySelector('#progress-section .progress-bar');
            const statusText = document.getElementById('status-text');
            
            expect(progressBar.style.width).toBe('75%');
            expect(statusText.textContent).toBe('Processing data...');
        });

        test('handles missing DOM elements gracefully', () => {
            document.body.innerHTML = '';
            expect(() => {
                updateProgress(75, 'Processing data...');
            }).not.toThrow();
        });
    });

    describe('showResults', () => {
        test('displays validation results and shows relevant sections', () => {
            const mockResults = {
                basic_validation: {
                    total_rows: 100,
                    total_columns: 5,
                    missing_values: 10,
                    duplicate_rows: 2,
                    column_summary: {
                        'col1': {
                            dtype: 'numeric',
                            missing_count: 2,
                            unique_count: 50,
                            mean: 10.5,
                            std: 2.3
                        }
                    }
                },
                advanced_validation: {
                    quality_score: 85,
                    completeness: 90,
                    consistency: 88,
                    accuracy: 82,
                    normality_tests: {
                        'col1': {
                            'shapiro': {
                                statistic: 0.95,
                                pvalue: 0.06
                            }
                        }
                    }
                }
            };
            
            showResults(mockResults);
            
            // Check if sections are visible
            expect(document.getElementById('results-section').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('export-section').classList.contains('hidden')).toBe(false);
            
            // Check if basic validation results are rendered
            const basicResults = document.getElementById('basic-validation-results');
            expect(basicResults.innerHTML).toContain('100');
            expect(basicResults.innerHTML).toContain('5');
            expect(basicResults.innerHTML).toContain('10');
            expect(basicResults.innerHTML).toContain('2');
            
            // Check if advanced validation results are rendered
            const advancedResults = document.getElementById('advanced-validation-results');
            expect(advancedResults.innerHTML).toContain('85%');
            expect(advancedResults.innerHTML).toContain('90%');
            expect(advancedResults.innerHTML).toContain('88%');
            expect(advancedResults.innerHTML).toContain('82%');
        });

        test('handles missing DOM elements gracefully', () => {
            document.body.innerHTML = '';
            expect(() => {
                showResults({});
            }).not.toThrow();
        });
    });

    describe('generateBasicValidationHTML', () => {
        test('generates HTML for basic validation results', () => {
            const mockBasicValidation = {
                total_rows: 100,
                total_columns: 5,
                missing_values: 10,
                duplicate_rows: 2,
                column_summary: {
                    'col1': {
                        dtype: 'numeric',
                        missing_count: 2,
                        unique_count: 50,
                        mean: 10.5,
                        std: 2.3
                    }
                }
            };
            
            const html = generateBasicValidationHTML(mockBasicValidation);
            expect(html).toContain('100');
            expect(html).toContain('5');
            expect(html).toContain('10');
            expect(html).toContain('2');
            expect(html).toContain('col1');
            expect(html).toContain('10.50');
            expect(html).toContain('2.30');
        });

        test('handles null input gracefully', () => {
            expect(generateBasicValidationHTML(null)).toBe('');
        });
    });

    describe('generateAdvancedValidationHTML', () => {
        test('generates HTML for advanced validation results', () => {
            const mockAdvancedValidation = {
                quality_score: 85,
                completeness: 90,
                consistency: 88,
                accuracy: 82,
                normality_tests: {
                    'col1': {
                        'shapiro': {
                            statistic: 0.95,
                            pvalue: 0.06
                        }
                    }
                }
            };
            
            const html = generateAdvancedValidationHTML(mockAdvancedValidation);
            expect(html).toContain('85%');
            expect(html).toContain('90%');
            expect(html).toContain('88%');
            expect(html).toContain('82%');
            expect(html).toContain('0.9500');
            expect(html).toContain('0.0600');
            expect(html).toContain('Yes');
        });

        test('handles null input gracefully', () => {
            expect(generateAdvancedValidationHTML(null)).toBe('');
        });
    });
});
