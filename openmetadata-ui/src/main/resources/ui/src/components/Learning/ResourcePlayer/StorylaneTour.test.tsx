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

import { fireEvent, render, screen } from '@testing-library/react';
import { StorylaneTour } from './StorylaneTour.component';

const DEMO_URL = 'https://app.storylane.io/demo/abc123';
const TITLE = 'Test Storylane Tour';

describe('StorylaneTour', () => {
  it('should render loading spinner initially', () => {
    render(<StorylaneTour title={TITLE} url={DEMO_URL} />);

    expect(screen.queryByTestId('loader')).toBeInTheDocument();
  });

  it.each([
    'javascript:alert(document.domain)',
    'data:text/html,<script>alert(1)</script>',
    'not-a-valid-url',
  ])('should never load a non-web URL into the frame: %s', (url) => {
    const { container } = render(<StorylaneTour title={TITLE} url={url} />);

    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText('label.invalid-url')).toBeInTheDocument();
  });

  it('should render iframe with correct URL and title', () => {
    render(<StorylaneTour title={TITLE} url={DEMO_URL} />);

    expect(screen.getByTitle(TITLE)).toHaveAttribute('src', DEMO_URL);
  });

  it('should have sandbox attribute for security', () => {
    render(<StorylaneTour title={TITLE} url={DEMO_URL} />);

    expect(screen.getByTitle(TITLE).getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-presentation allow-popups allow-forms'
    );
  });

  it('should hide loading spinner after iframe loads', () => {
    render(<StorylaneTour title={TITLE} url={DEMO_URL} />);

    fireEvent.load(screen.getByTitle(TITLE));

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('should keep the 16:9 player box unless asked to fill', () => {
    const { container, rerender } = render(
      <StorylaneTour title={TITLE} url={DEMO_URL} />
    );

    expect(container.firstChild).not.toHaveClass(
      'storylane-tour-wrapper--fill'
    );

    rerender(<StorylaneTour fill title={TITLE} url={DEMO_URL} />);

    expect(container.firstChild).toHaveClass('storylane-tour-wrapper--fill');
  });

  it('should add the caller class to the wrapper', () => {
    const { container } = render(
      <StorylaneTour className="custom-class" title={TITLE} url={DEMO_URL} />
    );

    expect(container.firstChild).toHaveClass(
      'storylane-tour-wrapper',
      'custom-class'
    );
  });

  it('should not have allowFullScreen to use modal expand with visible minimize', () => {
    render(<StorylaneTour title={TITLE} url={DEMO_URL} />);

    expect(screen.getByTitle(TITLE)).not.toHaveAttribute('allowfullscreen');
  });
});
