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
import TopicsSectionHeader, {
  TopicsSectionHeaderProps,
} from './TopicsSectionHeader';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderHeader = (props: Partial<TopicsSectionHeaderProps> = {}) => {
  const onViewModeChange = jest.fn();
  const onToggleAll = jest.fn();
  render(
    <TopicsSectionHeader
      isEveryWidgetCollapsed={false}
      isToggleAllDisabled={false}
      viewMode="grid"
      onToggleAll={onToggleAll}
      onViewModeChange={onViewModeChange}
      {...props}
    />
  );

  return { onToggleAll, onViewModeChange };
};

describe('TopicsSectionHeader', () => {
  // The design's segmented control: one gray track, the chosen view raised.
  it('offers the views as one segmented control with the current view chosen', () => {
    renderHeader();

    expect(screen.getByRole('tablist')).toHaveAccessibleName('label.view');
    expect(screen.getByRole('tablist')).toHaveClass('tw:bg-tertiary');
    expect(screen.getByTestId('topics-grid-view')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('topics-list-view')).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(screen.getByRole('tab', { name: 'label.list' })).toBeInTheDocument();
  });

  it('reports the view the user picks', () => {
    const { onViewModeChange } = renderHeader();

    fireEvent.click(screen.getByTestId('topics-list-view'));

    expect(onViewModeChange).toHaveBeenCalledWith('list');
  });

  it('labels the collapse control in bold primary text, as the design does', () => {
    renderHeader();

    expect(screen.getByText('label.collapse-all')).toHaveClass(
      'tw:font-semibold',
      'tw:text-primary'
    );
  });

  it('collapses or expands every card from one button', () => {
    const { onToggleAll } = renderHeader({ isEveryWidgetCollapsed: true });

    const toggle = screen.getByTestId('toggle-all-widgets');

    expect(toggle).toHaveTextContent('label.expand-all');

    fireEvent.click(toggle);

    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });
});
