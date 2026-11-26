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
import { KEY_HINT } from './GlobalSearch.constants';
import GlobalSearchFooter, {
  GlobalSearchFooterProps,
} from './GlobalSearchFooter';

const renderFooter = (props: Partial<GlobalSearchFooterProps> = {}) =>
  render(
    <GlobalSearchFooter showActionHint={false} showTabHint={false} {...props} />
  );

describe('GlobalSearchFooter', () => {
  it('runs the footer action', () => {
    const onPress = jest.fn();
    renderFooter({ action: { label: 'Open in Explore', onPress } });

    fireEvent.click(screen.getByTestId('global-search-footer-action'));

    expect(onPress).toHaveBeenCalled();
  });

  it('shows only the close hint by default', () => {
    renderFooter();

    expect(
      screen.queryByTestId('global-search-footer-action')
    ).not.toBeInTheDocument();
    expect(screen.getByText('label.close')).toBeInTheDocument();
    expect(screen.queryByText('label.filter-plural')).not.toBeInTheDocument();
    expect(screen.queryByText('↵')).not.toBeInTheDocument();
  });

  it('shows the enter, action and tab hints when asked', () => {
    renderFooter({
      actionHint: 'Ask AI',
      enterLabel: 'label.open',
      showActionHint: true,
      showTabHint: true,
    });

    expect(screen.getByText('label.open')).toBeInTheDocument();
    expect(screen.getByText('Ask AI')).toBeInTheDocument();
    expect(screen.getByText(KEY_HINT.mod)).toBeInTheDocument();
    expect(screen.getAllByText('↵')).toHaveLength(2);
    expect(screen.getByText('label.filter-plural')).toBeInTheDocument();
    // Esc always closes search, with or without a query.
    expect(screen.getByText('label.close')).toBeInTheDocument();
    expect(screen.queryByText('label.clear')).not.toBeInTheDocument();
  });
});
