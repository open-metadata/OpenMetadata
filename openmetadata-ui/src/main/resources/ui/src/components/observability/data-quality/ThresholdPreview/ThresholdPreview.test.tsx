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

import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import {
  ProfileSampleType,
  SampleConfigType,
  TableProfilerConfig,
} from '../../../../generated/entity/data/table';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import enUs from '../../../../locale/languages/en-us.json';
import { FormValues } from '../../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.interface';
import ThresholdPreview from './ThresholdPreview';

// Resolve against the real catalog rather than echoing keys back: the point of
// this feature is the wording, so the assertions below read as the sentences a
// user actually sees.
const catalog = enUs as unknown as Record<string, Record<string, string>>;

const mockTranslate = (key: string, options?: Record<string, unknown>) => {
  const [namespace, ...rest] = key.split('.');
  const template = catalog[namespace]?.[rest.join('.')] ?? key;

  return Object.entries(options ?? {}).reduce(
    (result, [name, value]) => result.split(`{{${name}}}`).join(String(value)),
    template
  );
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

// The sentence helpers translate through LocalUtil, the convention for
// non-JSX translation in this codebase.
jest.mock('../../../../utils/i18next/LocalUtil', () => ({
  t: (key: string, options?: Record<string, unknown>) =>
    mockTranslate(key, options),
}));

const thresholdParams = [
  { name: 'threshold' },
  { name: 'thresholdUnit', optionValues: ['ABSOLUTE', 'PERCENTAGE'] },
];

const definitionOf = (
  name: string,
  extraParams: { name: string }[] = []
): TestDefinition =>
  ({
    name,
    parameterDefinition: [...extraParams, ...thresholdParams],
  } as TestDefinition);

const renderPreview = (
  definition: TestDefinition,
  params: Record<string, unknown>,
  target?: string,
  profilerConfig?: TableProfilerConfig
) => {
  const Wrapper = () => {
    const form = useForm<FormValues>({
      defaultValues: { params } as FormValues,
    });

    return (
      <ThresholdPreview
        definition={definition}
        form={form}
        profilerConfig={profilerConfig}
        target={target}
      />
    );
  };

  return render(<Wrapper />);
};

const sentence = () =>
  screen.getByTestId('threshold-preview-sentence').textContent;

describe('ThresholdPreview', () => {
  it('renders nothing for a test without a threshold unit', () => {
    renderPreview(
      {
        name: 'tableDiff',
        parameterDefinition: [{ name: 'threshold' }],
      } as TestDefinition,
      { threshold: 5 }
    );

    expect(screen.queryByTestId('threshold-preview')).not.toBeInTheDocument();
  });

  it('names the non-null denominator for a row-countable percentage', () => {
    renderPreview(
      definitionOf('columnValuesToMatchRegex'),
      { threshold: 1, thresholdUnit: { id: 'PERCENTAGE' } },
      'email'
    );

    expect(sentence()).toBe(
      'Fail when more than 1% of non-null values in email fail this test.'
    );
  });

  it('names every row for a test that evaluates NULLs', () => {
    renderPreview(
      definitionOf('columnValuesToBeNotNull'),
      { threshold: 1, thresholdUnit: { id: 'PERCENTAGE' } },
      'email'
    );

    expect(sentence()).toBe(
      'Fail when more than 1% of rows in email fail this test.'
    );
  });

  it('shows the effective range of a statistical deviation', () => {
    renderPreview(
      definitionOf('columnValueMeanToBeBetween', [
        { name: 'minValueForMeanInCol' },
        { name: 'maxValueForMeanInCol' },
      ]),
      {
        minValueForMeanInCol: 90,
        maxValueForMeanInCol: 110,
        threshold: 5,
        thresholdUnit: { id: 'PERCENTAGE' },
      },
      'amount'
    );

    expect(sentence()).toBe(
      'Fail when the measured value falls outside 90 – 110, allowing a deviation of 5% (effective range 85.5 – 115.5).'
    );
    expect(
      screen.queryByTestId('threshold-zero-bound-warning')
    ).not.toBeInTheDocument();
  });

  it('leaves an absolute statistical deviation unnamed but exact', () => {
    renderPreview(
      definitionOf('tableRowCountToBeBetween', [
        { name: 'minValue' },
        { name: 'maxValue' },
      ]),
      { minValue: 100, maxValue: 200, threshold: 10 }
    );

    expect(sentence()).toBe(
      'Fail when the measured value falls outside 100 – 200, allowing a deviation of 10 (effective range 90 – 210).'
    );
  });

  it('drops the deviation clause when the threshold is zero', () => {
    renderPreview(
      definitionOf('columnValueMeanToBeBetween', [
        { name: 'minValueForMeanInCol' },
      ]),
      { minValueForMeanInCol: 90 }
    );

    expect(sentence()).toBe('Fail when the measured value falls outside ≥ 90.');
  });

  it('warns when a percentage deviation is applied around a bound of zero', () => {
    renderPreview(
      definitionOf('columnValuesMissingCount', [{ name: 'missingCountValue' }]),
      {
        missingCountValue: 0,
        threshold: 5,
        thresholdUnit: { id: 'PERCENTAGE' },
      }
    );

    expect(sentence()).toContain('effective range 0 – 0');
    expect(
      screen.getByTestId('threshold-zero-bound-warning')
    ).toHaveTextContent(
      'A percentage deviation around a bound of 0 leaves that bound at 0'
    );
  });

  it('reads the custom SQL query through its operator and strategy', () => {
    renderPreview(
      definitionOf('tableCustomSQLQuery', [
        { name: 'operator' },
        { name: 'strategy' },
      ]),
      { operator: { id: '<=' }, strategy: { id: 'ROWS' }, threshold: 10 }
    );

    expect(sentence()).toBe('Pass when the query returns at most 10 row(s).');
  });

  it('reads the single number when the custom SQL strategy is COUNT', () => {
    renderPreview(
      definitionOf('tableCustomSQLQuery', [
        { name: 'operator' },
        { name: 'strategy' },
      ]),
      { operator: { id: '>' }, strategy: { id: 'COUNT' }, threshold: 1 }
    );

    expect(sentence()).toBe(
      'Pass when the number the query returns is more than 1.'
    );
  });

  it('says the unit is ignored when custom SQL is given a percentage', () => {
    renderPreview(definitionOf('tableCustomSQLQuery', [{ name: 'operator' }]), {
      operator: { id: '<=' },
      threshold: 10,
      thresholdUnit: { id: 'PERCENTAGE' },
    });

    // The sentence states the raw-count reading that will actually run.
    expect(sentence()).toBe('Pass when the query returns at most 10 row(s).');
    expect(
      screen.getByTestId('threshold-unit-not-enforced-warning')
    ).toHaveTextContent('the threshold unit is not applied');
  });

  it('warns that the in-set threshold needs Match enum, instead of promising one', () => {
    renderPreview(
      definitionOf('columnValuesToBeInSet', [{ name: 'matchEnum' }]),
      { threshold: 10 },
      'status'
    );

    expect(
      screen.queryByTestId('threshold-preview-sentence')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('threshold-match-enum-warning')
    ).toHaveTextContent('only applies the threshold when Match enum is on');
    expect(
      screen.queryByTestId('threshold-not-enforced-warning')
    ).not.toBeInTheDocument();
  });

  it('states the in-set tolerance once Match enum is on', () => {
    renderPreview(
      definitionOf('columnValuesToBeInSet', [{ name: 'matchEnum' }]),
      { threshold: 10, matchEnum: true },
      'status'
    );

    expect(sentence()).toBe(
      'Fail when more than 10 row(s) in status fail this test.'
    );
    expect(
      screen.queryByTestId('threshold-match-enum-warning')
    ).not.toBeInTheDocument();
  });

  it('warns instead of promising a tolerance no validator applies', () => {
    renderPreview(
      definitionOf('columnValuesToBeBetween', [
        { name: 'minValue' },
        { name: 'maxValue' },
      ]),
      { minValue: 1, maxValue: 10, threshold: 5 }
    );

    expect(
      screen.queryByTestId('threshold-preview-sentence')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('threshold-not-enforced-warning')
    ).toHaveTextContent('does not apply a failure threshold yet');
  });

  it('notes a static percentage sample read from the nested profiler config', () => {
    renderPreview(
      definitionOf('columnValuesToBeNotNull'),
      { threshold: 50 },
      'email',
      {
        profileSampleConfig: {
          sampleConfigType: SampleConfigType.Static,
          config: {
            profileSample: 10,
            profileSampleType: ProfileSampleType.Percentage,
          },
        },
      } as TableProfilerConfig
    );

    expect(sentence()).toBe(
      'Fail when more than 50 row(s) in email fail this test.'
    );
    expect(screen.getByTestId('threshold-sampling-warning')).toHaveTextContent(
      'Measured on the 10% sample this table is profiled with.'
    );
  });

  it('notes a static row sample', () => {
    renderPreview(
      definitionOf('columnValuesToBeNotNull'),
      { threshold: 50 },
      'email',
      {
        profileSampleConfig: {
          config: {
            profileSample: 500,
            profileSampleType: ProfileSampleType.Rows,
          },
        },
      } as TableProfilerConfig
    );

    expect(screen.getByTestId('threshold-sampling-warning')).toHaveTextContent(
      'Measured on the 500 row(s) sample this table is profiled with.'
    );
  });

  it('notes a dynamically sized sample without quoting a share', () => {
    renderPreview(
      definitionOf('columnValuesToBeNotNull'),
      { threshold: 50 },
      'email',
      {
        profileSampleConfig: {
          sampleConfigType: SampleConfigType.Dynamic,
          config: {
            thresholds: [{ profileSample: 10, rowCountThreshold: 1000 }],
          },
        },
      } as TableProfilerConfig
    );

    expect(screen.getByTestId('threshold-sampling-warning')).toHaveTextContent(
      'Measured on the dynamically sized sample this table is profiled with.'
    );
  });

  it('omits the sampling note when the table is profiled in full', () => {
    renderPreview(
      definitionOf('columnValuesToBeNotNull'),
      { threshold: 50 },
      'email',
      {} as TableProfilerConfig
    );

    expect(
      screen.queryByTestId('threshold-sampling-warning')
    ).not.toBeInTheDocument();
  });
});
