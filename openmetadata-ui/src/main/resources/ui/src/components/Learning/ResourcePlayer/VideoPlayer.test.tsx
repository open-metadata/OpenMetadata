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
import { VideoPlayer } from './VideoPlayer.component';

const createMockResource = (url: string): LearningResource => ({
  id: 'test-id',
  name: 'test-video',
  displayName: 'Test Video',
  resourceType: 'Video',
  source: { url },
  contexts: [{ pageId: 'glossary' }],
});

describe('VideoPlayer', () => {
  it('should render loading spinner initially', () => {
    const resource = createMockResource(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    render(<VideoPlayer resource={resource} />);

    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('should render iframe with correct YouTube embed URL', () => {
    const resource = createMockResource(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');

    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('src')).toContain(
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
  });

  it('should handle YouTube short URL format', () => {
    const resource = createMockResource('https://youtu.be/dQw4w9WgXcQ');
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');

    expect(iframe.getAttribute('src')).toContain(
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
  });

  it('should preserve YouTube embed URL as-is', () => {
    const resource = createMockResource(
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');

    expect(iframe.getAttribute('src')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
  });

  it('should handle Vimeo URL format', () => {
    const resource = createMockResource('https://vimeo.com/123456789');
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');

    expect(iframe.getAttribute('src')).toBe(
      'https://player.vimeo.com/video/123456789'
    );
  });

  it('should handle Vimeo player URL format', () => {
    const resource = createMockResource(
      'https://player.vimeo.com/video/123456789'
    );
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');

    expect(iframe.getAttribute('src')).toBe(
      'https://player.vimeo.com/video/123456789'
    );
  });

  it('should use original URL for unknown video providers', () => {
    const resource = createMockResource('https://example.com/video.mp4');
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');

    expect(iframe.getAttribute('src')).toBe('https://example.com/video.mp4');
  });

  it('should have sandbox attribute for security', () => {
    const resource = createMockResource(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');

    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-presentation allow-popups'
    );
  });

  it('should hide loading spinner after iframe loads', () => {
    const resource = createMockResource(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');
    fireEvent.load(iframe);

    expect(document.querySelector('.ant-spin')).not.toBeInTheDocument();
  });

  it('should use resource name as title fallback', () => {
    const resource: LearningResource = {
      id: 'test-id',
      name: 'test-video-name',
      resourceType: 'Video',
      source: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      contexts: [{ pageId: 'glossary' }],
    };
    render(<VideoPlayer resource={resource} />);

    expect(screen.getByTitle('test-video-name')).toBeInTheDocument();
  });

  it('should handle invalid URL gracefully', () => {
    const resource = createMockResource('not-a-valid-url');
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');

    expect(iframe.getAttribute('src')).toBe('not-a-valid-url');
  });

  it('should reject URLs with youtube.com in path but different host', () => {
    const resource = createMockResource(
      'https://malicious-site.com/youtube.com/watch?v=abc123'
    );
    render(<VideoPlayer resource={resource} />);

    const iframe = screen.getByTitle('Test Video');

    expect(iframe.getAttribute('src')).toBe(
      'https://malicious-site.com/youtube.com/watch?v=abc123'
    );
  });
});
