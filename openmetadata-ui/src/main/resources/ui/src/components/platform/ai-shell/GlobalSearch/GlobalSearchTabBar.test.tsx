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
import { act, fireEvent, render, screen } from '@testing-library/react';
import GlobalSearchTabBar, {
  GlobalSearchTabBarProps,
} from './GlobalSearchTabBar';

jest.mock(
  '../../../common/DomainFilterChip/DomainFilterChip.component',
  () => ({
    DomainFilterChip: () => <span data-testid="domain-chip" />,
  })
);

const onChange = jest.fn();
const onSearchEverything = jest.fn();

const renderTabs = (props: Partial<GlobalSearchTabBarProps> = {}) =>
  render(
    <GlobalSearchTabBar
      isVisible
      filter="all"
      hideCounts={false}
      labelFor={(key) => `label-${key}`}
      more={[]}
      results={{
        assets: { count: 7, rows: [] },
        tasks: { count: 2, rows: [] },
        domain: { count: 4, rows: [] },
      }}
      shown={['assets', 'tasks']}
      totalCount={13}
      onChange={onChange}
      onSearchEverything={onSearchEverything}
      {...props}
    />
  );

describe('GlobalSearchTabBar', () => {
  it('renders nothing when hidden', () => {
    renderTabs({ isVisible: false });

    expect(screen.queryByTestId('global-search-tabs')).not.toBeInTheDocument();
  });

  it('shows All and the shown tabs with counts, and the domain chip', () => {
    renderTabs();

    expect(screen.getByTestId('global-search-tab-all')).toHaveTextContent(
      'label.all13'
    );
    expect(screen.getByTestId('global-search-tab-assets')).toHaveTextContent(
      'label-assets7'
    );
    expect(screen.getByTestId('global-search-tab-tasks')).toHaveTextContent(
      'label-tasks2'
    );
    expect(
      screen.queryByTestId('global-search-tab-domain')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('domain-chip')).toBeInTheDocument();
    expect(
      screen.queryByTestId('global-search-more-tabs')
    ).not.toBeInTheDocument();
  });

  it('hides counts while they would be stale', () => {
    renderTabs({ hideCounts: true });

    expect(screen.getByTestId('global-search-tab-all')).toHaveTextContent(
      /^label\.all$/
    );
  });

  it('changes the filter when a tab is picked', () => {
    renderTabs();

    fireEvent.click(screen.getByTestId('global-search-tab-tasks'));

    expect(onChange).toHaveBeenCalledWith('tasks');
  });

  it('shows only the scoped tab and a way to search everything', () => {
    renderTabs({ filter: 'chats', scopedCategory: 'chats' });

    expect(
      screen.queryByTestId('global-search-tab-all')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('global-search-tab-assets')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('global-search-tab-chats')).toHaveTextContent(
      'label-chats0'
    );
    expect(screen.queryByTestId('domain-chip')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('global-search-everything'));

    expect(onSearchEverything).toHaveBeenCalled();
  });

  it('lists overflow types under "+N more" and switches to the one picked', async () => {
    renderTabs({ more: ['domain'] });

    const trigger = screen.getByTestId('global-search-more-tabs');

    expect(trigger).toHaveTextContent('label.plus-count-more');

    await act(async () => {
      fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
      fireEvent.pointerUp(trigger, { pointerType: 'mouse' });
      fireEvent.click(trigger);
      jest.runOnlyPendingTimers();
    });

    const option = await screen.findByRole('menuitemradio', {
      name: /label-domain/,
    });
    await act(async () => {
      fireEvent.click(option);
      jest.runOnlyPendingTimers();
    });

    expect(onChange).toHaveBeenCalledWith('domain');
  });

  it('shows a picked overflow type as a tab', () => {
    renderTabs({ filter: 'domain', more: ['domain'] });

    expect(screen.getByTestId('global-search-tab-domain')).toHaveTextContent(
      'label-domain4'
    );
  });

  it('puts the picked overflow type in place of "+N more" and keeps it there', async () => {
    const { rerender } = renderTabs({ more: ['domain', 'tag'] });

    await act(async () => {
      fireEvent.click(screen.getByTestId('global-search-more-tabs'));
      jest.runOnlyPendingTimers();
    });
    await act(async () => {
      fireEvent.click(
        await screen.findByRole('menuitemradio', { name: /label-domain/ })
      );
      jest.runOnlyPendingTimers();
    });

    expect(onChange).toHaveBeenCalledWith('domain');

    const props = {
      isVisible: true,
      hideCounts: false,
      labelFor: (key: string) => `label-${key}`,
      more: ['domain', 'tag'],
      results: { domain: { count: 4, rows: [] } },
      shown: ['assets'],
      totalCount: 13,
      onChange,
      onSearchEverything,
    };
    rerender(<GlobalSearchTabBar {...props} filter="domain" />);

    expect(screen.getByTestId('global-search-tab-domain')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('global-search-more-tabs')).not.toHaveTextContent(
      'label.plus-count-more'
    );

    rerender(<GlobalSearchTabBar {...props} filter="assets" />);

    expect(screen.getByTestId('global-search-tab-domain')).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });
});
