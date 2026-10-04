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
import React from 'react';
import { Team } from '../../../../../../generated/entity/teams/team';
import MembersTeamDescription from './MembersTeamDescription';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: React.forwardRef(() => <div data-testid="rich-text-editor" />),
}));

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () => ({
    __esModule: true,
    default: ({ markdown }: { markdown: string }) => (
      <div data-testid="rich-text-preview">{markdown}</div>
    ),
  })
);

const team = { description: 'Team desc' } as Team;

const baseProps = {
  team,
  canEditDescInline: true,
  isDescEditing: false,
  isDescSaving: false,
  descEditorRef: React.createRef(),
  onStartEdit: jest.fn(),
  onCancelEdit: jest.fn(),
  onSave: jest.fn(),
} as unknown as React.ComponentProps<typeof MembersTeamDescription>;

describe('MembersTeamDescription', () => {
  it('shows the description preview and an edit button when not editing', () => {
    render(<MembersTeamDescription {...baseProps} />);

    expect(screen.getByTestId('rich-text-preview')).toHaveTextContent(
      'Team desc'
    );
    expect(screen.getByTestId('edit-description-btn')).toBeInTheDocument();
  });

  it('shows the no-description placeholder when the team has no description', () => {
    render(
      <MembersTeamDescription {...baseProps} team={{} as Team} />
    );

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
    expect(screen.queryByTestId('rich-text-preview')).not.toBeInTheDocument();
  });

  it('hides the edit button when inline editing is not permitted', () => {
    render(
      <MembersTeamDescription {...baseProps} canEditDescInline={false} />
    );

    expect(
      screen.queryByTestId('edit-description-btn')
    ).not.toBeInTheDocument();
  });

  it('calls onStartEdit when the edit button is pressed', () => {
    const onStartEdit = jest.fn();
    render(
      <MembersTeamDescription {...baseProps} onStartEdit={onStartEdit} />
    );

    fireEvent.click(screen.getByTestId('edit-description-btn'));

    expect(onStartEdit).toHaveBeenCalled();
  });

  it('renders the editor with save/cancel while editing and wires their handlers', () => {
    const onSave = jest.fn();
    const onCancelEdit = jest.fn();
    render(
      <MembersTeamDescription
        {...baseProps}
        isDescEditing
        onCancelEdit={onCancelEdit}
        onSave={onSave}
      />
    );

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('save-description'));
    fireEvent.click(screen.getByTestId('cancel-description'));

    expect(onSave).toHaveBeenCalled();
    expect(onCancelEdit).toHaveBeenCalled();
  });
});
