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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  WidgetCommentButton,
  WidgetEditButton,
  WidgetPlusButton,
  WidgetRequestButton,
} from './WidgetActionButton';

describe('WidgetActionButton', () => {
  it.each([
    ['edit', WidgetEditButton],
    ['plus', WidgetPlusButton],
    ['comment', WidgetCommentButton],
    ['request', WidgetRequestButton],
  ])(
    'renders the %s action as one button named by its title',
    (_, ActionButton) => {
      render(<ActionButton data-testid="action" title="Add Tag" />);

      // A tooltip trigger around it used to nest a second, unnamed button.
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Add Tag' })).toHaveAttribute(
        'data-testid',
        'action'
      );
    }
  );

  it('keeps a disabled action to one tab stop, named by its title, that does nothing', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onClick = jest.fn();
    render(
      <WidgetPlusButton disabled title="Select a domain" onClick={onClick} />
    );

    await user.tab();
    const button = screen.getByRole('button', { name: 'Select a domain' });

    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await user.keyboard('{Enter}');
    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();

    await user.tab();

    expect(document.body).toHaveFocus();
  });
});
