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
import { ResourcePlayerModal } from './ResourcePlayerModal.component';

jest.mock('./VideoPlayer.component', () => ({
  VideoPlayer: jest
    .fn()
    .mockImplementation(() => <div data-testid="video-player" />),
}));

jest.mock('./StorylaneTour.component', () => ({
  StorylaneTour: jest
    .fn()
    .mockImplementation(() => <div data-testid="storylane-tour" />),
}));

const mockOnClose = jest.fn();

const createMockResource = (
  resourceType: 'Video' | 'Storylane',
  overrides?: Partial<LearningResource>
): LearningResource => ({
  id: 'test-id',
  name: 'test-resource',
  displayName: 'Test Resource',
  description: 'This is a test resource description',
  resourceType,
  source: { url: 'https://example.com/resource' },
  contexts: [{ pageId: 'glossary' }],
  categories: ['Discovery', 'DataGovernance'],
  estimatedDuration: 300,
  updatedAt: 1704067200000,
  ...overrides,
});

describe('ResourcePlayerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal when open is true', () => {
    const resource = createMockResource('Video');
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(screen.getByText('Test Resource')).toBeInTheDocument();
  });

  it('should not render modal content when open is false', () => {
    const resource = createMockResource('Video');
    render(
      <ResourcePlayerModal
        open={false}
        resource={resource}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Test Resource')).not.toBeInTheDocument();
  });

  it('should render VideoPlayer for Video resource type', () => {
    const resource = createMockResource('Video');
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(screen.getByTestId('video-player')).toBeInTheDocument();
  });

  it('should render StorylaneTour for Storylane resource type', () => {
    const resource = createMockResource('Storylane');
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(screen.getByTestId('storylane-tour')).toBeInTheDocument();
  });

  it('should display resource description', () => {
    const resource = createMockResource('Video');
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(
      screen.getByLabelText('This is a test resource description')
    ).toBeInTheDocument();
  });

  it('should display category tags', () => {
    const resource = createMockResource('Video');
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('Governance')).toBeInTheDocument();
  });

  it('should display formatted duration with min watch for Video', () => {
    const resource = createMockResource('Video');
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(screen.getByText('5 label.min-watch')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const resource = createMockResource('Video');
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should use resource name as fallback when displayName is not provided', () => {
    const resource = createMockResource('Video', {
      displayName: undefined,
    });
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(screen.getByText('test-resource')).toBeInTheDocument();
  });

  it('should display all category tags when more than 3 categories', () => {
    const resource = createMockResource('Video', {
      categories: [
        'Discovery',
        'DataGovernance',
        'Observability',
        'DataQuality',
        'Administration',
      ],
    });
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('Governance')).toBeInTheDocument();
    expect(screen.getByText('Observability')).toBeInTheDocument();
    expect(screen.getByText('Data Quality')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should not display duration when not provided', () => {
    const resource = createMockResource('Video', {
      estimatedDuration: undefined,
    });
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(screen.queryByText(/label.min-watch/)).not.toBeInTheDocument();
  });

  it('should not display description section when description is not provided', () => {
    const resource = createMockResource('Video', {
      description: undefined,
    });
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(
      screen.queryByLabelText(/test resource description/i)
    ).not.toBeInTheDocument();
  });

  it('should display unsupported message for unknown resource type', () => {
    const resource = createMockResource('Video', {
      resourceType: 'UnknownType' as 'Video',
    });
    render(
      <ResourcePlayerModal open resource={resource} onClose={mockOnClose} />
    );

    expect(
      screen.getByText('message.unsupported-resource-type')
    ).toBeInTheDocument();
  });
});
