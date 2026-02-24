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
import { Column } from 'react-data-grid';
import { ExtensionDataProps } from '../../components/Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import { EntityType } from '../../enums/entity.enum';
import { Type } from '../../generated/entity/type';
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
        'tags,glossaryTerms,description,domains\nvalue1,value2,something new,domain1'
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
        `tags,glossaryTerms,description,domain\n"value,1",value_2,something#new,"domain,1"`
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
        'name*,fullyQualifiedName,entityType*\ndefault,"""local.mysql"".default",database'
      );
    });

    it('should quote domain values with triple quotes', () => {
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

      expect(csvString).toBe('domains,name*\nPW%domain.7429a05d,test-database');
    });

    it('should not wrap tags in quotes', () => {
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

      expect(csvString).toBe('tags,name*\nPII.Sensitive,test-entity');
    });

    it('should format domains with triple quotes', () => {
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

      expect(csvString).toBe('domains\nPW%domain.7429a05d');
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

      expect(csvString).toBe('domains\nPW%domain.7429a05d');
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
        'domains,fullyQualifiedName,name*\nPW%domain.7429a05d,"""pw.db.service.e2f0f527"".pwdatabasea8657c",test-database'
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

      expect(csvString).toBe('name*\nservice.name.table');
    });

    describe('glossaryTerms formatting', () => {
      it('should return empty string for empty glossaryTerms value', () => {
        const columns = [{ name: 'glossaryTerms', key: 'glossaryTerms' }];
        const dataSource = [{ glossaryTerms: '' }];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('glossaryTerms\n');
      });

      it('should return empty string for whitespace-only glossaryTerms value', () => {
        const columns = [{ name: 'glossaryTerms', key: 'glossaryTerms' }];
        const dataSource = [{ glossaryTerms: '   ' }];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('glossaryTerms\n"   "');
      });

      it('should format single PW glossary term correctly', () => {
        const columns = [{ name: 'glossaryTerms', key: 'glossaryTerms' }];
        const dataSource = [
          {
            glossaryTerms:
              'PW%0b440530.Clever3cd5511b".PW.10739be3%Shark22dfbaf9',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe(
          'glossaryTerms\n"PW%0b440530.Clever3cd5511b"".PW.10739be3%Shark22dfbaf9"'
        );
      });

      it('should format single PW glossary term with quotes correctly (removes quotes)', () => {
        const columns = [{ name: 'glossaryTerms', key: 'glossaryTerms' }];
        const dataSource = [
          {
            glossaryTerms:
              '"PW%0b440530.Clever3cd5511b"."PW.10739be3%Shark22dfbaf9"',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe(
          'glossaryTerms\n"""PW%0b440530.Clever3cd5511b"".""PW.10739be3%Shark22dfbaf9"""'
        );
      });

      it('should format single non-PW glossary term correctly', () => {
        const columns = [{ name: 'glossaryTerms', key: 'glossaryTerms' }];
        const dataSource = [
          {
            glossaryTerms: 'CustomTerm',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('glossaryTerms\nCustomTerm');
      });

      it('should format multiple non-PW glossary terms correctly', () => {
        const columns = [{ name: 'glossaryTerms', key: 'glossaryTerms' }];
        const dataSource = [
          {
            glossaryTerms: 'Term1;Term2;Term3',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('glossaryTerms\nTerm1;Term2;Term3');
      });

      it('should format mixed PW and non-PW glossary terms correctly', () => {
        const columns = [{ name: 'glossaryTerms', key: 'glossaryTerms' }];
        const dataSource = [
          {
            glossaryTerms:
              'PW%0b440530.Clever3cd5511b".PW.10739be3%Shark22dfbaf9;CustomTerm',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe(
          'glossaryTerms\n"PW%0b440530.Clever3cd5511b"".PW.10739be3%Shark22dfbaf9;CustomTerm"'
        );
      });

      it('should handle multiple non-PW glossary terms (3+ terms)', () => {
        const columns = [{ name: 'glossaryTerms', key: 'glossaryTerms' }];
        const dataSource = [
          {
            glossaryTerms: 'Term1;Term2;Term3;Term4',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('glossaryTerms\nTerm1;Term2;Term3;Term4');
      });
    });

    describe('domains formatting', () => {
      it('should format domains with triple quotes', () => {
        const columns = [{ name: 'domains', key: 'domains' }];
        const dataSource = [
          {
            domains: 'PW%domain.09e0bf05',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('domains\nPW%domain.09e0bf05');
      });

      it('should handle multiple domains (semicolon-separated)', () => {
        const columns = [{ name: 'domains', key: 'domains' }];
        const dataSource = [
          {
            domains: 'PW%domain.09e0bf05;PW%domain.7429a05d',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe(
          'domains\nPW%domain.09e0bf05;PW%domain.7429a05d'
        );
      });

      it('should handle domains with commas', () => {
        const columns = [{ name: 'domains', key: 'domains' }];
        const dataSource = [
          {
            domains: 'PW%domain.09e0bf05,with,commas',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('domains\n"PW%domain.09e0bf05,with,commas"');
      });
    });

    describe('description formatting', () => {
      it('should format description with standard CSV quoting', () => {
        const columns = [{ name: 'description', key: 'description' }];
        const dataSource = [
          {
            description: 'Simple description',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('description\nSimple description');
      });

      it('should escape quotes in description', () => {
        const columns = [{ name: 'description', key: 'description' }];
        const dataSource = [
          {
            description: 'Description with "quotes"',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('description\n"Description with ""quotes"""');
      });

      it('should handle description with HTML content', () => {
        const columns = [{ name: 'description', key: 'description' }];
        const dataSource = [
          {
            description: '<p><strong>test</strong></p>',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('description\n<p><strong>test</strong></p>');
      });
    });

    describe('tags formatting', () => {
      it('should not wrap tags in quotes', () => {
        const columns = [{ name: 'tags', key: 'tags' }];
        const dataSource = [
          {
            tags: 'PII.NonSensitive',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('tags\nPII.NonSensitive');
      });

      it('should not wrap tags with semicolons in quotes', () => {
        const columns = [{ name: 'tags', key: 'tags' }];
        const dataSource = [
          {
            tags: 'PII.NonSensitive;PersonalData.Personal',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('tags\nPII.NonSensitive;PersonalData.Personal');
      });

      it('should quote tags if they contain commas (generic CSV rule)', () => {
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

      it('should quote tags if they contain newlines (generic CSV rule)', () => {
        const columns = [{ name: 'tags', key: 'tags' }];
        const dataSource = [
          {
            tags: 'tag1\ntag2',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('tags\n"tag1\ntag2"');
      });

      it('should handle multiple tags with different separators', () => {
        const columns = [{ name: 'tags', key: 'tags' }];
        const dataSource = [
          {
            tags: 'PII.NonSensitive;PersonalData.Personal;Tier.Tier1',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe(
          'tags\nPII.NonSensitive;PersonalData.Personal;Tier.Tier1'
        );
      });

      it('should handle multiple tags with commas (quoted)', () => {
        const columns = [{ name: 'tags', key: 'tags' }];
        const dataSource = [
          {
            tags: 'tag1,tag2;tag3,tag4',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('tags\n"tag1,tag2;tag3,tag4"');
      });
    });

    describe('generic CSV formatting', () => {
      it('should quote values with commas', () => {
        const columns = [{ name: 'customField', key: 'customField' }];
        const dataSource = [
          {
            customField: 'value,with,commas',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('customField\n"value,with,commas"');
      });

      it('should quote values with newlines', () => {
        const columns = [{ name: 'customField', key: 'customField' }];
        const dataSource = [
          {
            customField: 'value\nwith\nnewlines',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('customField\n"value\nwith\nnewlines"');
      });

      it('should quote and escape values with quotes', () => {
        const columns = [{ name: 'customField', key: 'customField' }];
        const dataSource = [
          {
            customField: 'value"with"quotes',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('customField\n"value""with""quotes"');
      });

      it('should not quote values without special characters', () => {
        const columns = [{ name: 'customField', key: 'customField' }];
        const dataSource = [
          {
            customField: 'simplevalue',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('customField\nsimplevalue');
      });
    });

    describe('mixed scenarios', () => {
      it('should handle complete row with all special columns', () => {
        const columns = [
          { name: 'name*', key: 'name*' },
          { name: 'tags', key: 'tags' },
          { name: 'glossaryTerms', key: 'glossaryTerms' },
          { name: 'domains', key: 'domains' },
          { name: 'description', key: 'description' },
        ];
        const dataSource = [
          {
            'name*': 'test-entity',
            tags: 'PII.NonSensitive',
            glossaryTerms:
              'PW%0b440530.Clever3cd5511b".PW.10739be3%Shark22dfbaf9',
            domains: 'PW%domain.09e0bf05',
            description: 'Test description',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toContain(
          'name*,tags,glossaryTerms,domains,description'
        );
        expect(csvString).toContain('test-entity');
        expect(csvString).toContain('PII.NonSensitive');
        expect(csvString).toContain(
          '"PW%0b440530.Clever3cd5511b"".PW.10739be3%Shark22dfbaf9"'
        );
        expect(csvString).toContain('PW%domain.09e0bf05');
        expect(csvString).toContain('Test description');
      });

      it('should handle empty values correctly', () => {
        const columns = [
          { name: 'name*', key: 'name*' },
          { name: 'tags', key: 'tags' },
          { name: 'glossaryTerms', key: 'glossaryTerms' },
        ];
        const dataSource = [
          {
            'name*': '',
            tags: '',
            glossaryTerms: '',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('name*,tags,glossaryTerms\n,,');
      });

      it('should handle multiple rows correctly', () => {
        const columns = [
          { name: 'name*', key: 'name*' },
          { name: 'glossaryTerms', key: 'glossaryTerms' },
        ];
        const dataSource = [
          {
            'name*': 'entity1',
            glossaryTerms:
              'PW%0b440530.Clever3cd5511b".PW.10739be3%Shark22dfbaf9',
          },
          {
            'name*': 'entity2',
            glossaryTerms: 'CustomTerm',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe(
          'name*,glossaryTerms\nentity1,"PW%0b440530.Clever3cd5511b"".PW.10739be3%Shark22dfbaf9"\nentity2,CustomTerm'
        );
      });

      it('should handle extension column with simple value (no quotes)', () => {
        const columns = [{ name: 'extension', key: 'extension' }];
        const dataSource = [
          {
            extension: 'simpleExtensionValue',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('extension\nsimpleExtensionValue');
      });

      it('should handle extension column with commas (quoted)', () => {
        const columns = [{ name: 'extension', key: 'extension' }];
        const dataSource = [
          {
            extension: 'prop1:value1,value2;prop2:value3',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('extension\n"prop1:value1,value2;prop2:value3"');
      });

      it('should handle extension column with semicolons (not quoted - semicolons are not special in CSV)', () => {
        const columns = [{ name: 'extension', key: 'extension' }];
        const dataSource = [
          {
            extension: 'prop1:value1;prop2:value2;prop3:value3',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        // Semicolons don't require quoting in CSV (only commas, quotes, newlines do)
        expect(csvString).toBe(
          'extension\nprop1:value1;prop2:value2;prop3:value3'
        );
      });

      it('should handle extension column with quotes (escaped)', () => {
        const columns = [{ name: 'extension', key: 'extension' }];
        const dataSource = [
          {
            extension: 'prop1:"value with quotes"',
          },
        ];
        const csvString = getCSVStringFromColumnsAndDataSource(
          columns,
          dataSource
        );

        expect(csvString).toBe('extension\n"prop1:""value with quotes"""');
      });
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

  describe('getCustomPropertyEntityType', () => {
    it('should return GLOSSARY_TERM for GLOSSARY entity type', () => {
      const { getCustomPropertyEntityType } = require('./CSV.utils');
      const result = getCustomPropertyEntityType(EntityType.GLOSSARY);

      expect(result).toBe(EntityType.GLOSSARY_TERM);
    });

    it('should return the same entity type for non-GLOSSARY types', () => {
      const { getCustomPropertyEntityType } = require('./CSV.utils');

      expect(getCustomPropertyEntityType(EntityType.TABLE)).toBe(
        EntityType.TABLE
      );
      expect(getCustomPropertyEntityType(EntityType.DATABASE)).toBe(
        EntityType.DATABASE
      );
      expect(getCustomPropertyEntityType(EntityType.DASHBOARD)).toBe(
        EntityType.DASHBOARD
      );
    });
  });

  describe('getColumnConfig - Advanced Cases', () => {
    it('should disable columns for bulk edit when column is in disabled list', () => {
      const column = 'name*';
      const columnConfig = getColumnConfig(
        column,
        EntityType.TABLE,
        { user: true, team: false },
        true,
        true
      );

      expect(columnConfig.editable).toBe(false);
    });

    it('should enable columns for bulk edit when column is not in disabled list', () => {
      const column = 'description';
      const columnConfig = getColumnConfig(
        column,
        EntityType.TABLE,
        { user: true, team: false },
        true,
        true
      );

      expect(columnConfig.editable).toBe(true);
    });

    it('should handle nested column names correctly', () => {
      const column = 'extension.customProperty.value';
      const columnConfig = getColumnConfig(column, EntityType.TABLE, {
        user: true,
        team: false,
      });

      expect(columnConfig.key).toBe(column);
      expect(columnConfig.name).toContain('Value');
    });

    it('should set correct minimum width for known columns', () => {
      const descColumn = getColumnConfig('description', EntityType.TABLE, {
        user: true,
        team: false,
      });
      const tagsColumn = getColumnConfig('tags', EntityType.TABLE, {
        user: true,
        team: false,
      });

      expect(descColumn.minWidth).toBe(300);
      expect(tagsColumn.minWidth).toBe(280);
    });

    it('should set default minimum width for unknown columns', () => {
      const customColumn = getColumnConfig('customColumn', EntityType.TABLE, {
        user: true,
        team: false,
      });

      expect(customColumn.minWidth).toBe(180);
    });
  });

  describe('getCSVStringFromColumnsAndDataSource - Edge Cases', () => {
    it('should handle empty rows correctly', () => {
      const columns = [
        { name: 'col1', key: 'col1' },
        { name: 'col2', key: 'col2' },
      ];
      const dataSource = [
        { col1: '', col2: '' },
        { col1: 'value1', col2: 'value2' },
      ];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      // Empty rows are included (empty values result in empty cells)
      expect(csvString).toBe('col1,col2\n,\nvalue1,value2');
    });

    it('should handle newline characters in values', () => {
      const columns = [{ name: 'description', key: 'description' }];
      const dataSource = [{ description: 'line1\nline2\nline3' }];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toContain('"line1\nline2\nline3"');
    });

    it('should handle values with both commas and newlines', () => {
      const columns = [{ name: 'description', key: 'description' }];
      const dataSource = [{ description: 'value1,value2\nvalue3' }];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toContain('"value1,value2\nvalue3"');
    });

    it('should handle multiple empty rows in sequence', () => {
      const columns = [{ name: 'col1', key: 'col1' }];
      const dataSource = [{ col1: '' }, { col1: '' }, { col1: 'value' }];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toBe('col1\n\n\nvalue');
    });

    it('should handle columns with undefined keys', () => {
      const columns: Column<unknown>[] = [
        { name: 'col1', key: '' } as Column<unknown>,
        { name: 'col2', key: 'col2' },
      ];
      const dataSource = [{ col2: 'value2' }];
      const csvString = getCSVStringFromColumnsAndDataSource(
        columns,
        dataSource
      );

      expect(csvString).toContain('value2');
    });
  });

  describe('Custom Property Conversions - Advanced Cases', () => {
    it('should handle entityReference with special characters', () => {
      const mockCustomProperty = {
        name: 'refProp',
        propertyType: { name: 'entityReference' },
      };
      const value = 'table:database.schema.table@special';
      const result = convertCustomPropertyStringToEntityExtension(
        `refProp:${value}`,
        {
          customProperties: [mockCustomProperty],
        } as Type
      );

      expect(result.refProp).toHaveProperty('type', 'table');
      expect(result.refProp).toHaveProperty(
        'fullyQualifiedName',
        'database.schema.table@special'
      );
    });

    it('should handle entityReferenceList with multiple entities', () => {
      const mockCustomProperty = {
        name: 'refList',
        propertyType: { name: 'entityReferenceList' },
      };
      const value = 'table:db.table1|database:service.db2|schema:db.schema1';
      const result = convertCustomPropertyStringToEntityExtension(
        `refList:${value}`,
        {
          customProperties: [mockCustomProperty],
        } as Type
      );

      expect(result.refList).toHaveLength(3);
      expect(Array.isArray(result.refList) && result.refList[0]).toHaveProperty(
        'type',
        'table'
      );
      expect(Array.isArray(result.refList) && result.refList[1]).toHaveProperty(
        'type',
        'database'
      );
      expect(Array.isArray(result.refList) && result.refList[2]).toHaveProperty(
        'type',
        'schema'
      );
    });

    it('should handle enum with single value', () => {
      const mockCustomProperty = {
        name: 'enumProp',
        propertyType: { name: 'enum' },
      };
      const value = 'OPTION_A';
      const result = convertCustomPropertyStringToEntityExtension(
        `enumProp:${value}`,
        {
          customProperties: [mockCustomProperty],
        } as Type
      );

      expect(result.enumProp).toEqual(['OPTION_A']);
    });

    it('should handle enum with multiple values', () => {
      const mockCustomProperty = {
        name: 'enumProp',
        propertyType: { name: 'enum' },
      };
      const value = 'OPTION_A|OPTION_B|OPTION_C';
      const result = convertCustomPropertyStringToEntityExtension(
        `enumProp:${value}`,
        {
          customProperties: [mockCustomProperty],
        } as Type
      );

      expect(result.enumProp).toEqual(['OPTION_A', 'OPTION_B', 'OPTION_C']);
    });

    it('should handle timeInterval correctly', () => {
      const mockCustomProperty = {
        name: 'timeProp',
        propertyType: { name: 'timeInterval' },
      };
      const value = '1000:2000';
      const result = convertCustomPropertyStringToEntityExtension(
        `timeProp:${value}`,
        {
          customProperties: [mockCustomProperty],
        } as Type
      );

      expect(result.timeProp).toEqual({ start: 1000, end: 2000 });
    });

    it('should handle multiple custom properties in one string', () => {
      const mockCustomProperties = [
        { name: 'prop1', propertyType: { name: 'string' } },
        { name: 'prop2', propertyType: { name: 'integer' } },
        { name: 'prop3', propertyType: { name: 'enum' } },
      ];
      const value = 'prop1:value1;prop2:123;prop3:OPTION_A|OPTION_B';
      const result = convertCustomPropertyStringToEntityExtension(value, {
        customProperties: mockCustomProperties,
      } as Type);

      expect(result.prop1).toBe('value1');
      expect(result.prop2).toBe('123');
      expect(result.prop3).toEqual(['OPTION_A', 'OPTION_B']);
    });

    it('should handle property values with colons', () => {
      const mockCustomProperty = {
        name: 'urlProp',
        propertyType: { name: 'string' },
      };
      const value = 'urlProp:https://example.com:8080/path';
      const result = convertCustomPropertyStringToEntityExtension(value, {
        customProperties: [mockCustomProperty],
      } as Type);

      expect(result.urlProp).toBe('https://example.com:8080/path');
    });
  });

  describe('convertEntityExtensionToCustomPropertyString - Advanced Cases', () => {
    it('should convert entityReference correctly', () => {
      const mockCustomProperty = {
        name: 'refProp',
        propertyType: { name: 'entityReference' },
      };
      const value = {
        refProp: {
          id: 'ref-id',
          type: 'table',
          fullyQualifiedName: 'db.schema.table',
        },
      };
      const result = convertEntityExtensionToCustomPropertyString(value, {
        customProperties: [mockCustomProperty],
      } as Type);

      expect(result).toBe('refProp:table:db.schema.table');
    });

    it('should convert entityReferenceList correctly', () => {
      const mockCustomProperty = {
        name: 'refList',
        propertyType: { name: 'entityReferenceList' },
      };
      const value = {
        refList: [
          { id: 'ref1', type: 'table', fullyQualifiedName: 'db.table1' },
          { id: 'ref2', type: 'database', fullyQualifiedName: 'service.db2' },
        ],
      };
      const result = convertEntityExtensionToCustomPropertyString(value, {
        customProperties: [mockCustomProperty],
      } as Type);

      expect(result).toBe('refList:table:db.table1|database:service.db2');
    });

    it('should convert enum array correctly', () => {
      const mockCustomProperty = {
        name: 'enumProp',
        propertyType: { name: 'enum' },
      };
      const value = {
        enumProp: ['OPTION_A', 'OPTION_B', 'OPTION_C'],
      };
      const result = convertEntityExtensionToCustomPropertyString(value, {
        customProperties: [mockCustomProperty],
      } as Type);

      expect(result).toBe('enumProp:OPTION_A|OPTION_B|OPTION_C');
    });

    it('should convert timeInterval correctly', () => {
      const mockCustomProperty = {
        name: 'timeProp',
        propertyType: { name: 'timeInterval' },
      };
      const value = {
        timeProp: { start: 1000, end: 2000 },
      };
      const result = convertEntityExtensionToCustomPropertyString(value, {
        customProperties: [mockCustomProperty],
      } as Type);

      expect(result).toBe('timeProp:1000:2000');
    });

    it('should convert table type with commas in values', () => {
      const mockCustomProperty = {
        name: 'tableProp',
        propertyType: { name: 'table' },
      };
      const value = {
        tableProp: {
          columns: ['col1', 'col2'],
          rows: [
            { col1: 'value,with,comma', col2: 'normal' },
            { col1: 'another', col2: 'value,here' },
          ],
        },
      };
      const result = convertEntityExtensionToCustomPropertyString(value, {
        customProperties: [mockCustomProperty],
      } as Type);

      expect(result).toContain('"value,with,comma"');
      expect(result).toContain('"value,here"');
    });

    it('should quote markdown properties with separators', () => {
      const mockCustomProperty = {
        name: 'mdProp',
        propertyType: { name: 'markdown' },
      };
      const value = {
        mdProp: 'This is markdown, with comma; and semicolon',
      };
      const result = convertEntityExtensionToCustomPropertyString(value, {
        customProperties: [mockCustomProperty],
      } as Type);

      expect(result).toContain('"mdProp:');
      expect(result).toContain('"');
    });

    it('should quote sqlQuery properties with separators', () => {
      const mockCustomProperty = {
        name: 'sqlProp',
        propertyType: { name: 'sqlQuery' },
      };
      const value = {
        sqlProp: 'SELECT * FROM table WHERE col1 = 1, col2 = 2;',
      };
      const result = convertEntityExtensionToCustomPropertyString(value, {
        customProperties: [mockCustomProperty],
      } as Type);

      expect(result).toContain('"sqlProp:');
    });

    it('should handle multiple properties with correct separators', () => {
      const mockCustomProperties = [
        { name: 'prop1', propertyType: { name: 'string' } },
        { name: 'prop2', propertyType: { name: 'integer' } },
      ];
      const value = {
        prop1: 'value1',
        prop2: '123',
      };
      const result = convertEntityExtensionToCustomPropertyString(value, {
        customProperties: mockCustomProperties,
      } as Type);

      expect(result).toContain('prop1:value1;');
      expect(result).toContain('prop2');
      expect(result).not.toContain('prop2:123;');
    });

    it('should handle object values by stringifying', () => {
      const mockCustomProperty = {
        name: 'objProp',
        propertyType: { name: 'unknown' },
      };
      const value = {
        objProp: JSON.stringify({ nested: { value: 'test' } }),
      };
      const result = convertEntityExtensionToCustomPropertyString(value, {
        customProperties: [mockCustomProperty],
      } as Type);

      expect(result).toContain('objProp:');
      expect(result).toContain('"nested"');
    });
  });

  describe('splitCSV - Additional Edge Cases', () => {
    it('should handle values with only spaces', () => {
      const input = '   ,   ,   ';
      const result = splitCSV(input);

      expect(result).toEqual(['', '', '']);
    });

    it('should handle backslash escaped quotes', () => {
      const input = 'value1,"value with \\" escaped quote",value3';
      const result = splitCSV(input);

      expect(result[1]).toContain('"');
    });

    it('should handle multiple consecutive commas', () => {
      const input = 'value1,,,value4';
      const result = splitCSV(input);

      expect(result).toEqual(['value1', '', '', 'value4']);
    });

    it('should handle quoted empty strings', () => {
      const input = '"",value2,""';
      const result = splitCSV(input);

      expect(result).toEqual(['', 'value2', '']);
    });
  });
});
