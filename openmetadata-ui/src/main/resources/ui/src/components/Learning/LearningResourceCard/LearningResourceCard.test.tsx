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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { entity?: string }) => {
      const translations: Record<string, string> = {
        'label.min-read': 'min read',
        'label.min-watch': 'min watch',
        'label.view-more': 'View More',
        'label.view-less': 'View Less',
        'label.no-entity-added': 'No {{entity}} added',
        'label.description-lowercase': 'description',
        'label.category-lowercase': 'category',
      };
      const value = translations[key] ?? key;
      if (
        options?.entity &&
        typeof value === 'string' &&
        value.includes('{{entity}}')
      ) {
        return value.replace('{{entity}}', options.entity);
      }

      return value;
    },
  }),
}));

const mockVideoResource: LearningResource = {
  id: 'video-resource-1',
  name: 'TestVideoResource',
  displayName: 'Test Video Resource',
  description: 'A test video learning resource',
  resourceType: 'Video',
  categories: ['Discovery'],
  difficulty: 'Intro',
  estimatedDuration: 300,
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

const mockResourceWithMultipleCategories: LearningResource = {
  ...mockVideoResource,
  categories: ['Discovery', 'Administration', 'DataGovernance', 'DataQuality'],
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
      screen.getByText(/A test video learning resource/i)
    ).toBeInTheDocument();
  });

  it('should render description with ellipsis configuration', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    const descriptionElement = screen.getByTestId(
      'learning-resource-description'
    );

    expect(descriptionElement).toBeInTheDocument();
    expect(descriptionElement).toHaveTextContent(
      'A test video learning resource'
    );
  });

  it('should render category tag', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(screen.getByText('Discovery')).toBeInTheDocument();
  });

  it('should render formatted duration with min watch for Video', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(screen.getByText('5 min watch')).toBeInTheDocument();
  });

  it('should render formatted duration with min read for Article', () => {
    render(<LearningResourceCard resource={mockArticleResource} />);

    expect(screen.getByText('5 min read')).toBeInTheDocument();
  });

  it('should not render duration when estimatedDuration is not provided', () => {
    const resourceWithoutDuration = {
      ...mockVideoResource,
      estimatedDuration: undefined,
    };
    render(<LearningResourceCard resource={resourceWithoutDuration} />);

    expect(screen.queryByText(/min (read|watch)/)).not.toBeInTheDocument();
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

  it('should have correct data-testid attribute', () => {
    render(<LearningResourceCard resource={mockVideoResource} />);

    expect(
      screen.getByTestId(`learning-resource-card-${mockVideoResource.name}`)
    ).toBeInTheDocument();
  });

  it('should be clickable when onClick is provided', () => {
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

    expect(card).toHaveAttribute('data-clickable', 'true');
  });

  it('should show only first 2 categories and +N for remaining in card view', () => {
    render(
      <LearningResourceCard resource={mockResourceWithMultipleCategories} />
    );

    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('should show no description placeholder when description is not provided', () => {
    const resourceWithoutDescription = {
      ...mockVideoResource,
      description: undefined,
    };
    render(<LearningResourceCard resource={resourceWithoutDescription} />);

    expect(
      screen.getByTestId('learning-resource-description')
    ).toBeInTheDocument();
    expect(screen.getByText('No description added')).toBeInTheDocument();
  });
});
