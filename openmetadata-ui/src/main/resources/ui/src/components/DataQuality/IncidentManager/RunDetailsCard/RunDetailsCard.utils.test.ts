/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import {
  TestCase,
  TestCaseResult,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import {
  formatDifference,
  formatExpectation,
  formatFound,
  formatRunDuration,
  getComparisonBars,
  getFoundValue,
  getRunDetails,
  getRunExpectation,
  getSelectedRun,
  isTimeoutError,
} from './RunDetailsCard.utils';

const testCaseWith = (overrides: Partial<TestCase>) =>
  ({
    name: 'row_count',
    testDefinition: { id: 'def', type: 'testDefinition', name: 'custom' },
    ...overrides,
  } as TestCase);

const resultWith = (overrides: Partial<TestCaseResult>): TestCaseResult => ({
  timestamp: 1,
  testCaseStatus: TestCaseStatus.Success,
  ...overrides,
});

describe('RunDetailsCard utils', () => {
  describe('formatDifference', () => {
    it('signs a shortfall and its percent', () => {
      expect(formatDifference(110, 10000)).toBe('-9,890 (-98.9%)');
    });

    it('signs an excess and its percent', () => {
      expect(formatDifference(10120, 10000)).toBe('+120 (+1.2%)');
    });

    it('shows no sign for a zero difference', () => {
      expect(formatDifference(10000, 10000)).toBe('0 (0.0%)');
    });

    it('drops the percent when the expected value is zero', () => {
      expect(formatDifference(12, 0)).toBe('+12');
    });
  });

  describe('getSelectedRun', () => {
    const runs = [resultWith({ timestamp: 30 }), resultWith({ timestamp: 10 })];

    it('returns the selected run', () => {
      expect(getSelectedRun(runs, 10)?.timestamp).toBe(10);
    });

    it('falls back to the newest run without a selection', () => {
      expect(getSelectedRun(runs)?.timestamp).toBe(30);
    });

    it('falls back to the newest run when the selection left the window', () => {
      expect(getSelectedRun(runs, 99)?.timestamp).toBe(30);
    });
  });

  describe('getRunExpectation', () => {
    it('reads a stated expected value', () => {
      const testCase = testCaseWith({
        parameterValues: [{ name: 'value', value: '10000' }],
      });

      expect(getRunExpectation(testCase, resultWith({}))).toEqual({
        expected: 10000,
      });
    });

    it('uses the value a definition implies', () => {
      const testCase = testCaseWith({
        testDefinition: {
          id: 'def',
          type: 'testDefinition',
          name: 'columnValuesToBeNotNull',
        },
      });

      expect(getRunExpectation(testCase, resultWith({}))).toEqual({
        expected: 0,
      });
    });

    it('reads a range from the parameters', () => {
      const testCase = testCaseWith({
        parameterValues: [
          { name: 'minValue', value: '500' },
          { name: 'maxValue', value: '750' },
        ],
      });

      expect(getRunExpectation(testCase, resultWith({}))).toEqual({
        min: 500,
        max: 750,
      });
    });

    it('reads a learned range from the run', () => {
      const testCase = testCaseWith({ useDynamicAssertion: true });

      expect(
        getRunExpectation(testCase, resultWith({ minBound: 4, maxBound: 9 }))
      ).toEqual({ min: 4, max: 9 });
    });
  });

  it.each([
    [{ expected: 10000 }, '10,000'],
    [{ min: 500, max: 750 }, '500 – 750'],
    [{ max: 750 }, '≤ 750'],
    [{ min: 500 }, '≥ 500'],
    [{}, '—'],
  ])('formats the expectation %o as %s', (expectation, text) => {
    expect(formatExpectation(expectation)).toBe(text);
  });

  describe('found value', () => {
    it('reads a single measured number', () => {
      const result = resultWith({
        testResultValue: [{ name: 'rowCount', value: '110' }],
      });

      expect(getFoundValue(result)).toBe(110);
      expect(formatFound(result)).toBe('110');
    });

    it('has no single number when the run measured several things', () => {
      const result = resultWith({
        testResultValue: [
          { name: 'valuesCount', value: '100' },
          { name: 'uniqueCount', value: '90' },
        ],
      });

      expect(getFoundValue(result)).toBeUndefined();
      expect(formatFound(result)).toBe('valuesCount 100, uniqueCount 90');
    });

    it('shows a dash when nothing numeric was measured', () => {
      expect(formatFound(resultWith({ testResultValue: [] }))).toBe('—');
    });
  });

  describe('getComparisonBars', () => {
    it('draws both values to the larger one', () => {
      expect(getComparisonBars(110, 10000)).toEqual([
        { kind: 'found', value: 110, width: 1.1 },
        { kind: 'expected', value: 10000, width: 100 },
      ]);
    });

    it('draws nothing for a negative value', () => {
      expect(getComparisonBars(-5, 10)).toEqual([]);
    });

    it('draws nothing when both values are zero', () => {
      expect(getComparisonBars(0, 0)).toEqual([]);
    });
  });

  describe('getRunDetails', () => {
    const testCase = testCaseWith({
      parameterValues: [{ name: 'value', value: '10000' }],
    });

    it('compares a completed run with its expectation', () => {
      const details = getRunDetails(
        testCase,
        resultWith({
          testCaseStatus: TestCaseStatus.Failed,
          testResultValue: [{ name: 'rowCount', value: '110' }],
        })
      );

      expect(details).toMatchObject({
        expectedText: '10,000',
        foundText: '110',
        differenceText: '-9,890 (-98.9%)',
      });
      expect(details.bars).toHaveLength(2);
    });

    it.each([TestCaseStatus.Queued, TestCaseStatus.Aborted])(
      'shows dashes and no bar for a %s run',
      (status) => {
        expect(
          getRunDetails(
            testCase,
            resultWith({
              testCaseStatus: status,
              testResultValue: [{ name: 'rowCount', value: '110' }],
            })
          )
        ).toEqual({
          expectedText: '10,000',
          foundText: '—',
          differenceText: '—',
          bars: [],
        });
      }
    );

    it('has no difference or bar without a single found number', () => {
      const details = getRunDetails(
        testCase,
        resultWith({
          testCaseStatus: TestCaseStatus.Failed,
          testResultValue: [
            { name: 'valuesCount', value: '100' },
            { name: 'uniqueCount', value: '90' },
          ],
        })
      );

      expect(details.differenceText).toBe('—');
      expect(details.bars).toEqual([]);
    });
  });

  it.each([
    [0.4, '1ms'],
    [2.31, '2ms'],
    [999.6, '1.0s'],
    [2600, '2.6s'],
    [30000, '30.0s'],
    [95000, '1m 35s'],
  ])('formats a %dms duration as %s', (milliseconds, text) => {
    expect(formatRunDuration(milliseconds)).toBe(text);
  });

  it.each([
    ['TimeoutError', true],
    ['QueryTimedOut', true],
    ['OperationalError', false],
    [undefined, false],
  ])('treats %s as a timeout: %s', (errorType, expected) => {
    expect(isTimeoutError(errorType)).toBe(expected);
  });
});
