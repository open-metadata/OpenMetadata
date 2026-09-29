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
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { searchQuery } from '../../../rest/searchAPI';
import AddLineagePopover from './AddLineagePopover';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));

const hit = (id: string, name: string, extra = {}) => ({
  _source: {
    id,
    name,
    fullyQualifiedName: `s.d.sc.${name}`,
    entityType: 'table',
    ...extra,
  },
});

const trigger = document.createElement('button');
document.body.appendChild(trigger);
const triggerRef = createRef<HTMLElement>() as { current: HTMLElement };
triggerRef.current = trigger;

const baseProps = {
  excludeEntityId: 'self',
  onClose: jest.fn(),
  onSubmit: jest.fn().mockResolvedValue(true),
};

// react-aria-components popovers only open on a full pointer-event sequence
// (pointerdown/pointerup), which `fireEvent.click` does not synthesize —
// `@testing-library/user-event` is required to actually open the Select /
// ComboBox popovers. The testids sit on wrapper `<div>`s (Select's own, and
// one the popover adds around the ComboBox) rather than on the clickable
// trigger, so triggers are queried by role within that wrapper instead.
const openTypeSelect = async (user: ReturnType<typeof userEvent.setup>) => {
  const wrapper = screen.getByTestId('add-lineage-type-select');
  await user.click(within(wrapper).getByRole('button'));
};

const openColumnSelect = async (user: ReturnType<typeof userEvent.setup>) => {
  const wrapper = screen.getByTestId('add-lineage-column-select');
  await user.click(within(wrapper).getByRole('button'));
};

const pickType = async (user: ReturnType<typeof userEvent.setup>) => {
  await openTypeSelect(user);
  await user.click(
    await screen.findByRole('option', { name: 'label.table-plural' })
  );
};

const searchEntity = async (
  user: ReturnType<typeof userEvent.setup>,
  text: string
) => {
  await user.type(
    within(screen.getByTestId('add-lineage-entity-input')).getByRole(
      'combobox'
    ),
    text
  );
  await act(async () => jest.advanceTimersByTime(300));
};

describe('AddLineagePopover', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
      delay: null,
    });
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: { hits: [hit('self', 'self'), hit('b', 'orders')] },
    });
  });

  afterEach(() => jest.useRealTimers());

  const open = (direction = LineageDirection.Downstream, columnFqn?: string) =>
    render(
      <AddLineagePopover
        {...baseProps}
        request={{ nodeId: 'n1', direction, columnFqn, triggerRef }}
      />
    );

  it('renders nothing without a request', () => {
    render(<AddLineagePopover {...baseProps} />);

    expect(screen.queryByTestId('add-lineage-popover')).not.toBeInTheDocument();
  });

  it('shows the direction title', () => {
    open(LineageDirection.Upstream);

    expect(screen.getByText('label.add-upstream')).toBeInTheDocument();
  });

  it('searches the chosen type, excludes the current entity and submits on pick', async () => {
    open();
    await pickType(user);
    await searchEntity(user, 'ord');

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ searchIndex: 'table' })
    );
    expect(
      screen.queryByRole('option', { name: /self/ })
    ).not.toBeInTheDocument();

    await user.click(await screen.findByRole('option', { name: /orders/ }));

    await waitFor(() =>
      expect(baseProps.onSubmit).toHaveBeenCalledWith({
        entity: { id: 'b', type: 'table', fullyQualifiedName: 's.d.sc.orders' },
      })
    );
  });

  it('asks for a column when opened from a column and submits the column', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          hit('b', 'orders', {
            columns: [{ name: 'id', fullyQualifiedName: 's.d.sc.orders.id' }],
          }),
        ],
      },
    });
    open(LineageDirection.Downstream, 's.d.sc.self.id');
    await pickType(user);
    await searchEntity(user, 'ord');
    await user.click(await screen.findByRole('option', { name: /orders/ }));

    expect(baseProps.onSubmit).not.toHaveBeenCalled();

    await openColumnSelect(user);
    await user.click(await screen.findByRole('option', { name: 'id' }));

    await waitFor(() =>
      expect(baseProps.onSubmit).toHaveBeenCalledWith({
        entity: { id: 'b', type: 'table', fullyQualifiedName: 's.d.sc.orders' },
        columnFqn: 's.d.sc.orders.id',
      })
    );
  });

  it('stays open with selections kept when submit fails, and ignores duplicate submits', async () => {
    let resolveSubmit: (value: boolean) => void = (_value: boolean) =>
      undefined;
    baseProps.onSubmit.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve;
        })
    );
    open();
    await pickType(user);
    await searchEntity(user, 'ord');
    await user.click(await screen.findByRole('option', { name: /orders/ }));
    await user.click(screen.getByRole('combobox'));

    expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => resolveSubmit(false));

    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-lineage-popover')).toBeInTheDocument();
  });
});
