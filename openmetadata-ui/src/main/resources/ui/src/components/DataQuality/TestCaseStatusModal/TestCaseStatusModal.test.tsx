/*
 *  Copyright 2023 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TestCaseFailureReasonType } from '../../../generated/tests/resolved';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../generated/tests/testCaseResolutionStatus';
import { transitionIncident } from '../../../rest/incidentManagerAPI';
import { TaskResolutionType } from '../../../rest/tasksAPI';
import { TestCaseStatusModal } from './TestCaseStatusModal.component';
import { TestCaseStatusModalProps } from './TestCaseStatusModal.interface';

const mockProps: TestCaseStatusModalProps = {
  open: true,
  testCaseFqn: 'test',
  onCancel: jest.fn(),
  onSubmit: jest.fn().mockImplementation(() => Promise.resolve()),
};

// An incident whose status the user has not picked yet.
const NO_STATUS_INCIDENT = {
  stateId: 'test-state-id',
} as TestCaseResolutionStatus;

const mockAssignee = {
  id: 'user-1',
  type: 'user',
  name: 'aaron',
  displayName: 'Aaron',
};

jest.mock('../../../components/common/RichTextEditor/RichTextEditor', () =>
  jest
    .fn()
    .mockImplementation(
      ({ onTextChange }: { onTextChange: (value: string) => void }) => (
        <textarea
          aria-label="RichTextEditor"
          onChange={(e) => onTextChange(e.target.value)}
        />
      )
    )
);

jest.mock('../../../pages/TasksPage/shared/Assignees', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        value,
        onChange,
      }: {
        value: { value: string }[];
        onChange: (values: unknown[]) => void;
      }) => (
        <div data-testid="select-assignee">
          {value.map((option) => option.value).join(',')}
          <button
            onClick={() =>
              onChange([
                {
                  label: 'Bob',
                  value: 'user-2',
                  type: 'user',
                  name: 'bob',
                  displayName: 'Bob',
                },
              ])
            }>
            pick-bob
          </button>
        </div>
      )
    )
);

jest.mock('../../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({ data: [] }),
}));

const mockLatestIncident = {
  id: 'latest-incident-id',
  testCaseResolutionStatusType: 'New',
};

jest.mock('../../../rest/incidentManagerAPI', () => ({
  transitionIncident: jest.fn().mockResolvedValue({}),
  getListTestCaseIncidentByStateId: jest.fn().mockResolvedValue({
    data: [{ id: 'latest-incident-id', testCaseResolutionStatusType: 'New' }],
  }),
}));

const press = (element: HTMLElement) => {
  fireEvent.pointerDown(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.pointerUp(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.click(element);
};

const pickOption = async (selectLabel: RegExp, optionName: string) => {
  await act(async () => {
    press(screen.getByRole('button', { name: selectLabel }));
  });
  await act(async () => {
    press(screen.getByRole('option', { name: optionName }));
  });
};

const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByText('label.save'));
  });
};

describe('TestCaseStatusModal component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('component should render', async () => {
    render(<TestCaseStatusModal {...mockProps} />);

    expect(await screen.findByTestId('update-status-form')).toBeInTheDocument();
    expect(
      screen.getByTestId('test-case-resolution-status-type')
    ).toBeInTheDocument();
    expect(screen.getByText('label.cancel')).toBeInTheDocument();
    expect(screen.getByText('label.save').closest('button')).toHaveAttribute(
      'id',
      'update-status-button'
    );
  });

  it('should render test case reason and comment field, if status is resolved', async () => {
    render(
      <TestCaseStatusModal
        {...mockProps}
        data={{
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
        }}
      />
    );

    expect(
      await screen.findByTestId('test-case-failure-reason')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('RichTextEditor')).toBeInTheDocument();
  });

  it('should call onCancel function, on click of cancel button', async () => {
    render(
      <TestCaseStatusModal
        {...mockProps}
        data={{
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
        }}
      />
    );
    const cancelBtn = await screen.findByText('label.cancel');
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('should call onSubmit function, on click of save button', async () => {
    render(<TestCaseStatusModal {...mockProps} data={NO_STATUS_INCIDENT} />);

    await pickOption(/label.status/, 'label.new');
    await submit();

    expect(transitionIncident).toHaveBeenCalledWith('test-state-id', {
      transitionId: 'new',
    });
    expect(mockProps.onSubmit).toHaveBeenCalledWith(mockLatestIncident);
  });

  it('should require a status before submitting', async () => {
    render(<TestCaseStatusModal {...mockProps} data={NO_STATUS_INCIDENT} />);

    await submit();

    expect(
      await screen.findByText('message.field-text-is-required')
    ).toBeInTheDocument();
    expect(transitionIncident).not.toHaveBeenCalled();
  });

  it('should only offer Assigned and Resolved when the incident is Assigned', async () => {
    render(
      <TestCaseStatusModal
        {...mockProps}
        data={{
          stateId: 'test-state-id',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
        }}
      />
    );

    await act(async () => {
      press(screen.getByRole('button', { name: /label.status/ }));
    });

    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(['label.assigned', 'label.resolved']);
  });

  it('should require reason and comment to resolve, then send them', async () => {
    render(<TestCaseStatusModal {...mockProps} data={NO_STATUS_INCIDENT} />);

    await pickOption(/label.status/, 'label.resolved');
    await submit();

    expect(
      await screen.findAllByText('message.field-text-is-required')
    ).toHaveLength(2);
    expect(transitionIncident).not.toHaveBeenCalled();

    await pickOption(/label.reason/, 'Missing Data');
    fireEvent.change(screen.getByLabelText('RichTextEditor'), {
      target: { value: 'Backfill pending' },
    });
    await submit();

    expect(transitionIncident).toHaveBeenCalledWith('test-state-id', {
      transitionId: 'resolve',
      resolutionType: TaskResolutionType.Completed,
      comment: 'Backfill pending',
      payload: {
        testCaseFailureReason: TestCaseFailureReasonType.MissingData,
      },
    });
  });

  it('should prefill the current assignee and reassign to the picked one', async () => {
    render(
      <TestCaseStatusModal
        {...mockProps}
        data={{
          stateId: 'test-state-id',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
          testCaseResolutionStatusDetails: { assignee: mockAssignee },
        }}
      />
    );

    expect(await screen.findByTestId('select-assignee')).toHaveTextContent(
      'user-1'
    );

    await act(async () => {
      fireEvent.click(screen.getByText('pick-bob'));
    });
    await submit();

    expect(transitionIncident).toHaveBeenCalledWith('test-state-id', {
      transitionId: 'reassign',
      payload: {
        assignees: [
          {
            id: 'user-2',
            type: 'user',
            name: 'bob',
            fullyQualifiedName: 'bob',
            displayName: 'Bob',
          },
        ],
      },
    });
  });
});
