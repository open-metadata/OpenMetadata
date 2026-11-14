/*
 *  Copyright 2022 Collate.
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
import FeedPanelHeader from './FeedPanelHeader';

describe('Test FeedPanelHeader Component', () => {
  it('titles the panel Conversation alone', () => {
    render(<FeedPanelHeader onCancel={jest.fn()} />);

    expect(screen.getByTestId('header-title')).toHaveTextContent(
      /^label\.conversation$/
    );
  });

  it('offers a new conversation only when it can start one', () => {
    const onShowNewConversation = jest.fn();
    const { rerender } = render(<FeedPanelHeader onCancel={jest.fn()} />);

    expect(
      screen.queryByTestId('add-new-conversation')
    ).not.toBeInTheDocument();

    rerender(
      <FeedPanelHeader
        onCancel={jest.fn()}
        onShowNewConversation={onShowNewConversation}
      />
    );
    fireEvent.click(screen.getByTestId('add-new-conversation'));

    expect(onShowNewConversation).toHaveBeenCalledWith(true);
  });

  it('closes from the close icon unless it is hidden', () => {
    const onCancel = jest.fn();
    const { rerender } = render(<FeedPanelHeader onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('closeDrawer'));

    expect(onCancel).toHaveBeenCalled();

    rerender(<FeedPanelHeader hideCloseIcon onCancel={onCancel} />);

    expect(screen.queryByTestId('closeDrawer')).not.toBeInTheDocument();
  });
});
