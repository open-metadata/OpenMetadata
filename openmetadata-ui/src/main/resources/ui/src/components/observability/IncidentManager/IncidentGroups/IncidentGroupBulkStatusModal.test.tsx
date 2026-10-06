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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  Severities as CreateSeverities,
  TestCaseFailureReasonType,
  TestCaseResolutionStatusTypes as CreateStatusTypes,
} from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import IncidentGroupBulkStatusModal from './IncidentGroupBulkStatusModal';
import { BulkIncidentStatus, PendingBulkChange } from './IncidentGroups.types';

const mockOnApply = jest.fn();
const mockOnCancel = jest.fn();
const AARON = {
  id: 'user-a',
  type: 'user',
  name: 'aaron',
  displayName: 'Aaron',
};

jest.mock('../../../Glossary/hooks/useEntityReferenceOptions', () => ({
  useUserTeamOptions: () => ({
    options: [{ id: 'user-a', label: 'Aaron', value: AARON }],
    onFocus: jest.fn(),
    onSearchChange: jest.fn(),
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

const renderChange = (change?: PendingBulkChange) =>
  render(
    <IncidentGroupBulkStatusModal
      change={change}
      incidentCount={12}
      isApplying={false}
      onApply={mockOnApply}
      onCancel={mockOnCancel}
    />
  );

const renderModal = (status?: BulkIncidentStatus) =>
  renderChange(status && { kind: 'status', status });

const apply = async () => {
  await act(async () => {
    press(screen.getByRole('button', { name: 'label.apply' }));
  });
};

describe('IncidentGroupBulkStatusModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should stay closed without a status to apply', () => {
    renderModal();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should not assign without an assignee', async () => {
    renderModal(CreateStatusTypes.Assigned);

    expect(screen.getByText('label.assign-to')).toBeInTheDocument();
    expect(screen.getByText('message.bulk-incident-scope')).toBeInTheDocument();

    await apply();

    expect(mockOnApply).not.toHaveBeenCalled();
    expect(screen.getByText('label.field-required')).toBeInTheDocument();
  });

  it('should not resolve without a reason and a comment', async () => {
    renderModal(CreateStatusTypes.Resolved);

    expect(screen.getByText('label.resolve')).toBeInTheDocument();

    await apply();

    expect(mockOnApply).not.toHaveBeenCalled();
    expect(screen.getAllByText('label.field-required')).toHaveLength(2);
  });

  it('should resolve with the picked reason, the comment and the current user', async () => {
    useApplicationStore.setState({
      currentUser: { id: 'me', name: 'me', email: 'me@example.com' },
    });
    renderModal(CreateStatusTypes.Resolved);

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      press(within(dialog).getAllByRole('button', { name: /label.reason/ })[0]);
    });
    await act(async () => {
      press(screen.getByRole('option', { name: 'label.false-positive' }));
    });
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Expected after the backfill' },
    });
    await apply();

    expect(mockOnApply).toHaveBeenCalledWith({
      testCaseFailureReason: TestCaseFailureReasonType.FalsePositive,
      testCaseFailureComment: 'Expected after the backfill',
      resolvedBy: expect.objectContaining({ id: 'me', type: 'user' }),
    });
  });

  it('should cancel', () => {
    renderModal(CreateStatusTypes.Resolved);

    press(screen.getByRole('button', { name: 'label.cancel' }));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should not resolve with a comment of spaces alone', async () => {
    renderModal(CreateStatusTypes.Resolved);

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      press(within(dialog).getAllByRole('button', { name: /label.reason/ })[0]);
    });
    await act(async () => {
      press(screen.getByRole('option', { name: 'label.false-positive' }));
    });
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: '   ' },
    });
    await apply();

    expect(mockOnApply).not.toHaveBeenCalled();
    expect(screen.getByText('label.field-required')).toBeInTheDocument();
  });

  it('should say how many incidents Apply changes', () => {
    renderModal(CreateStatusTypes.Assigned);

    expect(screen.getByTestId('bulk-status-scope')).toHaveTextContent(
      'message.bulk-incident-scope'
    );
  });

  it('should open empty again after a change was applied', async () => {
    const { rerender } = renderModal(CreateStatusTypes.Resolved);
    fireEvent.change(within(screen.getByRole('dialog')).getByRole('textbox'), {
      target: { value: 'Expected after the backfill' },
    });

    const reopen = (status?: CreateStatusTypes.Resolved) =>
      rerender(
        <IncidentGroupBulkStatusModal
          change={status && { kind: 'status', status }}
          incidentCount={12}
          isApplying={false}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      );
    await act(async () => reopen());
    await act(async () => reopen(CreateStatusTypes.Resolved));

    expect(within(screen.getByRole('dialog')).getByRole('textbox')).toHaveValue(
      ''
    );
  });

  it('should confirm an acknowledgement with its scope and nothing to fill in', async () => {
    renderModal(CreateStatusTypes.ACK);

    expect(screen.getByText('label.acknowledge')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-status-scope')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).queryByRole('textbox')
    ).not.toBeInTheDocument();

    await apply();

    expect(mockOnApply).toHaveBeenCalledWith(undefined);
  });

  it('should confirm a severity change and name the severity', async () => {
    renderChange({ kind: 'severity', severity: CreateSeverities.Severity2 });

    expect(screen.getByText('label.set-severity')).toBeInTheDocument();
    expect(screen.getByText('Severity 2')).toBeInTheDocument();

    await apply();

    expect(mockOnApply).toHaveBeenCalledWith(undefined);
  });
});
