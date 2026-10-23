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
  // A view switch, not tabs: there is no panel behind either option.
  it('offers the views as one single-choice group with the current view chosen', () => {
    renderHeader();

    expect(screen.getByRole('radiogroup')).toHaveAccessibleName('label.view');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'label.grid' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('radio', { name: 'label.list' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('reports the view the user picks', () => {
    const { onViewModeChange } = renderHeader();

    fireEvent.click(screen.getByTestId('topics-list-view'));

    expect(onViewModeChange).toHaveBeenCalledWith('list');
  });

  it('keeps a view chosen when the current one is pressed again', () => {
    const { onViewModeChange } = renderHeader();

    fireEvent.click(screen.getByTestId('topics-grid-view'));

    expect(onViewModeChange).not.toHaveBeenCalledWith('list');
    expect(screen.getByTestId('topics-grid-view')).toHaveAttribute(
      'aria-checked',
      'true'
    );
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
