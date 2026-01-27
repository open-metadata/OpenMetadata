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
import {
  fireEvent,
  queryByTestId,
  queryByText,
  render,
  screen,
} from '@testing-library/react';
import { act } from 'react-test-renderer';
import { TestCaseResolutionStatus } from '../../../../generated/tests/testCaseResolutionStatus';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import TestCaseIncidentManagerStatus from './TestCaseIncidentManagerStatus.component';
import { TestCaseStatusIncidentManagerProps } from './TestCaseIncidentManagerStatus.interface';
const mockProps: TestCaseStatusIncidentManagerProps = {
  data: {
    id: 'a5621b4b-362f-4635-9c88-ac883449662e',
    stateId: '3ddb18f2-339d-49f4-989c-323ebcb915e7',
    timestamp: 1703830298324,
    testCaseResolutionStatusType: 'New',
    updatedBy: {
      id: '1adc8817-9232-41b3-8712-33f2e0d6deb9',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      deleted: false,
    },
    updatedAt: 1703830298324,
    testCaseReference: {
      id: '1b748634-d24b-4879-9791-289f2f90fc3c',
      type: 'testCase',
      name: 'table_column_count_equals',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals',
    },
  } as TestCaseResolutionStatus,
  onSubmit: jest.fn(),
};

jest.mock('../../../common/Badge/Badge.component', () =>
  jest.fn().mockImplementation(({ label }) => <div>{label}</div>)
);
jest.mock('../../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));
jest.mock('../../TestCaseStatusModal/TestCaseStatusModal.component', () => ({
  TestCaseStatusModal: jest
    .fn()
    .mockImplementation(({ onSubmit, onCancel }) => (
      <div>
        TestCaseStatusModal
        <button data-testid="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          data-testid="submit-btn"
          onClick={() => onSubmit(mockProps.data)}>
          Submit
        </button>
      </div>
    )),
}));
jest.mock('./InlineTestCaseIncidentStatus.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ data, hasEditPermission, onSubmit }) => (
      <div data-testid="inline-test-case-status">
        InlineTestCaseIncidentStatus
        <span data-testid="inline-status-type">
          {data.testCaseResolutionStatusType}
        </span>
        <span data-testid="inline-has-permission">
          {hasEditPermission.toString()}
        </span>
        <button data-testid="inline-submit-btn" onClick={() => onSubmit(data)}>
          Submit
        </button>
      </div>
    )),
}));
jest.mock('../../../../test/unit/mocks/mui.mock');

describe('TestCaseIncidentManagerStatus', () => {
  it('Should render component', async () => {
    render(<TestCaseIncidentManagerStatus {...mockProps} />);

    expect(await screen.findByText('label.new')).toBeInTheDocument();
    expect(
      await screen.findByTestId('edit-resolution-icon')
    ).toBeInTheDocument();
  });

  it('Should not show edit icon if edit permission is false', async () => {
    (checkPermission as jest.Mock).mockReturnValueOnce(false);
    const { container } = render(
      <TestCaseIncidentManagerStatus {...mockProps} />
    );

    expect(
      queryByTestId(container, 'edit-resolution-icon')
    ).not.toBeInTheDocument();
  });

  it('Should render modal onClick of edit icon', async () => {
    render(<TestCaseIncidentManagerStatus {...mockProps} />);
    const editIcon = await screen.findByTestId('edit-resolution-icon');

    expect(
      await screen.findByTestId('edit-resolution-icon')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(editIcon);
    });

    expect(await screen.findByText('TestCaseStatusModal')).toBeInTheDocument();
  });

  it('Should call onSubmit function onClick of submit', async () => {
    render(<TestCaseIncidentManagerStatus {...mockProps} />);
    const editIcon = await screen.findByTestId('edit-resolution-icon');

    expect(
      await screen.findByTestId('edit-resolution-icon')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(editIcon);
    });

    expect(await screen.findByText('TestCaseStatusModal')).toBeInTheDocument();

    const submitIcon = await screen.findByTestId('submit-btn');
    await act(async () => {
      fireEvent.click(submitIcon);
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith(mockProps.data);
  });

  it('Should call onCancel function onClick of cancel', async () => {
    const { container } = render(
      <TestCaseIncidentManagerStatus {...mockProps} />
    );
    const editIcon = await screen.findByTestId('edit-resolution-icon');

    expect(
      await screen.findByTestId('edit-resolution-icon')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(editIcon);
    });

    expect(await screen.findByText('TestCaseStatusModal')).toBeInTheDocument();

    const cancelBtn = await screen.findByTestId('cancel-btn');
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(
      queryByText(container, 'TestCaseStatusModal')
    ).not.toBeInTheDocument();
  });

  describe('Inline Mode', () => {
    it('should render InlineTestCaseIncidentStatus when isInline is true', () => {
      render(<TestCaseIncidentManagerStatus {...mockProps} isInline />);

      expect(screen.getByTestId('inline-test-case-status')).toBeInTheDocument();
      expect(
        screen.getByText('InlineTestCaseIncidentStatus')
      ).toBeInTheDocument();
    });

    it('should pass correct data to InlineTestCaseIncidentStatus', () => {
      render(<TestCaseIncidentManagerStatus {...mockProps} isInline />);

      expect(screen.getByTestId('inline-status-type')).toHaveTextContent('New');
    });

    it('should pass hasEditPermission as true when permission exists', () => {
      render(<TestCaseIncidentManagerStatus {...mockProps} isInline />);

      expect(screen.getByTestId('inline-has-permission')).toHaveTextContent(
        'true'
      );
    });

    it('should pass hasEditPermission as false when permission is false', () => {
      (checkPermission as jest.Mock).mockReturnValueOnce(false);
      render(<TestCaseIncidentManagerStatus {...mockProps} isInline />);

      expect(screen.getByTestId('inline-has-permission')).toHaveTextContent(
        'false'
      );
    });

    it('should call onSubmit when InlineTestCaseIncidentStatus submits', async () => {
      render(<TestCaseIncidentManagerStatus {...mockProps} isInline />);

      const submitBtn = screen.getByTestId('inline-submit-btn');
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(mockProps.onSubmit).toHaveBeenCalledWith(mockProps.data);
    });

    it('should not render modal components when isInline is true', () => {
      const { container } = render(
        <TestCaseIncidentManagerStatus {...mockProps} isInline />
      );

      expect(
        queryByTestId(container, 'edit-resolution-icon')
      ).not.toBeInTheDocument();
      expect(
        queryByText(container, 'TestCaseStatusModal')
      ).not.toBeInTheDocument();
    });

    it('should respect hasPermission prop when passed explicitly', () => {
      render(
        <TestCaseIncidentManagerStatus
          isInline
          {...mockProps}
          hasPermission={false}
        />
      );

      expect(screen.getByTestId('inline-has-permission')).toHaveTextContent(
        'false'
      );
    });
  });
});
