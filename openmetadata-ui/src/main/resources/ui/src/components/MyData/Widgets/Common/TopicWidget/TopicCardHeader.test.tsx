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
import { Users01 } from '@openmetadata/ui-core-components/icons';
import { fireEvent, render, screen } from '@testing-library/react';
import TopicCardHeader, { TopicCardHeaderProps } from './TopicCardHeader';
import { TopicKey } from './topics.types';

const WIDGET_KEY = 'KnowledgePanel.Domains-1';

const renderHeader = (props: Partial<TopicCardHeaderProps> = {}) =>
  render(
    <TopicCardHeader
      isCollapsed={false}
      isLoading={false}
      status={{ color: 'warning', label: '4 unowned' }}
      summarySlot={<span>Summary</span>}
      title="Domains"
      tone={{ icon: Users01, tile: 'tw:bg-utility-blue-50' }}
      topicKey={TopicKey.DOMAINS}
      widgetKey={WIDGET_KEY}
      {...props}
    />
  );

describe('TopicCardHeader', () => {
  it('shows the status chip under a per-topic testid', () => {
    renderHeader();

    expect(screen.getByTestId('topic-status-domains')).toHaveTextContent(
      '4 unowned'
    );
  });

  it('withholds the status while loading', () => {
    renderHeader({ isLoading: true });

    expect(screen.queryByTestId('topic-status-domains')).toBeNull();
  });

  it('is static where collapsing is not offered', () => {
    renderHeader();

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is the toggle itself where collapsing is offered', () => {
    const onToggle = jest.fn();
    renderHeader({ isCollapsed: true, onToggle });
    const toggle = screen.getByTestId(`toggle-widget-${WIDGET_KEY}`);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
