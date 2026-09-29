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
import React from 'react';

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

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditor',
  () =>
    jest.fn().mockReturnValue(<div data-testid="rich-text-editor" />)
);

import MembersAddTeamForm from './MembersAddTeamForm';

describe('MembersAddTeamForm', () => {

  it('renders form container and footer buttons', () => {
    render(
      <MembersAddTeamForm onCancel={jest.fn()} onSave={jest.fn()} />
    );

    expect(
      screen.getByTestId('add-team-container')
    ).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('renders the description rich text editor', () => {
    render(
      <MembersAddTeamForm onCancel={jest.fn()} onSave={jest.fn()} />
    );

    expect(
      screen.getByTestId('rich-text-editor')
    ).toBeInTheDocument();
  });

});
