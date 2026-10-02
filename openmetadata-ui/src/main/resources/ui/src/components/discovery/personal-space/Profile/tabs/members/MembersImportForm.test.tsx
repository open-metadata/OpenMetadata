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

import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock(
  '../../../../../../context/WebSocketProvider/WebSocketProvider',
  () => ({ useWebSocketConnector: () => ({ socket: undefined }) })
);

jest.mock('../../../../../../rest/teamsAPI', () => ({
  importTeam: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
  importUserInTeam: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./MembersImportResultTable', () => () => (
  <div data-testid="import-result-table" />
));

import MembersImportForm from './MembersImportForm';

describe('MembersImportForm', () => {
  it('renders the stepper with the upload step active', () => {
    render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('active-step')).toHaveTextContent('0');
    expect(screen.getByTestId('csv-workflow-step-0')).toHaveAttribute(
      'data-active',
      'true'
    );
    expect(screen.getByTestId('csv-workflow-step-1')).toHaveAttribute(
      'data-active',
      'false'
    );
  });

  it('disables Next until a file is selected and Cancel closes', () => {
    const onClose = jest.fn();
    render(
      <MembersImportForm
        fqn="Organization"
        importType="teams"
        onClose={onClose}
      />
    );

    expect(screen.getByTestId('next-preview')).toBeDisabled();

    fireEvent.click(screen.getByTestId('cancel-import'));

    expect(onClose).toHaveBeenCalled();
  });
});
