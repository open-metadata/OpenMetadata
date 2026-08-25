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
import { render, screen, waitFor } from '@testing-library/react';
import { getLearningResourcesByContext } from '../../../rest/learningResourceAPI';
import { LearningDrawer } from './LearningDrawer.component';

jest.mock('../../../rest/learningResourceAPI', () => ({
  getLearningResourcesByContext: jest.fn(),
}));

jest.mock('../LearningResourceCard/LearningResourceCard.component', () => ({
  LearningResourceCard: jest
    .fn()
    .mockImplementation(({ resource }) => (
      <div data-testid="learning-resource-card">{resource.name}</div>
    )),
}));

jest.mock('../ResourcePlayer/ResourcePlayerModal.component', () => ({
  ResourcePlayerModal: jest
    .fn()
    .mockImplementation(() => <div data-testid="resource-player-modal" />),
}));

const mockOnClose = jest.fn();

const mockResources = [
  {
    id: '1',
    name: 'Test Resource 1',
    displayName: 'Test Resource 1',
    resourceType: 'Video',
    categories: ['Discovery'],
    source: { url: 'https://example.com/video1' },
    contexts: [{ pageId: 'glossary' }],
  },
  {
    id: '2',
    name: 'Test Resource 2',
    displayName: 'Test Resource 2',
    resourceType: 'Article',
    categories: ['DataGovernance'],
    source: { url: 'https://example.com/article' },
    contexts: [{ pageId: 'glossary' }],
  },
];

describe('LearningDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (getLearningResourcesByContext as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <LearningDrawer
        open
        pageId="glossary"
        title="Glossary"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should render resources when loaded successfully', async () => {
    (getLearningResourcesByContext as jest.Mock).mockResolvedValue({
      data: mockResources,
    });

    render(
      <LearningDrawer
        open
        pageId="glossary"
        title="Glossary"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('learning-resource-card')).toHaveLength(2);
    });
  });

  it('should render empty state when no resources found', async () => {
    (getLearningResourcesByContext as jest.Mock).mockResolvedValue({
      data: [],
    });

    render(
      <LearningDrawer
        open
        pageId="glossary"
        title="Glossary"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('message.no-learning-resources-available')
      ).toBeInTheDocument();
    });
  });

  it('should render error state when API fails', async () => {
    (getLearningResourcesByContext as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    render(
      <LearningDrawer
        open
        pageId="glossary"
        title="Glossary"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('message.failed-to-load-learning-resources')
      ).toBeInTheDocument();
    });
  });

  it('should not fetch resources when drawer is closed', () => {
    render(
      <LearningDrawer
        open={false}
        pageId="glossary"
        title="Glossary"
        onClose={mockOnClose}
      />
    );

    expect(getLearningResourcesByContext).not.toHaveBeenCalled();
  });

  it('should render close button', async () => {
    (getLearningResourcesByContext as jest.Mock).mockResolvedValue({
      data: mockResources,
    });

    render(
      <LearningDrawer
        open
        pageId="glossary"
        title="Glossary"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('close-drawer')).toBeInTheDocument();
    });
  });
});
