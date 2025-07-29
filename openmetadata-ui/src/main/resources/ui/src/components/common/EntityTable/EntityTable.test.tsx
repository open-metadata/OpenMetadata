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
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import i18n from '../../../utils/i18next/LocalUtil';
import EntityTable from './EntityTable.component';

// Mock the SVG components
jest.mock('../../../assets/svg/ic-tag-gray.svg', () => ({
  ReactComponent: () => <div data-testid="tag-icon">TagIcon</div>,
}));

jest.mock('../../../assets/svg/ic-grid-view.svg', () => ({
  ReactComponent: () => <div data-testid="grid-view-icon">GridViewIcon</div>,
}));

jest.mock('../../../assets/svg/ic-list-layout.svg', () => ({
  ReactComponent: () => <div data-testid="list-view-icon">ListViewIcon</div>,
}));

jest.mock('../../../assets/svg/ic-input-search.svg', () => ({
  ReactComponent: () => <div data-testid="search-icon">SearchIcon</div>,
}));

jest.mock('../../../assets/svg/ic-layers-white.svg', () => ({
  ReactComponent: () => <div data-testid="layers-icon">LayersIcon</div>,
}));

jest.mock('../../../assets/svg/drop-down.svg', () => ({
  ReactComponent: () => <div data-testid="dropdown-icon">DropDownIcon</div>,
}));

jest.mock('../../../assets/svg/delete-colored.svg', () => 'delete-icon.svg');

// Mock the domain type icons
jest.mock('../../../assets/svg/tags/ic-aggregate.svg', () => ({
  ReactComponent: () => <div data-testid="aggregate-icon">AggregateIcon</div>,
}));

jest.mock('../../../assets/svg/tags/ic-consumer-aligned.svg', () => ({
  ReactComponent: () => (
    <div data-testid="consumer-aligned-icon">ConsumerAlignedIcon</div>
  ),
}));

jest.mock('../../../assets/svg/tags/ic-source-aligned.svg', () => ({
  ReactComponent: () => (
    <div data-testid="source-aligned-icon">SourceAlignedIcon</div>
  ),
}));

const mockDomain: Domain = {
  id: 'test-domain-1',
  name: 'Test Domain',
  displayName: 'Test Domain Display',
  description: 'Test domain description',
  fullyQualifiedName: 'test.domain',
  domainType: DomainType.ConsumerAligned,
  tags: [
    {
      tagFQN: 'test.tag.1',
      name: 'Test Tag 1',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    } as TagLabel,
    {
      tagFQN: 'glossary.term.1',
      name: 'Glossary Term 1',
      source: TagSource.Glossary,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    } as TagLabel,
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

const mockDataProduct: DataProduct = {
  id: 'test-data-product-1',
  name: 'Test Data Product',
  displayName: 'Test Data Product Display',
  description: 'Test data product description',
  fullyQualifiedName: 'test.data.product',
  tags: [
    {
      tagFQN: 'test.tag.2',
      name: 'Test Tag 2',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    } as TagLabel,
    {
      tagFQN: 'test.tag.3',
      name: 'Test Tag 3',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    } as TagLabel,
  ],
  owners: [
    {
      id: 'owner-2',
      name: 'test-owner-2',
      displayName: 'Test Owner 2',
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

describe('EntityTable', () => {
  describe('Tags Badge Rendering', () => {
    it('should render tags badge with correct styling for domains', () => {
      renderWithProviders(<EntityTable data={[mockDomain]} type="domains" />);

      // Check if tag icon is rendered
      expect(screen.getByTestId('tag-icon')).toBeInTheDocument();

      // Check if tag text is rendered
      expect(screen.getByText('Test Tag 1')).toBeInTheDocument();

      // Check if the badge has the correct class
      const tagBadge = screen.getByText('Test Tag 1').closest('.tags-badge');

      expect(tagBadge).toBeInTheDocument();
    });

    it('should render tags badge with correct styling for data products', () => {
      renderWithProviders(
        <EntityTable data={[mockDataProduct]} type="data-products" />
      );

      // Check if tag icons are rendered
      expect(screen.getAllByTestId('tag-icon')).toHaveLength(2);

      // Check if tag texts are rendered
      expect(screen.getByText('Test Tag 2')).toBeInTheDocument();
      expect(screen.getByText('Test Tag 3')).toBeInTheDocument();

      // Check if the badges have the correct class
      const tagBadges = screen
        .getAllByText(/Test Tag/)
        .map((el) => el.closest('.tags-badge'));

      expect(tagBadges).toHaveLength(2);

      tagBadges.forEach((badge) => {
        expect(badge).toBeInTheDocument();
      });
    });

    it('should not render glossary terms as tags', () => {
      renderWithProviders(<EntityTable data={[mockDomain]} type="domains" />);

      // Glossary term should not be rendered as a tag
      expect(screen.queryByText('Glossary Term 1')).not.toBeInTheDocument();
    });

    it('should show dash when no tags are present', () => {
      const domainWithoutTags: Domain = {
        ...mockDomain,
        tags: [],
      };

      renderWithProviders(
        <EntityTable data={[domainWithoutTags]} type="domains" />
      );

      // Should show dash for empty tags
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('should render multiple tags with proper spacing', () => {
      renderWithProviders(
        <EntityTable data={[mockDataProduct]} type="data-products" />
      );

      const tagBadges = screen
        .getAllByText(/Test Tag/)
        .map((el) => el.closest('.tags-badge'));

      // Should have 2 tag badges
      expect(tagBadges).toHaveLength(2);

      // Each badge should have the tag icon
      tagBadges.forEach((badge) => {
        expect(
          badge?.querySelector('[data-testid="tag-icon"]')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Tags Badge Styling', () => {
    it('should apply correct CSS classes to tags badge', () => {
      renderWithProviders(<EntityTable data={[mockDomain]} type="domains" />);

      const tagBadge = screen.getByText('Test Tag 1').closest('.tags-badge');

      // Check if the badge has the correct classes
      expect(tagBadge).toHaveClass('entity-badge', 'tags-badge');
    });

    it('should render tag icon with correct styling', () => {
      renderWithProviders(<EntityTable data={[mockDomain]} type="domains" />);

      const tagIcon = screen.getByTestId('tag-icon');
      const tagBadge = tagIcon.closest('.tags-badge');

      // Tag icon should be inside the badge
      expect(tagBadge).toContainElement(tagIcon);
    });

    it('should render tag text with correct styling', () => {
      renderWithProviders(<EntityTable data={[mockDomain]} type="domains" />);

      const tagText = screen.getByText('Test Tag 1');
      const tagBadge = tagText.closest('.tags-badge');

      // Tag text should be inside the badge
      expect(tagBadge).toContainElement(tagText);

      // Tag text should have the correct class
      expect(tagText).toHaveClass('tag-text');
    });
  });

  describe('Tags Badge Functionality', () => {
    it('should handle tags with missing names by using tagFQN', () => {
      const domainWithFQNOnly: Domain = {
        ...mockDomain,
        tags: [
          {
            tagFQN: 'test.tag.fqn.only',
            source: TagSource.Classification,
          } as TagLabel,
        ],
      };

      renderWithProviders(
        <EntityTable data={[domainWithFQNOnly]} type="domains" />
      );

      // Should display tagFQN when name is missing
      expect(screen.getByText('test.tag.fqn.only')).toBeInTheDocument();
    });

    it('should handle mixed tag sources correctly', () => {
      const domainWithMixedTags: Domain = {
        ...mockDomain,
        tags: [
          {
            tagFQN: 'test.tag.1',
            name: 'Test Tag 1',
            source: TagSource.Classification,
          } as TagLabel,
          {
            tagFQN: 'glossary.term.1',
            name: 'Glossary Term 1',
            source: TagSource.Glossary,
          } as TagLabel,
          {
            tagFQN: 'test.tag.2',
            name: 'Test Tag 2',
            source: TagSource.Classification,
          } as TagLabel,
        ],
      };

      renderWithProviders(
        <EntityTable data={[domainWithMixedTags]} type="domains" />
      );

      // Should only render non-glossary tags
      expect(screen.getByText('Test Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Test Tag 2')).toBeInTheDocument();
      expect(screen.queryByText('Glossary Term 1')).not.toBeInTheDocument();
    });
  });

  describe('Entity Icon Design', () => {
    it('should render entity icon with layers icon when no custom icon is provided', () => {
      renderWithProviders(<EntityTable data={[mockDomain]} type="domains" />);

      // Check if layers icon is rendered
      expect(screen.getByTestId('layers-icon')).toBeInTheDocument();

      // Check if the icon container has the correct structure
      const iconContainer = screen
        .getByTestId('layers-icon')
        .closest('.entity-icon-container');

      expect(iconContainer).toBeInTheDocument();

      // Check if the avatar container exists
      const avatarContainer = iconContainer?.querySelector(
        '.entity-icon-avatar'
      );

      expect(avatarContainer).toBeInTheDocument();
    });

    it('should render custom avatar when iconURL is provided', () => {
      const domainWithCustomIcon: Domain = {
        ...mockDomain,
        style: {
          iconURL: 'https://example.com/icon.png',
        },
      };

      renderWithProviders(
        <EntityTable data={[domainWithCustomIcon]} type="domains" />
      );

      // Should render avatar with custom icon
      const avatar = screen.getByRole('img');

      expect(avatar).toHaveAttribute('src', 'https://example.com/icon.png');

      // Should not render layers icon
      expect(screen.queryByTestId('layers-icon')).not.toBeInTheDocument();
    });

    it('should render multiple entity icons correctly', () => {
      renderWithProviders(
        <EntityTable data={[mockDomain, mockDataProduct]} type="domains" />
      );

      // Should render layers icons for both entities
      const layersIcons = screen.getAllByTestId('layers-icon');

      expect(layersIcons).toHaveLength(2);

      // Each icon should be in its own container
      layersIcons.forEach((icon) => {
        const container = icon.closest('.entity-icon-container');

        expect(container).toBeInTheDocument();
      });
    });

    it('should apply correct styling to entity icon container', () => {
      renderWithProviders(<EntityTable data={[mockDomain]} type="domains" />);

      const iconContainer = screen
        .getByTestId('layers-icon')
        .closest('.entity-icon-container');

      // Check if container has correct dimensions
      expect(iconContainer).toHaveStyle({
        width: '40px',
        height: '40px',
      });
    });

    it('should apply correct styling to entity icon avatar', () => {
      renderWithProviders(<EntityTable data={[mockDomain]} type="domains" />);

      const avatarContainer = screen
        .getByTestId('layers-icon')
        .closest('.entity-icon-avatar');

      // Check if avatar has correct styling
      expect(avatarContainer).toHaveStyle({
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: '#1470ef',
      });
    });

    it('should apply correct styling to layers icon', () => {
      renderWithProviders(<EntityTable data={[mockDomain]} type="domains" />);

      const layersIcon = screen.getByTestId('layers-icon');
      const iconElement = layersIcon.closest('.entity-icon-layers');

      // Check if icon has correct styling
      expect(iconElement).toHaveStyle({
        width: '24px',
        height: '24px',
        color: '#ffffff',
      });
    });
  });
});
