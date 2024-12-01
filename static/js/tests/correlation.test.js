/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

const mockDestroy = jest.fn();
const mockChart = jest.fn().mockImplementation(() => ({
    destroy: mockDestroy
}));

// Use doMock instead of jest.mock
jest.doMock('chart.js/auto', () => ({
    __esModule: true,
    default: mockChart
}));

// Import after mocking
const { renderCorrelationMatrix, renderCorrelationTable } = require('../correlation.js');

describe('Correlation', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <canvas id="correlation-matrix"></canvas>
            <table id="correlation-table"></table>
        `;
        // Reset mock calls
        mockChart.mockClear();
        mockDestroy.mockClear();
    });

    describe('renderCorrelationMatrix', () => {
        test('creates correlation heatmap chart', () => {
            const correlationData = {
                'col1': {
                    'col1': 1.0,
                    'col2': 0.5
                },
                'col2': {
                    'col1': 0.5,
                    'col2': 1.0
                }
            };
            
            renderCorrelationMatrix(correlationData);
            
            // Check if Chart was instantiated
            expect(mockChart).toHaveBeenCalledTimes(1);
            expect(mockChart).toHaveBeenCalledWith(
                expect.any(HTMLCanvasElement),
                expect.objectContaining({
                    type: 'heatmap',
                    data: expect.any(Object),
                    options: expect.any(Object)
                })
            );
        });

        test('destroys existing chart before creating new one', () => {
            // Create initial chart
            window.correlationChart = {
                destroy: mockDestroy
            };

            const correlationData = {
                'col1': {
                    'col1': 1.0,
                    'col2': 0.5
                },
                'col2': {
                    'col1': 0.5,
                    'col2': 1.0
                }
            };
            
            renderCorrelationMatrix(correlationData);
            
            // Check if existing chart was destroyed
            expect(mockDestroy).toHaveBeenCalled();
            expect(mockChart).toHaveBeenCalledTimes(1);
        });
    });

    describe('renderCorrelationTable', () => {
        test('creates correlation table with correct values', () => {
            const correlationData = {
                'col1': {
                    'col1': 1.0,
                    'col2': 0.5
                },
                'col2': {
                    'col1': 0.5,
                    'col2': 1.0
                }
            };
            
            renderCorrelationTable(correlationData);
            
            const table = document.querySelector('#correlation-table table');
            expect(table).not.toBeNull();
            
            // Check table headers
            const headers = table.querySelectorAll('th');
            expect(headers[1].textContent).toBe('col1');
            expect(headers[2].textContent).toBe('col2');
            
            // Check table values
            const cells = table.querySelectorAll('td');
            expect(cells[0].textContent).toBe('col1');
            expect(cells[1].textContent).toBe('1.00');
            expect(cells[2].textContent).toBe('0.50');
            expect(cells[3].textContent).toBe('col2');
            expect(cells[4].textContent).toBe('0.50');
            expect(cells[5].textContent).toBe('1.00');
        });

        test('handles empty correlation data', () => {
            const correlationData = {};
            
            renderCorrelationTable(correlationData);
            
            const table = document.querySelector('#correlation-table table');
            expect(table).not.toBeNull();
            expect(table.querySelectorAll('th').length).toBe(1); // Just the corner header
            expect(table.querySelectorAll('td').length).toBe(0);
        });
    });
});
