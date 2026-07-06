/*
 *  Copyright 2025 Collate.
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
import { HookForm } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../constants/Schedular.constants';
import { BundleSuiteFormData } from './BundleSuiteForm.interface';
import BundleSuiteFormBody from './BundleSuiteFormBody';

jest.mock('../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockReturnValue({
    config: {
      limits: {
        config: {
          featureLimits: [
            {
              name: 'dataQuality',
              pipelineSchedules: [
                { displayName: 'Daily', cron: '0 0 * * *' },
                { displayName: 'Weekly', cron: '0 0 * * 0' },
              ],
            },
          ],
        },
      },
    },
  }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: {
      ingestionPipeline: {
        Create: true,
      },
    },
  }),
}));

jest.mock('../../Settings/Services/AddIngestion/Steps/ScheduleIntervalV1', () =>
  jest.fn().mockImplementation(({ onChange }) => (
    <div data-testid="schedule-interval-v1">
      <button
        data-testid="schedule-change-btn"
        onClick={() => onChange?.('0 0 * * *')}>
        change
      </button>
    </div>
  ))
);

jest.mock('../AddTestCaseList/AddTestCaseList.component', () => ({
  AddTestCaseList: jest
    .fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation(({ onChange, selectedTest }: any) => (
      <div data-testid="add-test-case-list">
        <span data-testid="selected-count">{selectedTest?.length ?? 0}</span>
        <button
          data-testid="select-cases-btn"
          onClick={() =>
            onChange?.({
              selectAll: false,
              includeIds: ['tc-1'],
              excludeIds: [],
              testCases: [{ id: 'tc-1', name: 'tc_1' }],
            })
          }>
          select
        </button>
        <button
          data-testid="clear-cases-btn"
          onClick={() =>
            onChange?.({
              selectAll: false,
              includeIds: [],
              excludeIds: [],
              testCases: [],
            })
          }>
          clear
        </button>
      </div>
    )),
}));

let formRef: UseFormReturn<BundleSuiteFormData> | undefined;

const renderBody = (
  props: Partial<Parameters<typeof BundleSuiteFormBody>[0]> = {}
) => {
  const Wrapper = () => {
    const form = useForm<BundleSuiteFormData>({
      defaultValues: {
        enableScheduler: false,
        raiseOnError: true,
        cron: DEFAULT_SCHEDULE_CRON_DAILY,
      },
    });
    formRef = form;

    return (
      <HookForm form={form} onSubmit={jest.fn()}>
        <BundleSuiteFormBody form={form} {...props} />
      </HookForm>
    );
  };

  return render(<Wrapper />);
};

describe('BundleSuiteFormBody', () => {
  beforeEach(() => {
    formRef = undefined;
  });

  it('renders the name field', async () => {
    await act(async () => {
      renderBody();
    });

    expect(screen.getByTestId('test-suite-name')).toBeInTheDocument();
  });

  it('renders the description field', async () => {
    await act(async () => {
      renderBody();
    });

    expect(screen.getByTestId('test-suite-description')).toBeInTheDocument();
  });

  it('renders AddTestCaseList', async () => {
    await act(async () => {
      renderBody();
    });

    expect(screen.getByTestId('add-test-case-list')).toBeInTheDocument();
  });

  it('shows inline error alert when errorMessage is set', async () => {
    await act(async () => {
      renderBody({ errorMessage: 'Something failed' });
    });

    expect(screen.getByText('Something failed')).toBeInTheDocument();
  });

  it('calls onErrorDismiss when the error alert is closed', async () => {
    const onErrorDismiss = jest.fn();
    await act(async () => {
      renderBody({ errorMessage: 'Some error', onErrorDismiss });
    });

    fireEvent.click(screen.getByTestId('alert-close-button'));

    await waitFor(() => {
      expect(onErrorDismiss).toHaveBeenCalled();
    });
  });

  it('does not render scheduler fields when enableScheduler is false', async () => {
    await act(async () => {
      renderBody();
    });

    expect(screen.queryByTestId('pipeline-name')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('schedule-interval-v1')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('enable-debug-log')).not.toBeInTheDocument();
    expect(screen.queryByTestId('raise-on-error')).not.toBeInTheDocument();
  });

  it('reveals scheduler fields when enableScheduler toggle is turned on', async () => {
    await act(async () => {
      renderBody();
    });

    await act(async () => {
      formRef?.setValue('enableScheduler', true);
    });

    expect(await screen.findByTestId('pipeline-name')).toBeInTheDocument();
    expect(
      await screen.findByTestId('schedule-interval-v1')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('enable-debug-log')).toBeInTheDocument();
    expect(await screen.findByTestId('raise-on-error')).toBeInTheDocument();
  });

  it('hides scheduler fields again when enableScheduler toggle is turned off', async () => {
    await act(async () => {
      renderBody();
    });

    await act(async () => {
      formRef?.setValue('enableScheduler', true);
    });

    expect(await screen.findByTestId('pipeline-name')).toBeInTheDocument();

    await act(async () => {
      formRef?.setValue('enableScheduler', false);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('pipeline-name')).not.toBeInTheDocument();
    });
  });

  it('updates form state when test cases are selected', async () => {
    await act(async () => {
      renderBody();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-cases-btn'));
    });

    await waitFor(() => {
      expect(formRef?.getValues('testCaseSelection')?.includeIds).toEqual([
        'tc-1',
      ]);
    });
  });

  it('rejects empty test case selection on submit with validation error', async () => {
    await act(async () => {
      renderBody();
    });

    // Fill in name so we only get the testCaseSelection error
    await act(async () => {
      formRef?.setValue('name', 'my-suite');
    });

    const onSubmit = jest.fn();
    const onError = jest.fn();

    await act(async () => {
      formRef?.handleSubmit(onSubmit, onError)();
    });

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });

    // onError is called with the field errors object
    const errors = onError.mock.calls[0][0];

    expect(errors?.testCaseSelection).toBeDefined();
  });

  it('allows submit when at least one test case is included', async () => {
    await act(async () => {
      renderBody();
    });

    await act(async () => {
      formRef?.setValue('name', 'my-suite');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-cases-btn'));
    });

    const onSubmit = jest.fn();
    const onError = jest.fn();

    await act(async () => {
      formRef?.handleSubmit(onSubmit, onError)();
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  it('allows submit when selectAll is true even with no includeIds', async () => {
    await act(async () => {
      renderBody();
    });

    await act(async () => {
      formRef?.setValue('name', 'my-suite');
      formRef?.setValue('testCaseSelection', {
        selectAll: true,
        includeIds: [],
        excludeIds: [],
        testCases: [],
      });
    });

    const onSubmit = jest.fn();
    const onError = jest.fn();

    await act(async () => {
      formRef?.handleSubmit(onSubmit, onError)();
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it('seeds selectedTestNames from initialValues.testCases', async () => {
    const initialValues = {
      testCases: [
        { id: 'tc-1', name: 'tc_one' },
        { id: 'tc-2', name: 'tc_two' },
      ] as any,
    };

    await act(async () => {
      renderBody({ initialValues });
    });

    const countEl = screen.getByTestId('selected-count');

    expect(countEl.textContent).toBe('2');
  });

  it('renders the scheduler card only when ingestionPipeline.Create is true', async () => {
    // The mock at the top of this file sets Create: true — scheduler card should be present
    await act(async () => {
      renderBody();
    });

    expect(screen.getByTestId('scheduler-toggle')).toBeInTheDocument();
  });
});
