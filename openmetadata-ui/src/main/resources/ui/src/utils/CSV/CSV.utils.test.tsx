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
import { ExtensionDataProps } from '../../components/Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import { EntityType } from '../../enums/entity.enum';
import {
  MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES,
  MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_CONVERTED_EXTENSION_CSV_STRING,
  MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_EXTENSION_CSV_STRING,
  MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_EXTENSION_OBJECT,
} from '../../mocks/CSV.mock';
import {
  convertCustomPropertyStringToEntityExtension,
  convertEntityExtensionToCustomPropertyString,
  getColumnConfig,
  getCSVStringFromColumnsAndDataSource,
  getEntityColumnsAndDataSourceFromCSV,
  splitCSV,
} from './CSV.utils';

describe('CSVUtils', () => {
  describe('getColumnConfig', () => {
    it('should return the column configuration object', () => {
      const column = 'description';
      const columnConfig = getColumnConfig(column, EntityType.GLOSSARY);

      expect(columnConfig).toBeDefined();
      expect(columnConfig.key).toBe(column);
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
        EntityType.GLOSSARY,
        false
      );

      expect(columns).toHaveLength(2);
      expect(dataSource).toHaveLength(1);
    });
  });

  describe('getCSVStringFromColumnsAndDataSource', () => {
    it('should return the CSV string from the columns and data source for non-quoted columns', () => {
      const columns = [
        { name: 'col1', key: 'col1' },
        { name: 'col2', key: 'col2' },
      ];
      const dataSource = [{ col1: 'value1', col2: 'value2' }];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe('col1,col2\nvalue1,value2');
    });

    it('should return the CSV string from the columns and data source with quoted columns', () => {
      const columns = [
        { name: 'tags', key: 'tags' },
        { name: 'glossaryTerms', key: 'glossaryTerms' },
        { name: 'description', key: 'description' },
        { name: 'domains', key: 'domains' },
      ];
      const dataSource = [
        {
          tags: 'value1',
          glossaryTerms: 'value2',
          description: 'something new',
          domains: 'domain1',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe(
        'tags,glossaryTerms,description,domains\n"value1","value2","something new","domain1"'
      );
    });

    it('should return quoted value if data contains comma', () => {
      const columns = [
        { name: 'tags', key: 'tags' },
        { name: 'glossaryTerms', key: 'glossaryTerms' },
        { name: 'description', key: 'description' },
        { name: 'domain', key: 'domain' },
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
        `tags,glossaryTerms,description,domain\n"value,1","value_2","something#new","domain,1"`
      );
    });
  });

  describe('convertCustomPropertyStringToEntityExtension', () => {
    it('should return empty object if customProperty type is empty', () => {
      const convertedCSVEntities =
        convertCustomPropertyStringToEntityExtension('dateCp:2021-09-01');

      expect(convertedCSVEntities).toStrictEqual({});
    });

    it('should return object correctly which contains dot and percentage in it', () => {
      const convertedCSVEntities = convertCustomPropertyStringToEntityExtension(
        MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_EXTENSION_CSV_STRING,
        MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES
      );

      expect(convertedCSVEntities).toStrictEqual(
        MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_EXTENSION_OBJECT
      );
    });
  });

  describe('convertEntityExtensionToCustomPropertyString', () => {
    it('should return empty object if customProperty type is empty', () => {
      const convertedCSVEntities = convertEntityExtensionToCustomPropertyString(
        MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_EXTENSION_OBJECT
      );

      expect(convertedCSVEntities).toBeUndefined();
    });

    it('should return empty object if value is empty', () => {
      const convertedCSVEntities = convertEntityExtensionToCustomPropertyString(
        undefined,
        MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES
      );

      expect(convertedCSVEntities).toBeUndefined();
    });

    it('should return object correctly which contains dot and percentage in it', () => {
      const convertedCSVEntities = convertEntityExtensionToCustomPropertyString(
        MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_EXTENSION_OBJECT,
        MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES
      );

      expect(convertedCSVEntities).toStrictEqual(
        MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_CONVERTED_EXTENSION_CSV_STRING
      );
    });

    it('should return string correctly which contains undefined as value for property', () => {
      const convertedCSVEntities = convertEntityExtensionToCustomPropertyString(
        { dateCp: undefined } as unknown as ExtensionDataProps,
        MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES
      );

      expect(convertedCSVEntities).toStrictEqual(`dateCp:undefined`);
    });
  });

  describe('splitCSV', () => {
    it('should split simple CSV string correctly', () => {
      const input = 'value1,value2,value3';
      const result = splitCSV(input);

      expect(result).toEqual(['value1', 'value2', 'value3']);
    });

    it('should handle quoted values with commas', () => {
      const input = 'value1,"value,2",value3';
      const result = splitCSV(input);

      expect(result).toEqual(['value1', 'value,2', 'value3']);
    });

    it('should handle escaped quotes within quoted values', () => {
      const input = 'value1,"value "quoted" here",value3';
      const result = splitCSV(input);

      expect(result).toEqual(['value1', 'value "quoted" here', 'value3']);
    });

    it('should handle empty values', () => {
      const input = 'value1,,value3';
      const result = splitCSV(input);

      expect(result).toEqual(['value1', '', 'value3']);
    });

    it('should handle values with spaces', () => {
      const input = ' value1 , value2 , value3 ';
      const result = splitCSV(input);

      expect(result).toEqual(['value1', 'value2', 'value3']);
    });

    it('should handle empty string input', () => {
      const input = '';
      const result = splitCSV(input);

      expect(result).toEqual([]);
    });

    it('should handle complex quoted values with multiple commas', () => {
      const input = '"value,1,2,3","another,value","last,value"';
      const result = splitCSV(input);

      expect(result).toEqual(['value,1,2,3', 'another,value', 'last,value']);
    });

    it('should convert numbers to strings', () => {
      const input = '1,2,3,4,5';
      const result = splitCSV(input);

      expect(result).toEqual(['1', '2', '3', '4', '5']);

      // Verify each value is a string
      result.forEach((value) => {
        expect(typeof value).toBe('string');
      });
    });

    it('should handle mixed number and string values', () => {
      const input = '1,hello,3,world,5';
      const result = splitCSV(input);

      expect(result).toEqual(['1', 'hello', '3', 'world', '5']);

      // Verify each value is a string
      result.forEach((value) => {
        expect(typeof value).toBe('string');
      });
    });
  });
});
