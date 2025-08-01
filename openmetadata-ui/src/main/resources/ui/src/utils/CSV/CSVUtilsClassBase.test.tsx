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
import csvUtilsClassBase from './CSVUtilsClassBase';

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

describe('CSV utils ClassBase', () => {
  describe('getEditor', () => {
    it('should return the editor component for the specified column', () => {
      const column = 'owner';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBeDefined();
    });

    it('should return default textEditor for unknown columns', () => {
      const column = 'unknown';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBe(textEditor);
    });

    it('should return the editor component for the "description" column', () => {
      const column = 'description';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "tags" column', () => {
      const column = 'tags';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "glossaryTerms" column', () => {
      const column = 'glossaryTerms';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "tiers" column', () => {
      const column = 'tiers';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "extension" column', () => {
      const column = 'extension';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "reviewers" column', () => {
      const column = 'reviewers';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "domains" column', () => {
      const column = 'domains';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "relatedTerms" column', () => {
      const column = 'relatedTerms';
      const editor = csvUtilsClassBase.getEditor(column, EntityType.GLOSSARY);

      expect(editor).toBeDefined();
    });
  });
});
