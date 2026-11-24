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
import TopicCardFooter from './TopicCardFooter';
import { TopicKey } from './topics.types';

describe('TopicCardFooter', () => {
  it('renders nothing with no meta, no action and nothing loading', () => {
    const { container } = render(
      <TopicCardFooter isLoading={false} topicKey={TopicKey.DOMAINS} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the meta and fires the action', () => {
    const onPress = jest.fn();
    render(
      <TopicCardFooter
        action={{ label: 'View all', onPress }}
        isLoading={false}
        meta="28 more domains"
        topicKey={TopicKey.DOMAINS}
      />
    );

    expect(screen.getByText('28 more domains')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('topic-action-domains'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // The strip stays while loading so the card keeps its shape; the meta, which
  // is derived from counts not yet known, does not.
  it('keeps its strip but not its meta while loading', () => {
    render(
      <TopicCardFooter
        isLoading
        meta="28 more domains"
        topicKey={TopicKey.DOMAINS}
      />
    );

    expect(screen.queryByText('28 more domains')).toBeNull();
  });
});
