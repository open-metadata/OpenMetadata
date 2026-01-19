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
import { textEditor } from 'react-data-grid';
import { EntityType } from '../../enums/entity.enum';
import csvUtilsClassBase, { CSVUtilsClassBase } from './CSVUtilsClassBase';

jest.mock(
  '../../components/common/AsyncSelectList/TreeAsyncSelectList',
  () => ({
    __esModule: true,
    default: jest.fn(),
  })
);

jest.mock(
  '../../components/common/DomainSelectableList/DomainSelectableList.component',
  () => ({
    __esModule: true,
    default: jest.fn(),
  })
);

jest.mock('../../components/common/InlineEdit/InlineEdit.component', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../components/common/TierCard/TierCard', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock(
  '../../components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    __esModule: true,
    UserTeamSelectableList: jest
      .fn()
      .mockReturnValue(<p>UserTeamSelectableList</p>),
  })
);

jest.mock(
  '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    __esModule: true,
    ModalWithMarkdownEditor: jest.fn(),
  })
);
jest.mock(
  '../../components/Modals/ModalWithCustomProperty/ModalWithCustomPropertyEditor.component',
  () => ({
    __esModule: true,
    ModalWithCustomPropertyEditor: jest.fn(),
  })
);

const multipleOwner = {
  user: true,
  team: false,
};

describe('CSV utils ClassBase', () => {
  let csvUtils: CSVUtilsClassBase;

  beforeEach(() => {
    csvUtils = new CSVUtilsClassBase();
  });

  describe('hideImportsColumnList', () => {
    it('should return array of columns to hide during import', () => {
      const result = csvUtils.hideImportsColumnList();

      expect(result).toEqual(['glossaryStatus', 'inspectionQuery']);
      expect(result).toHaveLength(2);
    });

    it('should return a new array instance each time', () => {
      const result1 = csvUtils.hideImportsColumnList();
      const result2 = csvUtils.hideImportsColumnList();

      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
    });

    it('should include glossaryStatus column', () => {
      const result = csvUtils.hideImportsColumnList();

      expect(result).toContain('glossaryStatus');
    });

    it('should include inspectionQuery column', () => {
      const result = csvUtils.hideImportsColumnList();

      expect(result).toContain('inspectionQuery');
    });
  });

  describe('columnsWithMultipleValuesEscapeNeeded', () => {
    it('should return array of columns that need escape handling', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include basic columns', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(result).toContain('parent');
      expect(result).toContain('extension');
      expect(result).toContain('synonyms');
      expect(result).toContain('description');
      expect(result).toContain('tags');
      expect(result).toContain('glossaryTerms');
      expect(result).toContain('relatedTerms');
    });

    it('should include column-specific fields', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(result).toContain('column.description');
      expect(result).toContain('column.tags');
      expect(result).toContain('column.glossaryTerms');
      expect(result).toContain('column.name*');
    });

    it('should include special fields', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(result).toContain('storedProcedure.code');
      expect(result).toContain('name*');
      expect(result).toContain('parameterValues');
    });

    it('should return correct number of columns', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(result.length).toBeGreaterThan(10);
    });
  });

  describe('getEditor', () => {
    it('should return the editor component for the specified column', () => {
      const column = 'owner';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return default textEditor for unknown columns', () => {
      const column = 'unknown';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBe(textEditor);
    });

    it('should return the editor component for the "description" column', () => {
      const column = 'description';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "tags" column', () => {
      const column = 'tags';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "glossaryTerms" column', () => {
      const column = 'glossaryTerms';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "tiers" column', () => {
      const column = 'tiers';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "extension" column', () => {
      const column = 'extension';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "reviewers" column', () => {
      const column = 'reviewers';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "domains" column', () => {
      const column = 'domains';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "relatedTerms" column', () => {
      const column = 'relatedTerms';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return editor for certification column', () => {
      const editor = csvUtils.getEditor(
        'certification',
        EntityType.TABLE,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return editor for entityType* column', () => {
      const editor = csvUtils.getEditor(
        'entityType*',
        EntityType.TABLE,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return editor for code column', () => {
      const editor = csvUtils.getEditor(
        'code',
        EntityType.TABLE,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should handle different entity types', () => {
      const tableEditor = csvUtils.getEditor(
        'owner',
        EntityType.TABLE,
        multipleOwner
      );
      const databaseEditor = csvUtils.getEditor(
        'owner',
        EntityType.DATABASE,
        multipleOwner
      );
      const dashboardEditor = csvUtils.getEditor(
        'owner',
        EntityType.DASHBOARD,
        multipleOwner
      );

      expect(tableEditor).toBeDefined();
      expect(databaseEditor).toBeDefined();
      expect(dashboardEditor).toBeDefined();
    });

    it('should handle multiple owner configurations', () => {
      const userOnly = csvUtils.getEditor('owner', EntityType.TABLE, {
        user: true,
        team: false,
      });
      const teamOnly = csvUtils.getEditor('owner', EntityType.TABLE, {
        user: false,
        team: true,
      });
      const both = csvUtils.getEditor('owner', EntityType.TABLE, {
        user: true,
        team: true,
      });

      expect(userOnly).toBeDefined();
      expect(teamOnly).toBeDefined();
      expect(both).toBeDefined();
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(csvUtilsClassBase).toBeInstanceOf(CSVUtilsClassBase);
    });

    it('should have all methods available on singleton', () => {
      expect(csvUtilsClassBase.hideImportsColumnList).toBeDefined();
      expect(
        csvUtilsClassBase.columnsWithMultipleValuesEscapeNeeded
      ).toBeDefined();
      expect(csvUtilsClassBase.getEditor).toBeDefined();
    });
  });
});
