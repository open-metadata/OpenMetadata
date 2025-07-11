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
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { TestCaseResolutionStatusTypes } from '../../../generated/tests/testCaseResolutionStatus';
import { TestCaseStatusModal } from './TestCaseStatusModal.component';
import { TestCaseStatusModalProps } from './TestCaseStatusModal.interface';

const mockProps: TestCaseStatusModalProps = {
  open: true,
  testCaseFqn: 'test',
  onCancel: jest.fn(),
  onSubmit: jest.fn().mockImplementation(() => Promise.resolve()),
};

jest.mock('../../../components/common/RichTextEditor/RichTextEditor', () => {
  return forwardRef(jest.fn().mockReturnValue(<div>RichTextEditor</div>));
});
jest.mock('../../../generated/tests/testCase', () => ({
  ...jest.requireActual('../../../generated/tests/testCase'),
  TestCaseResolutionStatusTypes: {
    ACK: 'Ack',
    New: 'New',
    Resolved: 'Resolved',
  },
}));

describe('TestCaseStatusModal component', () => {
  it('component should render', async () => {
    render(<TestCaseStatusModal {...mockProps} />);

    expect(await screen.findByTestId('update-status-form')).toBeInTheDocument();
    expect(await screen.findByLabelText('label.status')).toBeInTheDocument();
    expect(await screen.findByText('label.cancel')).toBeInTheDocument();
    expect(await screen.findByText('label.save')).toBeInTheDocument();
  });

  it.skip('should render test case reason and comment field, if status is resolved', async () => {
    render(
      <TestCaseStatusModal
        {...mockProps}
        data={{
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
        }}
      />
    );

    expect(await screen.findByLabelText('label.status')).toBeInTheDocument();
    expect(await screen.findByLabelText('label.reason')).toBeInTheDocument();
    expect(await screen.findByText('RichTextEditor')).toBeInTheDocument();
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

  it.skip('should call onSubmit function, on click of save button', async () => {
    render(<TestCaseStatusModal {...mockProps} />);
    const submitBtn = await screen.findByText('label.save');
    const status = await screen.findByLabelText('label.status');

    await act(async () => {
      userEvent.click(status);
    });

    const statusOption = await screen.findAllByText('New');

    await act(async () => {
      fireEvent.click(statusOption[1]);
    });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockProps.onSubmit).toHaveBeenCalled();
  });
});
