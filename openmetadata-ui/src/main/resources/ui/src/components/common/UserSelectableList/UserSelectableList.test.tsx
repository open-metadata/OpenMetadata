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
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { EntityReference } from '../../../generated/entity/type';
import { SelectableList } from '../SelectableList/SelectableList.component';
import { UserSelectableList } from './UserSelectableList.component';

const mockOnUpdate = jest.fn();

jest.mock('../../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({ data: [], paging: { total: 5 } }),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: {
      hits: [],
      total: { value: 5 },
    },
  }),
}));

jest.mock('../SelectableList/SelectableList.component', () => ({
  SelectableList: jest.fn().mockReturnValue(<div>selectable-list</div>),
}));

jest.mock('../UserTag/UserTag.component', () => ({
  UserTag: jest
    .fn()
    .mockImplementation(({ name }) => (
      <span data-testid="user-tag">{name}</span>
    )),
}));

describe('UserSelectableList Component Test', () => {
  it('should render disabled button if no permission', () => {
    render(
      <UserSelectableList
        hasPermission={false}
        selectedUsers={[]}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      expect(screen.getByTestId('add-user')).toBeDisabled();
    });
  });

  it('should render enabled button if has permission', () => {
    render(
      <UserSelectableList
        hasPermission
        selectedUsers={[]}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      expect(screen.getByTestId('add-user')).toBeEnabled();
    });
  });

  it('should render selectablelist if click on add-user', () => {
    render(
      <UserSelectableList
        hasPermission
        selectedUsers={[]}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      fireEvent.click(screen.getByTestId('add-user'));
    });

    expect(screen.getByText('selectable-list')).toBeInTheDocument();
  });

  it('should render the bot indicator after the bot name so rows stay aligned', () => {
    const bot = {
      id: 'bot-id',
      name: 'ingestion-bot',
      type: 'user',
      isBot: true,
    };
    const human = { id: 'user-id', name: 'aaron', type: 'user' };

    render(
      <UserSelectableList
        hasPermission
        includeBot
        selectedUsers={[bot, human]}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      fireEvent.click(screen.getByTestId('add-user'));
    });

    const { customTagRenderer } = (SelectableList as jest.Mock).mock.calls.at(
      -1
    )[0] as { customTagRenderer: (item: EntityReference) => ReactNode };

    const { container: botRow } = render(<>{customTagRenderer(bot)}</>);
    const userTag = within(botRow).getByTestId('user-tag');
    const botIndicator = within(botRow).getByTestId('bot-indicator');

    expect(
      userTag.compareDocumentPosition(botIndicator) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const { container: humanRow } = render(<>{customTagRenderer(human)}</>);

    expect(
      within(humanRow).queryByTestId('bot-indicator')
    ).not.toBeInTheDocument();
  });
});
