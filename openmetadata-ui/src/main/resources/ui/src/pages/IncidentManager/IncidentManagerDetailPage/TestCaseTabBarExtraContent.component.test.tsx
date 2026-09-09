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
import TestCaseTabBarExtraContent from './TestCaseTabBarExtraContent.component';

const mockToggleTabExpanded = jest.fn();

describe('TestCaseTabBarExtraContent', () => {
  beforeEach(() => {
    mockToggleTabExpanded.mockClear();
  });

  it('does not render when expanded tabs are unsupported', () => {
    const { container } = render(
      <TestCaseTabBarExtraContent
        isExpandViewSupported={false}
        isTabExpanded={false}
        toggleTabExpanded={mockToggleTabExpanded}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the tab control and invokes the toggle action', () => {
    render(
      <TestCaseTabBarExtraContent
        isExpandViewSupported
        isTabExpanded={false}
        toggleTabExpanded={mockToggleTabExpanded}
      />
    );

    const tabExpandButton = screen.getByTestId('tab-expand-button');

    expect(tabExpandButton).not.toHaveClass('rotate-180');

    fireEvent.click(tabExpandButton);

    expect(mockToggleTabExpanded).toHaveBeenCalledTimes(1);
  });

  it('rotates the tab control when the tab is expanded', () => {
    render(
      <TestCaseTabBarExtraContent
        isExpandViewSupported
        isTabExpanded
        toggleTabExpanded={mockToggleTabExpanded}
      />
    );

    expect(screen.getByTestId('tab-expand-button')).toHaveClass('rotate-180');
  });
});
