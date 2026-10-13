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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createTeam } from '../../../../../../rest/teamsAPI';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('../../../../../../rest/teamsAPI', () => ({
  createTeam: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="rich-text-editor" />)
);

import MembersAddTeamForm from './MembersAddTeamForm';

describe('MembersAddTeamForm', () => {
  it('renders form container and footer buttons', () => {
    render(<MembersAddTeamForm onCancel={jest.fn()} onSave={jest.fn()} />);

    expect(screen.getByTestId('add-team-container')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('renders the description rich text editor', () => {
    render(<MembersAddTeamForm onCancel={jest.fn()} onSave={jest.fn()} />);

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('submits teamType as the enum string, not the select option object', async () => {
    const onSave = jest.fn();
    const { container } = render(
      <MembersAddTeamForm onCancel={jest.fn()} onSave={onSave} />
    );

    const nameInput = container.querySelector(
      'input[name="name"]'
    ) as HTMLInputElement;
    const displayNameInput = container.querySelector(
      'input[name="displayName"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'team-a' } });
    fireEvent.change(displayNameInput, { target: { value: 'Team A' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(createTeam).toHaveBeenCalled());

    expect((createTeam as jest.Mock).mock.calls[0][0].teamType).toBe('Group');
    expect(onSave).toHaveBeenCalled();
  });
});
