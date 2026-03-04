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
import { render } from '@testing-library/react';
import RichTextEditorPreviewerNew from '../components/common/RichTextEditor/RichTextEditorPreviewNew';
import { TAG_LIST_SIZE } from '../constants/constants';
import { TABLE_COLUMNS_KEYS } from '../constants/TableKeys.constants';
import { EntityType } from '../enums/entity.enum';
import { EntityReference } from '../generated/type/entityReference';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../generated/type/tagLabel';
import {
  dataProductTableObject,
  descriptionTableObject,
  domainTableObject,
  ownerTableObject,
  tagTableObject,
} from './TableColumn.util';

jest.mock('../components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(({ owners }) => (
      <div data-testid="owner-label">{owners?.length ?? 0}</div>
    )),
}));

jest.mock('../components/common/DomainLabel/DomainLabel.component', () => ({
  DomainLabel: jest
    .fn()
    .mockImplementation(({ domains }) => (
      <div data-testid="domain-label">{domains?.length ?? 0}</div>
    )),
}));

jest.mock(
  '../components/DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ dataProducts }) => (
        <div data-testid="data-products-container">
          {dataProducts?.length ?? 0}
        </div>
      )),
  })
);

jest.mock('../components/Tag/TagsViewer/TagsViewer', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ tags, sizeCap }) => (
    <div data-testid="tags-viewer">
      {tags?.length ?? 0}:{sizeCap}
    </div>
  )),
}));

jest.mock('../components/common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="rich-text-preview">{markdown}</div>
    ))
);

// since we have mocked the entire module, we need to unmock the util file to test it properly
jest.unmock('./TableColumn.util');

describe('TableColumn.util', () => {
  describe('ownerTableObject', () => {
    it('should return column configuration with correct structure', () => {
      const columns = ownerTableObject<{ owners?: EntityReference[] }>();

      expect(columns).toHaveLength(1);
      expect(columns[0]).toMatchObject({
        title: 'label.owner-plural',
        dataIndex: TABLE_COLUMNS_KEYS.OWNERS,
        key: TABLE_COLUMNS_KEYS.OWNERS,
        width: 280,
      });
    });

    it('should have filterIcon property', () => {
      const columns = ownerTableObject<{ owners?: EntityReference[] }>();

      expect(columns[0].filterIcon).toBeDefined();
      expect(typeof columns[0].filterIcon).toBe('function');
    });

    it('should have render function', () => {
      const columns = ownerTableObject<{ owners?: EntityReference[] }>();

      expect(columns[0].render).toBeDefined();
      expect(typeof columns[0].render).toBe('function');
    });

    it('should render OwnerLabel component with correct props', () => {
      const columns = ownerTableObject<{ owners?: EntityReference[] }>();
      const owners: EntityReference[] = [
        { id: '1', type: 'user', name: 'User1' },
        { id: '2', type: 'user', name: 'User2' },
      ];
      const renderResult = columns[0].render?.(owners, {} as never, 0);

      const { container } = render(<>{renderResult}</>);
      const ownerLabel = container.querySelector('[data-testid="owner-label"]');

      expect(ownerLabel).toBeInTheDocument();
      expect(ownerLabel?.textContent).toBe('2');
    });

    it('should render OwnerLabel with empty array when no owners provided', () => {
      const columns = ownerTableObject<{ owners?: EntityReference[] }>();
      const renderResult = columns[0].render?.([], {} as never, 0);

      const { container } = render(<>{renderResult}</>);
      const ownerLabel = container.querySelector('[data-testid="owner-label"]');

      expect(ownerLabel).toBeInTheDocument();
      expect(ownerLabel?.textContent).toBe('0');
    });

    it('should pass correct props to OwnerLabel component', () => {
      const columns = ownerTableObject<{ owners?: EntityReference[] }>();
      const owners: EntityReference[] = [
        { id: '1', type: 'user', name: 'User1' },
      ];
      const OwnerLabelMock = jest.requireMock(
        '../components/common/OwnerLabel/OwnerLabel.component'
      ).OwnerLabel;
      const renderResult = columns[0].render?.(owners, {} as never, 0);

      render(<>{renderResult}</>);

      expect(OwnerLabelMock).toHaveBeenCalledWith(
        {
          isCompactView: false,
          maxVisibleOwners: 4,
          owners,
          showLabel: false,
        },
        {}
      );
    });
  });

  describe('domainTableObject', () => {
    it('should return column configuration with correct structure', () => {
      const columns = domainTableObject<{ domains?: EntityReference[] }>();

      expect(columns).toHaveLength(1);
      expect(columns[0]).toMatchObject({
        title: 'label.domain-plural',
        dataIndex: TABLE_COLUMNS_KEYS.DOMAINS,
        key: TABLE_COLUMNS_KEYS.DOMAINS,
        width: 200,
      });
    });

    it('should have render function', () => {
      const columns = domainTableObject<{ domains?: EntityReference[] }>();

      expect(columns[0].render).toBeDefined();
      expect(typeof columns[0].render).toBe('function');
    });

    it('should render DomainLabel component with correct props', () => {
      const columns = domainTableObject<{ domains?: EntityReference[] }>();
      const domains: EntityReference[] = [
        { id: '1', type: 'domain', name: 'Domain1' },
        { id: '2', type: 'domain', name: 'Domain2' },
      ];
      const renderResult = columns[0].render?.(domains, {} as never, 0);

      const { container } = render(<>{renderResult}</>);
      const domainLabel = container.querySelector(
        '[data-testid="domain-label"]'
      );

      expect(domainLabel).toBeInTheDocument();
      expect(domainLabel?.textContent).toBe('2');
    });

    it('should render DomainLabel with empty array when no domains provided', () => {
      const columns = domainTableObject<{ domains?: EntityReference[] }>();
      const renderResult = columns[0].render?.([], {} as never, 0);

      const { container } = render(<>{renderResult}</>);
      const domainLabel = container.querySelector(
        '[data-testid="domain-label"]'
      );

      expect(domainLabel).toBeInTheDocument();
      expect(domainLabel?.textContent).toBe('0');
    });

    it('should pass correct props to DomainLabel component', () => {
      const columns = domainTableObject<{ domains?: EntityReference[] }>();
      const domains: EntityReference[] = [
        { id: '1', type: 'domain', name: 'Domain1' },
      ];
      const DomainLabelMock = jest.requireMock(
        '../components/common/DomainLabel/DomainLabel.component'
      ).DomainLabel;
      const renderResult = columns[0].render?.(domains, {} as never, 0);

      render(<>{renderResult}</>);

      expect(DomainLabelMock).toHaveBeenCalledWith(
        {
          domains,
          entityFqn: '',
          entityId: '',
          entityType: EntityType.TABLE,
          hasPermission: false,
        },
        {}
      );
    });
  });

  describe('dataProductTableObject', () => {
    it('should return column configuration with correct structure', () => {
      const columns = dataProductTableObject<{
        dataProducts?: EntityReference[];
      }>();

      expect(columns).toHaveLength(1);
      expect(columns[0]).toMatchObject({
        title: 'label.data-product-plural',
        dataIndex: TABLE_COLUMNS_KEYS.DATA_PRODUCTS,
        key: TABLE_COLUMNS_KEYS.DATA_PRODUCTS,
        width: 200,
      });
    });

    it('should have render function', () => {
      const columns = dataProductTableObject<{
        dataProducts?: EntityReference[];
      }>();

      expect(columns[0].render).toBeDefined();
      expect(typeof columns[0].render).toBe('function');
    });

    it('should render DataProductsContainer component with correct props', () => {
      const columns = dataProductTableObject<{
        dataProducts?: EntityReference[];
      }>();
      const dataProducts: EntityReference[] = [
        { id: '1', type: 'dataProduct', name: 'Product1' },
        { id: '2', type: 'dataProduct', name: 'Product2' },
      ];
      const renderResult = columns[0].render?.(dataProducts, {} as never, 0);

      const { container } = render(<>{renderResult}</>);
      const dataProductsContainer = container.querySelector(
        '[data-testid="data-products-container"]'
      );

      expect(dataProductsContainer).toBeInTheDocument();
      expect(dataProductsContainer?.textContent).toBe('2');
    });

    it('should render DataProductsContainer with empty array when no data products provided', () => {
      const columns = dataProductTableObject<{
        dataProducts?: EntityReference[];
      }>();
      const renderResult = columns[0].render?.([], {} as never, 0);

      const { container } = render(<>{renderResult}</>);
      const dataProductsContainer = container.querySelector(
        '[data-testid="data-products-container"]'
      );

      expect(dataProductsContainer).toBeInTheDocument();
      expect(dataProductsContainer?.textContent).toBe('0');
    });

    it('should pass correct props to DataProductsContainer component', () => {
      const columns = dataProductTableObject<{
        dataProducts?: EntityReference[];
      }>();
      const dataProducts: EntityReference[] = [
        { id: '1', type: 'dataProduct', name: 'Product1' },
      ];
      const DataProductsContainerMock = jest.requireMock(
        '../components/DataProducts/DataProductsContainer/DataProductsContainer.component'
      ).default;
      const renderResult = columns[0].render?.(dataProducts, {} as never, 0);

      render(<>{renderResult}</>);

      expect(DataProductsContainerMock).toHaveBeenCalledWith(
        {
          dataProducts,
          hasPermission: false,
          showHeader: false,
        },
        {}
      );
    });
  });

  describe('tagTableObject', () => {
    it('should return column configuration with correct structure', () => {
      const columns = tagTableObject<{ tags?: TagLabel[] }>();

      expect(columns).toHaveLength(1);
      expect(columns[0]).toMatchObject({
        title: 'label.tag-plural',
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        width: 240,
      });
    });

    it('should have render function', () => {
      const columns = tagTableObject<{ tags?: TagLabel[] }>();

      expect(columns[0].render).toBeDefined();
      expect(typeof columns[0].render).toBe('function');
    });

    it('should render TagsViewer component with correct props from record', () => {
      const columns = tagTableObject<{ tags?: TagLabel[] }>();
      const tags: TagLabel[] = [
        {
          tagFQN: 'tag1',
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: TagSource.Classification,
        },
        {
          tagFQN: 'tag2',
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: TagSource.Classification,
        },
      ];
      const record = { tags };
      const renderResult = columns[0].render?.(undefined, record as never, 0);

      const { container } = render(<>{renderResult}</>);
      const tagsViewer = container.querySelector('[data-testid="tags-viewer"]');

      expect(tagsViewer).toBeInTheDocument();
      expect(tagsViewer?.textContent).toBe(`2:${TAG_LIST_SIZE}`);
    });

    it('should render TagsViewer with empty array when no tags provided', () => {
      const columns = tagTableObject<{ tags?: TagLabel[] }>();
      const record = {};
      const renderResult = columns[0].render?.(undefined, record as never, 0);

      const { container } = render(<>{renderResult}</>);
      const tagsViewer = container.querySelector('[data-testid="tags-viewer"]');

      expect(tagsViewer).toBeInTheDocument();
      expect(tagsViewer?.textContent).toBe(`0:${TAG_LIST_SIZE}`);
    });

    it('should pass correct props to TagsViewer component', () => {
      const columns = tagTableObject<{ tags?: TagLabel[] }>();
      const tags: TagLabel[] = [
        {
          tagFQN: 'tag1',
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: TagSource.Classification,
        },
      ];
      const record = { tags };
      const TagsViewerMock = jest.requireMock(
        '../components/Tag/TagsViewer/TagsViewer'
      ).default;
      const renderResult = columns[0].render?.(undefined, record as never, 0);

      render(<>{renderResult}</>);

      expect(TagsViewerMock).toHaveBeenCalledWith(
        {
          sizeCap: TAG_LIST_SIZE,
          tags,
        },
        {}
      );
    });

    it('should handle records with undefined tags', () => {
      const columns = tagTableObject<{ tags?: TagLabel[] }>();
      const record = { tags: undefined };
      const renderResult = columns[0].render?.(undefined, record as never, 0);

      const { container } = render(<>{renderResult}</>);
      const tagsViewer = container.querySelector('[data-testid="tags-viewer"]');

      expect(tagsViewer).toBeInTheDocument();
      expect(tagsViewer?.textContent).toBe(`0:${TAG_LIST_SIZE}`);
    });
  });

  describe('descriptionTableObject', () => {
    it('should return column configuration with correct structure and no args', () => {
      const columns = descriptionTableObject<{ description?: string }>();

      expect(columns).toHaveLength(1);
      expect(columns[0]).toMatchObject({
        title: 'label.description',
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
      });
    });

    it('should have render function', () => {
      const columns = descriptionTableObject<{ description?: string }>();

      expect(columns[0].render).toBeDefined();
      expect(typeof columns[0].render).toBe('function');
    });

    it('should merge additional args into column configuration', () => {
      const args = {
        width: 300,
        fixed: 'left' as const,
        ellipsis: true,
      };
      const columns = descriptionTableObject<{ description?: string }>(args);

      expect(columns[0]).toMatchObject({
        title: 'label.description',
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 300,
        fixed: 'left',
        ellipsis: true,
      });
    });

    it('should render RichTextEditorPreviewerNew with markdown text', () => {
      const columns = descriptionTableObject<{ description?: string }>();
      const description = '# Test Description\n\nThis is a test.';
      const renderResult = columns[0].render?.(description, {} as never, 0);

      const { container } = render(<>{renderResult}</>);
      const richTextPreview = container.querySelector(
        '[data-testid="rich-text-preview"]'
      );

      expect(richTextPreview).toBeInTheDocument();
      expect(richTextPreview?.textContent).toBe(description);
    });

    it('should render RichTextEditorPreviewerNew with empty string', () => {
      const columns = descriptionTableObject<{ description?: string }>();
      const renderResult = columns[0].render?.('', {} as never, 0);

      const { container } = render(<>{renderResult}</>);
      const richTextPreview = container.querySelector(
        '[data-testid="rich-text-preview"]'
      );

      expect(richTextPreview).toBeInTheDocument();
      expect(richTextPreview?.textContent).toBe('');
    });

    it('should pass correct props to RichTextEditorPreviewerNew component', () => {
      const columns = descriptionTableObject<{ description?: string }>();
      const description = 'Test description text';

      const renderResult = columns[0].render?.(description, {} as never, 0);

      render(<>{renderResult}</>);

      expect(RichTextEditorPreviewerNew).toHaveBeenCalledWith(
        {
          markdown: description,
        },
        {}
      );
    });

    it('should handle complex markdown with special characters', () => {
      const columns = descriptionTableObject<{ description?: string }>();
      const description = '**Bold** _italic_ `code` [link](url)';
      const renderResult = columns[0].render?.(description, {} as never, 0);

      const { container } = render(<>{renderResult}</>);
      const richTextPreview = container.querySelector(
        '[data-testid="rich-text-preview"]'
      );

      expect(richTextPreview).toBeInTheDocument();
      expect(richTextPreview?.textContent).toBe(description);
    });

    it('should allow args to override default properties', () => {
      const args = {
        title: 'Custom Description',
        dataIndex: 'customDescription',
      };
      const columns = descriptionTableObject<{ description?: string }>(args);

      expect(columns[0]).toMatchObject({
        title: 'Custom Description',
        dataIndex: 'customDescription',
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
      });
    });

    it('should preserve render function when args are provided', () => {
      const args = { width: 400 };
      const columns = descriptionTableObject<{ description?: string }>(args);

      expect(columns[0].render).toBeDefined();
      expect(typeof columns[0].render).toBe('function');

      const description = 'Test';
      const renderResult = columns[0].render?.(description, {} as never, 0);
      const { container } = render(<>{renderResult}</>);
      const richTextPreview = container.querySelector(
        '[data-testid="rich-text-preview"]'
      );

      expect(richTextPreview).toBeInTheDocument();
      expect(richTextPreview).toHaveTextContent(description);
    });
  });
});
