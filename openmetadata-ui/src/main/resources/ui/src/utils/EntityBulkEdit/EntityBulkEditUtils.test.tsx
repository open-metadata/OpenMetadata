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
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { ROUTES } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import {
  getBulkEditButton,
  getBulkEditCSVExportEntityApi,
  getBulkEntityNavigationPath,
  isBulkEditRoute,
} from './EntityBulkEditUtils';

jest.mock('../EntityUtilClassBase', () => ({
  getEntityLink: jest
    .fn()
    .mockImplementation((entityType, fqn, tab, subTab) => {
      let path = `/${entityType}/${fqn}`;
      if (tab) {
        path += `/${tab}`;
      }
      if (subTab) {
        path += `/${subTab}`;
      }

      return path;
    }),
}));

jest.mock('../RouterUtils', () => ({
  getDataQualityPagePath: jest
    .fn()
    .mockImplementation((tab) => `/data-quality/${tab}`),
}));

jest.mock('../../rest/databaseAPI', () => ({
  exportDatabaseDetailsInCSV: jest.fn(),
  exportDatabaseSchemaDetailsInCSV: jest.fn(),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  exportGlossaryInCSVFormat: jest.fn(),
  exportGlossaryTermsInCSVFormat: jest.fn(),
}));

jest.mock('../../rest/serviceAPI', () => ({
  exportDatabaseServiceDetailsInCSV: jest.fn(),
}));

jest.mock('../../rest/tableAPI', () => ({
  exportTableDetailsInCSV: jest.fn(),
}));

jest.mock('../../rest/testAPI', () => ({
  exportTestCasesInCSV: jest.fn(),
}));

describe('EntityBulkEditUtils', () => {
  describe('isBulkEditRoute', () => {
    it('should return true if the pathname includes bulk edit route', () => {
      const pathname = `/some/path${ROUTES.BULK_EDIT_ENTITY}/entity`;

      expect(isBulkEditRoute(pathname)).toBe(true);
    });

    it('should return false if the pathname does not include bulk edit route', () => {
      const pathname = '/some/path/entity';

      expect(isBulkEditRoute(pathname)).toBe(false);
    });

    it('should return true for bulk edit route with wildcard', () => {
      const pathname = `/table/${WILD_CARD_CHAR}/${ROUTES.BULK_EDIT_ENTITY}`;

      expect(isBulkEditRoute(pathname)).toBe(true);
    });

    it('should return false for empty pathname', () => {
      expect(isBulkEditRoute('')).toBe(false);
    });

    it('should return false for root path', () => {
      expect(isBulkEditRoute('/')).toBe(false);
    });

    it('should handle pathname with query parameters', () => {
      const pathname = `/table/sample_data/${ROUTES.BULK_EDIT_ENTITY}?tab=schema`;

      expect(isBulkEditRoute(pathname)).toBe(true);
    });
  });

  describe('getBulkEditCSVExportEntityApi', () => {
    it('should return exportDatabaseServiceDetailsInCSV for DATABASE_SERVICE', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.DATABASE_SERVICE);

      expect(result).toBeDefined();
    });

    it('should return exportDatabaseDetailsInCSV for DATABASE', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.DATABASE);

      expect(result).toBeDefined();
    });

    it('should return exportDatabaseSchemaDetailsInCSV for DATABASE_SCHEMA', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.DATABASE_SCHEMA);

      expect(result).toBeDefined();
    });

    it('should return exportGlossaryTermsInCSVFormat for GLOSSARY_TERM', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.GLOSSARY_TERM);

      expect(result).toBeDefined();
    });

    it('should return exportGlossaryInCSVFormat for GLOSSARY', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.GLOSSARY);

      expect(result).toBeDefined();
    });

    it('should return exportTableDetailsInCSV for TABLE', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.TABLE);

      expect(result).toBeDefined();
    });

    it('should return exportTestCasesInCSV for TEST_CASE', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.TEST_CASE);

      expect(result).toBeDefined();
    });

    it('should return exportTableDetailsInCSV for unknown entity type', () => {
      const result = getBulkEditCSVExportEntityApi(
        'UNKNOWN_TYPE' as EntityType
      );

      expect(result).toBeDefined();
    });

    it('should return exportTableDetailsInCSV for DASHBOARD entity type', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.DASHBOARD);

      expect(result).toBeDefined();
    });

    it('should return exportTableDetailsInCSV for TOPIC entity type', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.TOPIC);

      expect(result).toBeDefined();
    });
  });

  describe('getBulkEditButton', () => {
    const mockOnClickHandler = jest.fn();

    beforeEach(() => {
      mockOnClickHandler.mockClear();
    });

    it('should render button when hasPermission is true', () => {
      const result = getBulkEditButton(true, mockOnClickHandler);

      render(<div>{result}</div>);

      const button = screen.getByTestId('bulk-edit-table');

      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('text-primary');
      expect(button).toHaveClass('p-0');
      expect(button).toHaveClass('remove-button-background-hover');
    });

    it('should return null when hasPermission is false', () => {
      const result = getBulkEditButton(false, mockOnClickHandler);

      expect(result).toBeNull();
    });

    it('should call onClickHandler when button is clicked', () => {
      const result = getBulkEditButton(true, mockOnClickHandler);

      render(<div>{result}</div>);

      const button = screen.getByTestId('bulk-edit-table');
      button.click();

      expect(mockOnClickHandler).toHaveBeenCalledTimes(1);
    });

    it('should have correct button type', () => {
      const result = getBulkEditButton(true, mockOnClickHandler);

      render(<div>{result}</div>);

      const button = screen.getByTestId('bulk-edit-table');

      expect(button).toHaveAttribute('type', 'button');
    });

    it('should display edit label', () => {
      const result = getBulkEditButton(true, mockOnClickHandler);

      render(<div>{result}</div>);

      expect(screen.getByText('label.edit')).toBeInTheDocument();
    });
  });

  describe('getBulkEntityNavigationPath', () => {
    it('should return data quality page path for TEST_CASE with wildcard fqn', () => {
      const result = getBulkEntityNavigationPath(EntityType.TEST_CASE, '*');

      expect(result).toBe('/data-quality/test-cases');
    });

    it('should return TABLE profiler path for TEST_CASE with TABLE source entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TEST_CASE,
        'test.table.fqn',
        EntityType.TABLE
      );

      expect(result).toBe('/table/test.table.fqn/profiler/data-quality');
    });

    it('should return TEST_SUITE path for TEST_CASE with TEST_SUITE source entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TEST_CASE,
        'test.suite.fqn',
        EntityType.TEST_SUITE
      );

      expect(result).toBe('/testSuite/test.suite.fqn');
    });

    it('should return data quality page path for TEST_CASE with no source entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TEST_CASE,
        'test.case.fqn'
      );

      expect(result).toBe('/data-quality/test-cases');
    });

    it('should return data quality page path for TEST_CASE with unknown source entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TEST_CASE,
        'test.case.fqn',
        'UNKNOWN_TYPE' as EntityType
      );

      expect(result).toBe('/data-quality/test-cases');
    });

    it('should return entity link for non-TEST_CASE entity types', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TABLE,
        'sample.table.fqn'
      );

      expect(result).toBe('/table/sample.table.fqn');
    });

    it('should return entity link for GLOSSARY entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.GLOSSARY,
        'sample.glossary.fqn'
      );

      expect(result).toBe('/glossary/sample.glossary.fqn');
    });

    it('should return entity link for DATABASE entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.DATABASE,
        'sample.database.fqn'
      );

      expect(result).toBe('/database/sample.database.fqn');
    });

    it('should return entity link for DATABASE_SCHEMA entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.DATABASE_SCHEMA,
        'sample.schema.fqn'
      );

      expect(result).toBe('/databaseSchema/sample.schema.fqn');
    });

    it('should return entity link for GLOSSARY_TERM entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.GLOSSARY_TERM,
        'sample.term.fqn'
      );

      expect(result).toBe('/glossaryTerm/sample.term.fqn');
    });

    it('should handle wildcard FQN for non-TEST_CASE entities', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TABLE,
        WILD_CARD_CHAR
      );

      expect(result).toBe(`/table/${WILD_CARD_CHAR}`);
    });

    it('should ignore sourceEntityType for non-TEST_CASE entities', () => {
      const fqn = 'sample_data.ecommerce_db.shopify.dim_address';
      const result = getBulkEntityNavigationPath(
        EntityType.TABLE,
        fqn,
        EntityType.DATABASE
      );

      expect(result).toBe(`/table/${fqn}`);
    });

    it('should handle FQN with special characters', () => {
      const fqn = 'sample_data.db-name.schema.table@123';
      const result = getBulkEntityNavigationPath(EntityType.TABLE, fqn);

      expect(result).toBe(`/table/${fqn}`);
    });

    it('should handle empty FQN', () => {
      const result = getBulkEntityNavigationPath(EntityType.TABLE, '');

      expect(result).toBe('/table/');
    });
  });
});
