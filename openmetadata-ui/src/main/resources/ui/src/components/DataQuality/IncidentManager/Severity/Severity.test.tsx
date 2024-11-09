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
  act,
  fireEvent,
  queryByTestId,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import Severity from './Severity.component';

jest.mock('./SeverityModal.component', () =>
  jest.fn().mockImplementation(({ onSubmit }) => (
    <div>
      SeverityModal{' '}
      <button
        data-testid="submit-btn"
        onClick={() => onSubmit({ severity: Severities.Severity1 })}>
        submit
      </button>
    </div>
  ))
);
jest.mock('../../../common/Badge/Badge.component', () =>
  jest.fn().mockImplementation(({ label }) => <div>{label}</div>)
);
jest.mock('../../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

describe('Severity', () => {
  it('Should render component', async () => {
    render(<Severity severity={Severities.Severity1} />);

    expect(await screen.findByText('Severity 1')).toBeInTheDocument();
  });

  it("Should render no data placeholder if severity doesn't exist", async () => {
    render(<Severity />);

    expect(await screen.findByText('--')).toBeInTheDocument();
  });

  it('Should show edit icon if onSubmit is provided and edit permission is true', async () => {
    render(<Severity onSubmit={jest.fn()} />);

    expect(await screen.findByTestId('edit-severity-icon')).toBeInTheDocument();
  });

  it('Should not show edit icon if edit permission is false', async () => {
    (checkPermission as jest.Mock).mockReturnValueOnce(false);
    const { container } = render(<Severity onSubmit={jest.fn()} />);

    expect(
      queryByTestId(container, 'edit-severity-icon')
    ).not.toBeInTheDocument();
  });

  it('Should render modal onClick of edit icon', async () => {
    render(<Severity onSubmit={jest.fn()} />);
    const editIcon = await screen.findByTestId('edit-severity-icon');

    expect(await screen.findByTestId('edit-severity-icon')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(editIcon);
    });

    expect(await screen.findByText('SeverityModal')).toBeInTheDocument();
  });

  it('Should call onSubmit function onClick of submit', async () => {
    const mockSubmit = jest.fn();
    render(<Severity onSubmit={mockSubmit} />);
    const editIcon = await screen.findByTestId('edit-severity-icon');

    expect(await screen.findByTestId('edit-severity-icon')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(editIcon);
    });

    expect(await screen.findByText('SeverityModal')).toBeInTheDocument();

    const submitIcon = await screen.findByTestId('submit-btn');
    await act(async () => {
      fireEvent.click(submitIcon);
    });

    expect(mockSubmit).toHaveBeenCalledWith({ severity: Severities.Severity1 });
  });
});
