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
import { LearningResource } from '../../../rest/learningResourceAPI';
import { StorylaneTour } from './StorylaneTour.component';

const TEST_STORYLANE_TOUR = 'Test Storylane Tour';
const HTTPS_APP_STORYLANE_IO_DEMO_ABC123 =
  'https://app.storylane.io/demo/abc123';

const createMockResource = (url: string): LearningResource => ({
  id: 'test-id',
  name: 'test-storylane',
  displayName: TEST_STORYLANE_TOUR,
  resourceType: 'Storylane',
  source: { url },
  contexts: [{ pageId: 'glossary' }],
});

describe('StorylaneTour', () => {
  it('should render loading spinner initially', () => {
    const resource = createMockResource(HTTPS_APP_STORYLANE_IO_DEMO_ABC123);
    render(<StorylaneTour resource={resource} />);

    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('should render iframe with correct URL', () => {
    const resource = createMockResource(HTTPS_APP_STORYLANE_IO_DEMO_ABC123);
    render(<StorylaneTour resource={resource} />);

    const iframe = screen.getByTitle(TEST_STORYLANE_TOUR);

    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('src')).toBe(HTTPS_APP_STORYLANE_IO_DEMO_ABC123);
  });

  it('should have sandbox attribute for security', () => {
    const resource = createMockResource(HTTPS_APP_STORYLANE_IO_DEMO_ABC123);
    render(<StorylaneTour resource={resource} />);

    const iframe = screen.getByTitle(TEST_STORYLANE_TOUR);

    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-presentation allow-popups allow-forms'
    );
  });

  it('should hide loading spinner after iframe loads', () => {
    const resource = createMockResource(HTTPS_APP_STORYLANE_IO_DEMO_ABC123);
    render(<StorylaneTour resource={resource} />);

    const iframe = screen.getByTitle(TEST_STORYLANE_TOUR);
    fireEvent.load(iframe);

    expect(document.querySelector('.ant-spin')).not.toBeInTheDocument();
  });

  it('should use resource name as title fallback', () => {
    const resource: LearningResource = {
      id: 'test-id',
      name: 'storylane-name',
      resourceType: 'Storylane',
      source: { url: HTTPS_APP_STORYLANE_IO_DEMO_ABC123 },
      contexts: [{ pageId: 'glossary' }],
    };
    render(<StorylaneTour resource={resource} />);

    expect(screen.getByTitle('storylane-name')).toBeInTheDocument();
  });

  it('should not have allowFullScreen to use modal expand with visible minimize', () => {
    const resource = createMockResource(HTTPS_APP_STORYLANE_IO_DEMO_ABC123);
    render(<StorylaneTour resource={resource} />);

    const iframe = screen.getByTitle(TEST_STORYLANE_TOUR);

    expect(iframe).not.toHaveAttribute('allowfullscreen');
  });
});
