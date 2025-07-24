/*
 *  Copyright 2025 Collate.
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
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { DomainType } from '../../../../generated/entity/domains/domain';
import i18n from '../../../../utils/i18next/LocalUtil';
import { EntityData } from '../EntityTable.interface';
import GridView from './GridView.component';

// Mock the SVG components
jest.mock('../../../../assets/svg/ic-layers-white.svg', () => ({
  ReactComponent: () => <div data-testid="layers-icon">LayersIcon</div>,
}));

jest.mock('../../../../assets/svg/ic-tag-gray.svg', () => ({
  ReactComponent: () => <div data-testid="tag-icon">TagIcon</div>,
}));

jest.mock('../../../../assets/svg/tags/ic-aggregate.svg', () => ({
  ReactComponent: () => <div data-testid="aggregate-icon">AggregateIcon</div>,
}));

jest.mock('../../../../assets/svg/tags/ic-consumer-aligned.svg', () => ({
  ReactComponent: () => (
    <div data-testid="consumer-aligned-icon">ConsumerAlignedIcon</div>
  ),
}));

jest.mock('../../../../assets/svg/tags/ic-source-aligned.svg', () => ({
  ReactComponent: () => (
    <div data-testid="source-aligned-icon">SourceAlignedIcon</div>
  ),
}));

// Mock RichTextEditorPreviewerV1
jest.mock('../../RichTextEditor/RichTextEditorPreviewerV1', () => {
  return function MockRichTextEditorPreviewerV1({
    markdown,
  }: {
    markdown: string;
  }) {
    return <div data-testid="rich-text-previewer">{markdown}</div>;
  };
});

const mockEntityData: EntityData = {
  id: 'test-entity-1',
  name: 'Test Entity',
  displayName: 'Test Entity Display',
  description: 'Test entity description',
  fullyQualifiedName: 'test.entity',
  domainType: DomainType.Aggregate,
  tags: [
    {
      tagFQN: 'test.tag.1',
      name: 'Test Tag 1',
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
    {
      tagFQN: 'glossary.term.1',
      name: 'Glossary Term 1',
      source: 'Glossary',
      labelType: 'Manual',
      state: 'Confirmed',
    },
  ],
  owners: [
    {
      id: 'owner-1',
      name: 'test-owner',
      displayName: 'Test Owner',
      type: 'user',
    },
  ],
};

const mockEntityDataWithMultipleOwners: EntityData = {
  ...mockEntityData,
  id: 'test-entity-2',
  owners: [
    {
      id: 'owner-1',
      name: 'test-owner-1',
      displayName: 'Test Owner 1',
      type: 'user',
    },
    {
      id: 'owner-2',
      name: 'test-owner-2',
      displayName: 'Test Owner 2',
      type: 'user',
    },
    {
      id: 'owner-3',
      name: 'test-owner-3',
      displayName: 'Test Owner 3',
      type: 'user',
    },
    {
      id: 'owner-4',
      name: 'test-owner-4',
      displayName: 'Test Owner 4',
      type: 'user',
    },
    {
      id: 'owner-5',
      name: 'test-owner-5',
      displayName: 'Test Owner 5',
      type: 'user',
    },
  ],
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>{component}</I18nextProvider>
    </BrowserRouter>
  );
};

describe('GridView Component', () => {
  it('should render without crashing', () => {
    renderWithProviders(<GridView data={[mockEntityData]} loading={false} />);

    expect(screen.getByText('Test Entity Display')).toBeInTheDocument();
  });

  it('should display entity cards with proper content', () => {
    renderWithProviders(<GridView data={[mockEntityData]} loading={false} />);

    // Check if entity name is displayed
    expect(screen.getByText('Test Entity Display')).toBeInTheDocument();

    // Check if domain type is displayed
    expect(screen.getByText('Aggregate')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    renderWithProviders(<GridView loading data={[]} />);

    // Ant Design List component shows loading spinner when loading is true
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('should handle empty data', () => {
    renderWithProviders(<GridView data={[]} loading={false} />);

    // Should render the List component even with empty data
    expect(document.querySelector('.ant-list')).toBeInTheDocument();
  });

  it('should display glossary terms and tags', () => {
    renderWithProviders(<GridView data={[mockEntityData]} loading={false} />);

    // Check if glossary term is displayed
    expect(screen.getByText('Glossary Term 1')).toBeInTheDocument();

    // Check if tag is displayed
    expect(screen.getByText('Test Tag 1')).toBeInTheDocument();
  });

  it('should display multiple owners with count indicator', () => {
    renderWithProviders(
      <GridView data={[mockEntityDataWithMultipleOwners]} loading={false} />
    );

    // Should show +1 for the additional owner (shows 4, +1 for remaining)
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('should display single owner with name text', () => {
    renderWithProviders(<GridView data={[mockEntityData]} loading={false} />);

    // Should show owner name for single owner
    expect(screen.getByText('Test Owner')).toBeInTheDocument();
  });

  it('should display initials when no profile image is available', () => {
    const mockDataWithNoProfileImage = {
      ...mockEntityData,
      owners: [
        {
          id: 'owner-1',
          name: 'john-doe',
          displayName: 'John Doe',
          type: 'user',
        },
      ],
    };

    renderWithProviders(
      <GridView data={[mockDataWithNoProfileImage]} loading={false} />
    );

    // Should show initials when no profile image
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should show tooltips on owner avatars for multiple owners', () => {
    renderWithProviders(
      <GridView data={[mockEntityDataWithMultipleOwners]} loading={false} />
    );

    // Check if tooltips are present (they are rendered as title attributes)
    const avatars = document.querySelectorAll('.entity-card-owner-avatar');

    expect(avatars.length).toBeGreaterThan(0);
  });

  it('should use RichTextEditorPreviewerV1 for description', () => {
    renderWithProviders(<GridView data={[mockEntityData]} loading={false} />);

    // Should render the mocked RichTextEditorPreviewerV1
    expect(screen.getByTestId('rich-text-previewer')).toBeInTheDocument();
    expect(screen.getByText('Test entity description')).toBeInTheDocument();
  });

  it('should display exactly 4 visible owners and +X count as avatar with names tooltip', () => {
    const mockDataWith7Owners: EntityData = {
      ...mockEntityData,
      id: 'test-entity-7-owners',
      owners: [
        {
          id: 'owner-1',
          name: 'owner-1',
          displayName: 'Owner 1',
          type: 'user',
        },
        {
          id: 'owner-2',
          name: 'owner-2',
          displayName: 'Owner 2',
          type: 'user',
        },
        {
          id: 'owner-3',
          name: 'owner-3',
          displayName: 'Owner 3',
          type: 'user',
        },
        {
          id: 'owner-4',
          name: 'owner-4',
          displayName: 'Owner 4',
          type: 'user',
        },
        {
          id: 'owner-5',
          name: 'owner-5',
          displayName: 'Owner 5',
          type: 'user',
        },
        {
          id: 'owner-6',
          name: 'owner-6',
          displayName: 'Owner 6',
          type: 'user',
        },
        {
          id: 'owner-7',
          name: 'owner-7',
          displayName: 'Owner 7',
          type: 'user',
        },
      ],
    };

    renderWithProviders(
      <GridView data={[mockDataWith7Owners]} loading={false} />
    );

    // Should show +3 for the additional owners (shows 4, +3 for remaining 7-4=3)
    expect(screen.getByText('+3')).toBeInTheDocument();

    // Should have exactly 5 avatar elements (4 owners + 1 count avatar)
    const avatars = document.querySelectorAll('.entity-card-owner-avatar');

    expect(avatars).toHaveLength(5);

    // Should have the count avatar with special class
    const countAvatar = document.querySelector('.entity-card-owners-count');

    expect(countAvatar).toBeInTheDocument();
    expect(countAvatar).toHaveTextContent('+3');
  });
});
