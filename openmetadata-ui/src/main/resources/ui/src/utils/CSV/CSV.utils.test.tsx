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
import { EntityType } from '../../enums/entity.enum';
import {
  getColumnConfig,
  getCSVStringFromColumnsAndDataSource,
  getEntityColumnsAndDataSourceFromCSV,
} from './CSV.utils';

describe('CSVUtils', () => {
  describe('getColumnConfig', () => {
    it('should return the column configuration object', () => {
      const column = 'description';
      const columnConfig = getColumnConfig(column, EntityType.GLOSSARY);

      expect(columnConfig).toBeDefined();
      expect(columnConfig.name).toBe(column);
    });
  });

  describe('getEntityColumnsAndDataSourceFromCSV', () => {
    it('should return the columns and data source from the CSV', () => {
      const csv = [
        ['col1', 'col2'],
        ['value1', 'value2'],
      ];
      const { columns, dataSource } = getEntityColumnsAndDataSourceFromCSV(
        csv,
        EntityType.GLOSSARY
      );

      expect(columns).toHaveLength(2);
      expect(dataSource).toHaveLength(1);
    });
  });

  describe('getCSVStringFromColumnsAndDataSource', () => {
    it('should return the CSV string from the columns and data source for non-quoted columns', () => {
      const columns = [{ name: 'col1' }, { name: 'col2' }];
      const dataSource = [{ col1: 'value1', col2: 'value2' }];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe('col1,col2\nvalue1,value2');
    });

    it('should return the CSV string from the columns and data source with quoted columns', () => {
      const columns = [
        { name: 'tags' },
        { name: 'glossaryTerms' },
        { name: 'description' },
        { name: 'domain' },
      ];
      const dataSource = [
        {
          tags: 'value1',
          glossaryTerms: 'value2',
          description: 'something new',
          domain: 'domain1',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe(
        'tags,glossaryTerms,description,domain\n"value1","value2",something new,"domain1"'
      );
    });

    it('should return quoted value if data contains comma', () => {
      const columns = [
        { name: 'tags' },
        { name: 'glossaryTerms' },
        { name: 'description' },
        { name: 'domain' },
      ];
      const dataSource = [
        {
          tags: 'value,1',
          glossaryTerms: 'value_2',
          description: 'something#new',
          domain: 'domain,1',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe(
        `tags,glossaryTerms,description,domain\n"value,1","value_2",something#new,"domain,1"`
      );
    });
  });
});
