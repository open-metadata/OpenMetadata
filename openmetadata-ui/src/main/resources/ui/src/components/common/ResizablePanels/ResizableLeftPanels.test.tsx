/*
 *  Copyright 2024 Collate.
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
import { act, render, screen } from '@testing-library/react';
import ResizableLeftPanels from './ResizableLeftPanels';
jest.mock('../DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => <div>DocumentTitle</div>)
);
const firstPanel = {
  children: <div>First Panel</div>,
  minWidth: 100,
  className: 'first-panel',
  flex: 0.5,
  onStopResize: jest.fn(),
};

const secondPanel = {
  children: <div>Second Panel</div>,
  minWidth: 100,
  className: 'second-panel',
  flex: 0.5,
  onStopResize: jest.fn(),
};

describe('ResizableLeftPanels', () => {
  it('should render ResizableLeftPanels', () => {
    const { getByTestId } = render(
      <ResizableLeftPanels
        className="test-class"
        firstPanel={firstPanel}
        hideSecondPanel={false}
        orientation="vertical"
        pageTitle="Test Page"
        secondPanel={secondPanel}
      />
    );

    expect(getByTestId(firstPanel.className)).toBeInTheDocument();
    expect(getByTestId(secondPanel.className)).toBeInTheDocument();
  });

  it('should hide the first panel when hideFirstPanel is true', async () => {
    await act(async () => {
      render(
        <ResizableLeftPanels
          hideFirstPanel
          firstPanel={firstPanel}
          pageTitle="Test Page"
          secondPanel={secondPanel}
        />
      );
    });

    expect(screen.getByTestId('first-panel')).toHaveClass('hidden');

    expect(screen.getByText('Second Panel')).toBeInTheDocument();
  });

  it('should set the orientation of the panels to horizontal', () => {
    const { container } = render(
      <ResizableLeftPanels
        firstPanel={firstPanel}
        orientation="horizontal"
        pageTitle="Test Page"
        secondPanel={secondPanel}
      />
    );

    expect(
      container.querySelector('.reflex-container.horizontal')
    ).toBeInTheDocument();
  });

  it('should pass className to ReflexContainer', () => {
    const { container } = render(
      <ResizableLeftPanels
        className="test-class"
        firstPanel={firstPanel}
        pageTitle="Test Page"
        secondPanel={secondPanel}
      />
    );

    expect(container.querySelector('.test-class')).toBeInTheDocument();
  });
});
