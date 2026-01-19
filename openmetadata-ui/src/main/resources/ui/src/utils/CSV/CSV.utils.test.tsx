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
import { render, screen } from '@testing-library/react';
import { ExtensionDataProps } from '../../components/Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import { EntityType } from '../../enums/entity.enum';
import { Status } from '../../generated/type/csvImportResult';
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
  renderColumnDataEditor,
  splitCSV,
} from './CSV.utils';

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    jest
      .fn()
      .mockImplementation(({ markdown }) => (
        <div data-testid="rich-text-editor-previewer">{markdown}</div>
      ))
);

describe('CSVUtils', () => {
  describe('getColumnConfig', () => {
    it('should return the column configuration object', () => {
      const column = 'description';
      const columnConfig = getColumnConfig(column, EntityType.GLOSSARY, {
        user: true,
        team: false,
      });

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
        {
          user: true,
          team: false,
        },
        false,
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

    it('should properly escape quotes in FQN values containing dots', () => {
      const columns = [
        { name: 'name*', key: 'name*' },
        { name: 'fullyQualifiedName', key: 'fullyQualifiedName' },
        { name: 'entityType*', key: 'entityType*' },
      ];
      const dataSource = [
        {
          'name*': 'default',
          fullyQualifiedName: '"local.mysql".default',
          'entityType*': 'database',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe(
        'name*,fullyQualifiedName,entityType*\n"default","""local.mysql"".default",database'
      );
    });

    it('should quote domain values without escaping quotes', () => {
      const columns = [
        { name: 'domains', key: 'domains' },
        { name: 'name*', key: 'name*' },
      ];
      const dataSource = [
        {
          domains: 'PW%domain.7429a05d',
          'name*': 'test-database',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe(
        'domains,name*\n"PW%domain.7429a05d","test-database"'
      );
    });

    it('should quote tags values without escaping quotes', () => {
      const columns = [
        { name: 'tags', key: 'tags' },
        { name: 'name*', key: 'name*' },
      ];
      const dataSource = [
        {
          tags: 'PII.Sensitive',
          'name*': 'test-entity',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe('tags,name*\n"PII.Sensitive","test-entity"');
    });

    it('should not double-escape domain values that already have escaped quotes', () => {
      const columns = [{ name: 'domains', key: 'domains' }];
      const dataSource = [
        {
          domains: 'PW%domain.7429a05d',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe('domains\n"PW%domain.7429a05d"');
      expect(csvString).not.toContain('""""');
    });

    it('should handle FQN values with dots in service names correctly', () => {
      const columns = [
        { name: 'fullyQualifiedName', key: 'fullyQualifiedName' },
      ];
      const dataSource = [
        {
          fullyQualifiedName: '"pw.db.service.e2f0f527".pwdatabasea8657c',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe(
        'fullyQualifiedName\n"""pw.db.service.e2f0f527"".pwdatabasea8657c"'
      );
    });

    it('should handle displayName with quotes correctly', () => {
      const columns = [{ name: 'displayName', key: 'displayName' }];
      const dataSource = [
        {
          displayName: 'Test "quoted" name',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe('displayName\n"Test ""quoted"" name"');
    });

    it('should handle displayName with both commas and quotes correctly', () => {
      const columns = [{ name: 'displayName', key: 'displayName' }];
      const dataSource = [
        {
          displayName:
            'Contains a timestamp for the most recent "login" of this feature user, to be used for PIN expiration.',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe(
        'displayName\n"Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration."'
      );
    });

    it('should handle tags with commas correctly', () => {
      const columns = [{ name: 'tags', key: 'tags' }];
      const dataSource = [
        {
          tags: 'tag1,tag2',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe('tags\n"tag1,tag2"');
    });

    it('should handle domains with special characters correctly', () => {
      const columns = [{ name: 'domains', key: 'domains' }];
      const dataSource = [
        {
          domains: 'PW%domain.7429a05d',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe('domains\n"PW%domain.7429a05d"');
    });

    it('should handle mixed scenario: domains, FQN with dots, and regular values', () => {
      const columns = [
        { name: 'domains', key: 'domains' },
        { name: 'fullyQualifiedName', key: 'fullyQualifiedName' },
        { name: 'name*', key: 'name*' },
      ];
      const dataSource = [
        {
          domains: 'PW%domain.7429a05d',
          fullyQualifiedName: '"pw.db.service.e2f0f527".pwdatabasea8657c',
          'name*': 'test-database',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe(
        'domains,fullyQualifiedName,name*\n"PW%domain.7429a05d","""pw.db.service.e2f0f527"".pwdatabasea8657c","test-database"'
      );
    });

    it('should handle name* values containing dots correctly', () => {
      const columns = [
        { name: 'name*', key: 'name*' },
        { name: 'fullyQualifiedName', key: 'fullyQualifiedName' },
      ];
      const dataSource = [
        {
          'name*': '"local.mysql".default',
          fullyQualifiedName: '"local.mysql".default.schema',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe(
        'name*,fullyQualifiedName\n"""local.mysql"".default","""local.mysql"".default.schema"'
      );
    });

    it('should handle name* values with dots but no quotes correctly', () => {
      const columns = [{ name: 'name*', key: 'name*' }];
      const dataSource = [
        {
          'name*': 'service.name.table',
        },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe('name*\n"service.name.table"');
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

  describe('renderColumnDataEditor', () => {
    it('should render status badge for status column with success status', () => {
      const result = renderColumnDataEditor('status', {
        value: Status.Success,
        data: { details: '', glossaryStatus: '' },
      });

      render(<div>{result}</div>);

      expect(screen.getByTestId('success-badge')).toBeInTheDocument();
    });

    it('should render status badge for status column with failure status', () => {
      const result = renderColumnDataEditor('status', {
        value: Status.Failure,
        data: { details: '', glossaryStatus: '' },
      });

      render(<div>{result}</div>);

      expect(screen.getByTestId('failure-badge')).toBeInTheDocument();
    });

    it('should show the status for glossaryStatus column', () => {
      const glossaryStatus = 'Draft';
      const result = renderColumnDataEditor('glossaryStatus', {
        value: '',
        data: { details: '', glossaryStatus },
      });

      render(<div>{result}</div>);

      expect(screen.getByText(glossaryStatus)).toBeInTheDocument();
    });

    it('should render RichTextEditorPreviewerV1 for description column', () => {
      const description = 'This is a test description';
      const result = renderColumnDataEditor('description', {
        value: description,
        data: { details: '', glossaryStatus: '' },
      });

      render(<div>{result}</div>);

      expect(
        screen.getByTestId('rich-text-editor-previewer')
      ).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();
    });

    it('should render different content for different column types', () => {
      const testData = {
        value: 'test value',
        data: { details: 'test details', glossaryStatus: 'Draft' },
      };

      const statusResult = renderColumnDataEditor('status', {
        ...testData,
        value: Status.Success,
      });
      const glossaryResult = renderColumnDataEditor('glossaryStatus', testData);
      const descriptionResult = renderColumnDataEditor('description', testData);
      const defaultResult = renderColumnDataEditor('otherColumn', testData);

      // Verify different return types
      expect(statusResult).not.toBe(testData.value);
      expect(glossaryResult).not.toBe(testData.value);
      expect(descriptionResult).not.toBe(testData.value);
      expect(defaultResult).toBe(testData.value);
    });
  });
});
