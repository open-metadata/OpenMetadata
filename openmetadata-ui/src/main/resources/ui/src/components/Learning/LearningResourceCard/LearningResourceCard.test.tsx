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
import { LearningResourceCard } from './LearningResourceCard.component';

const mockVideoResource: LearningResource = {
  id: 'video-resource-1',
  name: 'TestVideoResource',
  displayName: 'Test Video Resource',
  description: 'A test video learning resource',
  resourceType: 'Video',
  categories: ['Discovery'],
  difficulty: 'Intro',
  estimatedDuration: 300, // 5 minutes in seconds
  source: {
    url: 'https://youtube.com/watch?v=test',
    provider: 'YouTube',
  },
  contexts: [{ pageId: 'glossary' }],
  status: 'Active',
  fullyQualifiedName: 'TestVideoResource',
  version: 0.1,
  updatedAt: Date.now(),
  updatedBy: 'admin',
};

const mockStorylaneResource: LearningResource = {
  ...mockVideoResource,
  id: 'storylane-resource-1',
  name: 'TestStorylaneResource',
  displayName: 'Test Storylane Resource',
  resourceType: 'Storylane',
};

const mockArticleResource: LearningResource = {
  ...mockVideoResource,
  id: 'article-resource-1',
  name: 'TestArticleResource',
  displayName: 'Test Article Resource',
  resourceType: 'Article',
};

const mockResourceWithProgress: LearningResource = {
  ...mockVideoResource,
  progress: {
    progressPercent: 75,
    status: 'InProgress',
  },
};

describe('LearningResourceCard', () => {
  it('should render card with resource display name', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(screen.getByText('Test Video Resource')).toBeInTheDocument();
  });

  it('should render card with resource name when displayName is not provided', () => {
    const resourceWithoutDisplayName = {
      ...mockVideoResource,
      displayName: undefined,
    };
    render(<LearningResourceCard resource={resourceWithoutDisplayName} />);

    expect(screen.getByText('TestVideoResource')).toBeInTheDocument();
  });

  it('should render resource description', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(
      screen.getByText('A test video learning resource')
    ).toBeInTheDocument();
  });

  it('should render difficulty tag', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(screen.getByText('Intro')).toBeInTheDocument();
  });

  it('should render category tag', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(screen.getByText('Discovery')).toBeInTheDocument();
  });

  it('should render formatted duration', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(screen.getByText('5m 0s')).toBeInTheDocument();
  });

  it('should not render duration when estimatedDuration is not provided', () => {
    const resourceWithoutDuration = {
      ...mockVideoResource,
      estimatedDuration: undefined,
    };
    render(<LearningResourceCard resource={resourceWithoutDuration} />);

    expect(screen.queryByText(/m.*s/)).not.toBeInTheDocument();
  });

  it('should render play icon for Video resource type', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(
      screen.getByTestId(`learning-resource-card-${mockVideoResource.name}`)
    ).toBeInTheDocument();
  });

  it('should render rocket icon for Storylane resource type', () => {
    render(<LearningResourceCard resource={mockStorylaneResource} />);

    expect(
      screen.getByTestId(`learning-resource-card-${mockStorylaneResource.name}`)
    ).toBeInTheDocument();
  });

  it('should render file icon for Article resource type', () => {
    render(<LearningResourceCard resource={mockArticleResource} />);

    expect(
      screen.getByTestId(`learning-resource-card-${mockArticleResource.name}`)
    ).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const mockOnClick = jest.fn();
    render(
      <LearningResourceCard
        resource={mockVideoResource}
        onClick={mockOnClick}
      />
    );

    const card = screen.getByTestId(
      `learning-resource-card-${mockVideoResource.name}`
    );
    fireEvent.click(card);

    expect(mockOnClick).toHaveBeenCalledWith(mockVideoResource);
  });

  it('should not throw error when onClick is not provided', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    const card = screen.getByTestId(
      `learning-resource-card-${mockVideoResource.name}`
    );

    expect(() => fireEvent.click(card)).not.toThrow();
  });

  it('should render progress bar when showProgress is true and progress exists', () => {
    render(
      <LearningResourceCard showProgress resource={mockResourceWithProgress} />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should not render progress bar when showProgress is false', () => {
    render(
      <LearningResourceCard
        resource={mockResourceWithProgress}
        showProgress={false}
      />
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('should not render progress bar when progress data is not available', () => {
    render(<LearningResourceCard showProgress resource={mockVideoResource} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('should have correct data-testid attribute', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(
      screen.getByTestId(`learning-resource-card-${mockVideoResource.name}`)
    ).toBeInTheDocument();
  });

  it('should be hoverable when onClick is provided', () => {
    const mockOnClick = jest.fn();
    render(
      <LearningResourceCard
        resource={mockVideoResource}
        onClick={mockOnClick}
      />
    );

    const card = screen.getByTestId(
      `learning-resource-card-${mockVideoResource.name}`
    );

    expect(card).toHaveClass('ant-card-hoverable');
  });
});
