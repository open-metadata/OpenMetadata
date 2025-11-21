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
import { BrowserRouter } from 'react-router-dom';
import { CustomProperty, EntityReference } from '../generated/entity/type';
import {
  formatCustomPropertyValue,
  isEntityReference,
  renderEntityReferenceButton,
  renderIntervalValue,
  renderTableValue,
} from './CustomPropertyRenderers';

jest.mock('./EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn().mockReturnValue('/test-entity-link'),
  },
}));

jest.mock('./SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIcon: jest
      .fn()
      .mockReturnValue(<span data-testid="entity-icon">Icon</span>),
  },
}));

jest.mock('./EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

jest.mock('../components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ name }) => (
      <div data-testid="profile-picture">{name}</div>
    )),
}));

jest.mock(
  '../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ markdown }) => (
        <div data-testid="rich-text-previewer">{markdown}</div>
      )),
  })
);

const mockT = jest.fn((key: string, options?: Record<string, unknown>) => {
  if (key === 'label.not-set') {
    return 'Not set';
  }
  if (key === 'label.start-entity') {
    return `Start ${options?.entity || ''}`;
  }
  if (key === 'label.end-entity') {
    return `End ${options?.entity || ''}`;
  }
  if (key === 'label.time') {
    return 'Time';
  }

  return key;
});

const renderWithRouter = (component: JSX.Element) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('CustomPropertyRenderers', () => {
  describe('isEntityReference', () => {
    it('should return true for valid entity reference', () => {
      const obj = {
        type: 'table',
        fullyQualifiedName: 'db.schema.table',
        id: '123',
      };

      expect(isEntityReference(obj)).toBe(true);
    });

    it('should return true for entity reference with name but no id', () => {
      const obj = {
        type: 'table',
        fullyQualifiedName: 'db.schema.table',
        name: 'table',
      };

      expect(isEntityReference(obj)).toBe(true);
    });

    it('should return false when type is missing', () => {
      const obj = {
        fullyQualifiedName: 'db.schema.table',
        id: '123',
      };

      expect(isEntityReference(obj)).toBe(false);
    });

    it('should return false when fullyQualifiedName is missing', () => {
      const obj = {
        type: 'table',
        id: '123',
      };

      expect(isEntityReference(obj)).toBe(false);
    });

    it('should return false when both id and name are missing', () => {
      const obj = {
        type: 'table',
        fullyQualifiedName: 'db.schema.table',
      };

      expect(isEntityReference(obj)).toBe(false);
    });

    it('should return false for empty object', () => {
      const obj = {};

      expect(isEntityReference(obj)).toBe(false);
    });
  });

  describe('renderEntityReferenceButton', () => {
    it('should render entity reference button for table', () => {
      const item: EntityReference = {
        id: '123',
        type: 'table',
        name: 'test-table',
        fullyQualifiedName: 'db.schema.test-table',
        displayName: 'Test Table',
      };

      const { container } = renderWithRouter(renderEntityReferenceButton(item));

      expect(container.querySelector('a')).toHaveAttribute(
        'href',
        '/test-entity-link'
      );
      expect(screen.getByTestId('entity-icon')).toBeInTheDocument();
    });

    it('should render entity reference button for user with ProfilePicture', () => {
      const item: EntityReference = {
        id: '456',
        type: 'user',
        name: 'john.doe',
        fullyQualifiedName: 'john.doe',
        displayName: 'John Doe',
      };

      const { container } = renderWithRouter(renderEntityReferenceButton(item));

      expect(container.querySelector('a')).toHaveAttribute(
        'href',
        '/test-entity-link'
      );
      expect(screen.getByTestId('profile-picture')).toBeInTheDocument();
    });

    it('should render entity reference button for team with ProfilePicture', () => {
      const item: EntityReference = {
        id: '789',
        type: 'team',
        name: 'engineering',
        fullyQualifiedName: 'engineering',
        displayName: 'Engineering Team',
      };

      const { container } = renderWithRouter(renderEntityReferenceButton(item));

      expect(container.querySelector('a')).toHaveAttribute(
        'href',
        '/test-entity-link'
      );
      expect(screen.getByTestId('profile-picture')).toBeInTheDocument();
    });
  });

  describe('renderTableValue', () => {
    it('should render table with correct structure', () => {
      const tableVal = {
        rows: [
          { col1: 'value1', col2: 'value2' },
          { col1: 'value3', col2: 'value4' },
        ],
        columns: ['col1', 'col2'],
      };

      const { container } = render(renderTableValue(tableVal));

      const table = container.querySelector('table');

      expect(table).toBeInTheDocument();
      expect(table).toHaveClass('ant-table', 'ant-table-small');
    });

    it('should render correct number of columns', () => {
      const tableVal = {
        rows: [{ col1: 'value1', col2: 'value2', col3: 'value3' }],
        columns: ['col1', 'col2', 'col3'],
      };

      const { container } = render(renderTableValue(tableVal));

      const cols = container.querySelectorAll('colgroup col');

      expect(cols).toHaveLength(3);

      cols.forEach((col) => {
        expect(col).toHaveClass('table-col-min-width');
      });
    });

    it('should render column headers', () => {
      const tableVal = {
        rows: [{ col1: 'value1', col2: 'value2' }],
        columns: ['col1', 'col2'],
      };

      const { container } = render(renderTableValue(tableVal));

      const headers = container.querySelectorAll('thead th');

      expect(headers).toHaveLength(2);
      expect(headers[0]).toHaveTextContent('col1');
      expect(headers[1]).toHaveTextContent('col2');
    });

    it('should render table rows with values', () => {
      const tableVal = {
        rows: [
          { col1: 'value1', col2: 'value2' },
          { col1: 'value3', col2: 'value4' },
        ],
        columns: ['col1', 'col2'],
      };

      const { container } = render(renderTableValue(tableVal));

      const bodyRows = container.querySelectorAll('tbody tr');

      expect(bodyRows).toHaveLength(2);
      expect(bodyRows[0].querySelectorAll('td')[0]).toHaveTextContent('value1');
      expect(bodyRows[0].querySelectorAll('td')[1]).toHaveTextContent('value2');
      expect(bodyRows[1].querySelectorAll('td')[0]).toHaveTextContent('value3');
      expect(bodyRows[1].querySelectorAll('td')[1]).toHaveTextContent('value4');
    });

    it('should render dash for missing column values', () => {
      const tableVal = {
        rows: [{ col1: 'value1' }],
        columns: ['col1', 'col2'],
      };

      const { container } = render(renderTableValue(tableVal));

      const cells = container.querySelectorAll('tbody td');

      expect(cells[0]).toHaveTextContent('value1');
      expect(cells[1]).toHaveTextContent('-');
    });

    it('should handle empty rows', () => {
      const tableVal = {
        rows: [],
        columns: ['col1', 'col2'],
      };

      const { container } = render(renderTableValue(tableVal));

      const bodyRows = container.querySelectorAll('tbody tr');

      expect(bodyRows).toHaveLength(0);
    });
  });

  describe('renderIntervalValue', () => {
    it('should render time interval with time label', () => {
      const objVal = { start: 1000, end: 2000 };
      const result = renderIntervalValue(objVal, true, mockT);

      expect(result).toBe('Start Time: 1000 - End Time: 2000');
    });

    it('should render range interval without time label', () => {
      const objVal = { start: 10, end: 100 };
      const result = renderIntervalValue(objVal, false, mockT);

      expect(result).toBe('Start : 10 - End : 100');
    });

    it('should handle zero values', () => {
      const objVal = { start: 0, end: 10 };
      const result = renderIntervalValue(objVal, false, mockT);

      expect(result).toBe('Start : 0 - End : 10');
    });

    it('should handle negative values', () => {
      const objVal = { start: -10, end: 10 };
      const result = renderIntervalValue(objVal, false, mockT);

      expect(result).toBe('Start : -10 - End : 10');
    });
  });

  describe('formatCustomPropertyValue', () => {
    const createProperty = (
      name: string,
      typeName: string
    ): CustomProperty => ({
      name,
      displayName: name,
      description: '',
      propertyType: {
        id: typeName,
        name: typeName,
        type: 'type',
      },
    });

    it('should render "Not set" for null value', () => {
      const property = createProperty('test', 'string');
      const { container } = render(
        <div>{formatCustomPropertyValue(null, property, mockT)}</div>
      );

      expect(container).toHaveTextContent('Not set');
    });

    it('should render "Not set" for undefined value', () => {
      const property = createProperty('test', 'string');
      const { container } = render(
        <div>{formatCustomPropertyValue(undefined, property, mockT)}</div>
      );

      expect(container).toHaveTextContent('Not set');
    });

    it('should render markdown with RichTextEditorPreviewerV1', () => {
      const property = createProperty('test', 'markdown');
      const markdown = '# Heading\n\nContent';

      render(<div>{formatCustomPropertyValue(markdown, property, mockT)}</div>);

      expect(screen.getByTestId('rich-text-previewer')).toBeInTheDocument();
      expect(screen.getByTestId('rich-text-previewer')).toHaveTextContent(
        '# Heading'
      );
      expect(screen.getByTestId('rich-text-previewer')).toHaveTextContent(
        'Content'
      );
    });

    it('should render entity reference list', () => {
      const property = createProperty('test', 'entityReferenceList');
      const entityRefs: EntityReference[] = [
        {
          id: '1',
          type: 'table',
          name: 'table1',
          fullyQualifiedName: 'db.table1',
        },
        {
          id: '2',
          type: 'dashboard',
          name: 'dashboard1',
          fullyQualifiedName: 'service.dashboard1',
        },
      ];

      const { container } = renderWithRouter(
        <div>{formatCustomPropertyValue(entityRefs, property, mockT)}</div>
      );

      const links = container.querySelectorAll('a');

      expect(links).toHaveLength(2);
    });

    it('should render single entity reference', () => {
      const property = createProperty('test', 'entityReference');
      const entityRef: EntityReference = {
        id: '1',
        type: 'table',
        name: 'table1',
        fullyQualifiedName: 'db.table1',
      };

      const { container } = renderWithRouter(
        <div>{formatCustomPropertyValue(entityRef, property, mockT)}</div>
      );

      const link = container.querySelector('a');

      expect(link).toHaveAttribute('href', '/test-entity-link');
    });

    it('should render enum values as tags', () => {
      const property = createProperty('test', 'enum');
      const enumValues = ['Value1', 'Value2', 'Value3'];

      const { container } = render(
        <div>{formatCustomPropertyValue(enumValues, property, mockT)}</div>
      );

      const tags = container.querySelectorAll('.ant-tag');

      expect(tags).toHaveLength(3);
    });

    it('should render table value', () => {
      const property = createProperty('test', 'table');
      const tableValue = {
        rows: [{ col1: 'value1', col2: 'value2' }],
        columns: ['col1', 'col2'],
      };

      const { container } = render(
        <div>{formatCustomPropertyValue(tableValue, property, mockT)}</div>
      );

      const table = container.querySelector('table');

      expect(table).toBeInTheDocument();
    });

    it('should render time interval', () => {
      const property = createProperty('test', 'timeInterval');
      const intervalValue = { start: 1000, end: 2000 };

      const { container } = render(
        <div>{formatCustomPropertyValue(intervalValue, property, mockT)}</div>
      );

      expect(container).toHaveTextContent('Start Time: 1000 - End Time: 2000');
    });

    it('should render range interval', () => {
      const property = createProperty('test', 'range');
      const rangeValue = { start: 10, end: 100 };

      const { container } = render(
        <div>{formatCustomPropertyValue(rangeValue, property, mockT)}</div>
      );

      expect(container).toHaveTextContent('Start : 10 - End : 100');
    });

    it('should render array as comma-separated string', () => {
      const property = createProperty('test', 'array');
      const arrayValue = ['item1', 'item2', 'item3'];

      const { container } = render(
        <div>{formatCustomPropertyValue(arrayValue, property, mockT)}</div>
      );

      expect(container).toHaveTextContent('item1, item2, item3');
    });

    it('should extract name from object', () => {
      const property = createProperty('test', 'object');
      const objValue = { name: 'testName' };

      const { container } = render(
        <div>{formatCustomPropertyValue(objValue, property, mockT)}</div>
      );

      expect(container).toHaveTextContent('testName');
    });

    it('should extract displayName from object', () => {
      const property = createProperty('test', 'object');
      const objValue = { displayName: 'Test Display Name' };

      const { container } = render(
        <div>{formatCustomPropertyValue(objValue, property, mockT)}</div>
      );

      expect(container).toHaveTextContent('Test Display Name');
    });

    it('should extract value from object', () => {
      const property = createProperty('test', 'object');
      const objValue = { value: 'testValue' };

      const { container } = render(
        <div>{formatCustomPropertyValue(objValue, property, mockT)}</div>
      );

      expect(container).toHaveTextContent('testValue');
    });

    it('should stringify complex objects', () => {
      const property = createProperty('test', 'object');
      const objValue = { complex: { nested: 'value' } };

      const { container } = render(
        <div>{formatCustomPropertyValue(objValue, property, mockT)}</div>
      );

      expect(container).toHaveTextContent(JSON.stringify(objValue));
    });

    it('should convert primitives to strings', () => {
      const property = createProperty('test', 'number');

      const { container: container1 } = render(
        <div>{formatCustomPropertyValue(42, property, mockT)}</div>
      );

      expect(container1).toHaveTextContent('42');

      const { container: container2 } = render(
        <div>{formatCustomPropertyValue(true, property, mockT)}</div>
      );

      expect(container2).toHaveTextContent('true');
    });
  });
});
