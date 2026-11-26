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
import GlobalSearchMoreTabs, {
  GlobalSearchMoreTabsProps,
} from './GlobalSearchMoreTabs';

const onPick = jest.fn();

const renderMore = (props: Partial<GlobalSearchMoreTabsProps> = {}) =>
  render(
    <GlobalSearchMoreTabs
      countOf={(key) => (key === 'domain' ? 4 : 1)}
      filter="all"
      labelFor={(key) => `label-${key}`}
      more={['domain', 'tag']}
      onPick={onPick}
      {...props}
    />
  );

describe('GlobalSearchMoreTabs', () => {
  it('renders nothing without overflow types', () => {
    renderMore({ more: [] });

    expect(
      screen.queryByTestId('global-search-more-tabs')
    ).not.toBeInTheDocument();
  });

  it('shows "+N more" until a type takes the slot', () => {
    const { rerender } = renderMore();

    expect(screen.getByTestId('global-search-more-tabs')).toHaveTextContent(
      'label.plus-count-more'
    );

    rerender(
      <GlobalSearchMoreTabs
        countOf={() => 1}
        filter="domain"
        labelFor={(key) => `label-${key}`}
        more={['domain', 'tag']}
        slot="domain"
        onPick={onPick}
      />
    );

    expect(screen.getByTestId('global-search-more-tabs')).toHaveAttribute(
      'aria-label',
      'label.more'
    );
  });

  it('lists every overflow type with its count and reports the pick', async () => {
    renderMore();

    await act(async () => {
      fireEvent.click(screen.getByTestId('global-search-more-tabs'));
      jest.runOnlyPendingTimers();
    });

    const tag = await screen.findByRole('menuitemradio', { name: /label-tag/ });

    expect(
      screen.getByRole('menuitemradio', { name: /label-domain/ })
    ).toHaveTextContent('4');

    await act(async () => {
      fireEvent.click(tag);
      jest.runOnlyPendingTimers();
    });

    expect(onPick).toHaveBeenCalledWith('tag');
  });
});
