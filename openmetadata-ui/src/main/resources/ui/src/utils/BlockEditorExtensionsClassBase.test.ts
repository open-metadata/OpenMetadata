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

import { Extensions } from '@tiptap/react';
import blockEditorExtensionsClassBase, {
  BlockEditorExtensionsClassBase,
} from './BlockEditorExtensionsClassBase';

interface MockExtension {
  name: string;
}

// Mock TipTap extensions
jest.mock('@tiptap/starter-kit', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'StarterKit' })),
  },
}));

jest.mock('@tiptap/extension-placeholder', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'Placeholder' })),
  },
}));

jest.mock('@tiptap/extension-table', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'Table' })),
  },
}));

jest.mock('@tiptap/extension-table-cell', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'TableCell' })),
  },
}));

jest.mock('@tiptap/extension-table-header', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'TableHeader' })),
  },
}));

jest.mock('@tiptap/extension-table-row', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'TableRow' })),
  },
}));

jest.mock('@tiptap/extension-task-item', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'TaskItem' })),
  },
}));

jest.mock('@tiptap/extension-task-list', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'TaskList' })),
  },
}));

jest.mock(
  '../components/BlockEditor/Extensions/BlockAndDragDrop/BlockAndDragDrop',
  () => ({
    __esModule: true,
    default: { name: 'BlockAndDragDrop' },
  })
);

jest.mock('../components/BlockEditor/Extensions/Callout/Callout', () => ({
  Callout: { name: 'Callout' },
}));

jest.mock('../components/BlockEditor/Extensions/diff-view', () => ({
  __esModule: true,
  default: { name: 'DiffView' },
}));

jest.mock('../components/BlockEditor/Extensions/File/FileNode', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'FileNode' })),
  },
}));

jest.mock('../components/BlockEditor/Extensions/focus', () => ({
  Focus: {
    configure: jest.fn(() => ({ name: 'Focus' })),
  },
}));

jest.mock('../components/BlockEditor/Extensions/hashtag', () => ({
  Hashtag: {
    configure: jest.fn(() => ({ name: 'Hashtag' })),
  },
  hashtagSuggestion: jest.fn(() => ({ name: 'hashtagSuggestion' })),
}));

jest.mock('../components/BlockEditor/Extensions/link', () => ({
  LinkExtension: {
    configure: jest.fn(() => ({ name: 'LinkExtension' })),
  },
}));

jest.mock(
  '../components/BlockEditor/Extensions/MathEquation/MathEquation',
  () => ({
    __esModule: true,
    default: { name: 'MathEquation' },
  })
);

jest.mock('../components/BlockEditor/Extensions/mention', () => ({
  Mention: {
    configure: jest.fn(() => ({ name: 'Mention' })),
  },
  mentionSuggestion: jest.fn(() => ({ name: 'mentionSuggestion' })),
}));

jest.mock('../components/BlockEditor/Extensions/slash-command', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({ name: 'slashCommand' })),
  },
}));

jest.mock('../components/BlockEditor/Extensions/slash-command/items', () => ({
  getSuggestionItems: jest.fn(),
}));

jest.mock(
  '../components/BlockEditor/Extensions/slash-command/renderItems',
  () => ({
    __esModule: true,
    default: jest.fn(),
  })
);

jest.mock('../components/BlockEditor/Extensions/text-highlight-view', () => ({
  __esModule: true,
  default: { name: 'TextHighlightView' },
}));

jest.mock('../components/BlockEditor/Extensions/trailing-node', () => ({
  TrailingNode: { name: 'TrailingNode' },
}));

describe('BlockEditorExtensionsClassBase', () => {
  let extensionsClass: BlockEditorExtensionsClassBase;

  beforeEach(() => {
    extensionsClass = new BlockEditorExtensionsClassBase();
    jest.clearAllMocks();
  });

  describe('getCoreExtensions', () => {
    it('should return core extensions array', () => {
      // Access protected method for testing
      const coreExtensions = (
        extensionsClass as unknown as {
          getCoreExtensions: () => Extensions;
        }
      ).getCoreExtensions();

      expect(coreExtensions).toBeDefined();
      expect(Array.isArray(coreExtensions)).toBe(true);
      expect(coreExtensions.length).toBeGreaterThan(0);
    });

    it('should include StarterKit extension', () => {
      const coreExtensions = (
        extensionsClass as unknown as {
          getCoreExtensions: () => Extensions;
        }
      ).getCoreExtensions();
      const starterKit = coreExtensions.find(
        (ext: MockExtension) => ext.name === 'StarterKit'
      );

      expect(starterKit).toBeDefined();
    });

    it('should include Placeholder extension', () => {
      const coreExtensions = (
        extensionsClass as unknown as {
          getCoreExtensions: () => Extensions;
        }
      ).getCoreExtensions();
      const placeholder = coreExtensions.find(
        (ext: MockExtension) => ext.name === 'Placeholder'
      );

      expect(placeholder).toBeDefined();
    });

    it('should include LinkExtension', () => {
      const coreExtensions = (
        extensionsClass as unknown as {
          getCoreExtensions: () => Extensions;
        }
      ).getCoreExtensions();
      const link = coreExtensions.find(
        (ext: MockExtension) => ext.name === 'LinkExtension'
      );

      expect(link).toBeDefined();
    });

    it('should include slash command extension', () => {
      const coreExtensions = (
        extensionsClass as unknown as {
          getCoreExtensions: () => Extensions;
        }
      ).getCoreExtensions();
      const slashCommand = coreExtensions.find(
        (ext: MockExtension) => ext.name === 'slashCommand'
      );

      expect(slashCommand).toBeDefined();
    });

    it('should include TaskList and TaskItem extensions', () => {
      const coreExtensions = (
        extensionsClass as unknown as {
          getCoreExtensions: () => Extensions;
        }
      ).getCoreExtensions();
      const taskList = coreExtensions.find(
        (ext: MockExtension) => ext.name === 'TaskList'
      );
      const taskItem = coreExtensions.find(
        (ext: MockExtension) => ext.name === 'TaskItem'
      );

      expect(taskList).toBeDefined();
      expect(taskItem).toBeDefined();
    });

    it('should include Mention extension', () => {
      const coreExtensions = (
        extensionsClass as unknown as {
          getCoreExtensions: () => Extensions;
        }
      ).getCoreExtensions();
      const mention = coreExtensions.find(
        (ext: MockExtension) => ext.name === 'Mention'
      );

      expect(mention).toBeDefined();
    });

    it('should include Hashtag extension', () => {
      const coreExtensions = (
        extensionsClass as unknown as {
          getCoreExtensions: () => Extensions;
        }
      ).getCoreExtensions();
      const hashtag = coreExtensions.find(
        (ext: MockExtension) => ext.name === 'Hashtag'
      );

      expect(hashtag).toBeDefined();
    });
  });

  describe('getHandlebarsExtensions', () => {
    it('should return empty array by default', () => {
      const handlebarsExtensions = (
        extensionsClass as unknown as {
          getHandlebarsExtensions: () => Extensions;
        }
      ).getHandlebarsExtensions();

      expect(handlebarsExtensions).toBeDefined();
      expect(Array.isArray(handlebarsExtensions)).toBe(true);
      expect(handlebarsExtensions).toHaveLength(0);
    });
  });

  describe('getUtilityExtensions', () => {
    it('should return utility extensions array', () => {
      const utilityExtensions = (
        extensionsClass as unknown as {
          getUtilityExtensions: () => Extensions;
        }
      ).getUtilityExtensions();

      expect(utilityExtensions).toBeDefined();
      expect(Array.isArray(utilityExtensions)).toBe(true);
      expect(utilityExtensions.length).toBeGreaterThan(0);
    });

    it('should include DiffView extension', () => {
      const utilityExtensions = (
        extensionsClass as unknown as {
          getUtilityExtensions: () => Extensions;
        }
      ).getUtilityExtensions();
      const diffView = utilityExtensions.find(
        (ext: MockExtension) => ext.name === 'DiffView'
      );

      expect(diffView).toBeDefined();
    });

    it('should include TextHighlightView extension', () => {
      const utilityExtensions = (
        extensionsClass as unknown as {
          getUtilityExtensions: () => Extensions;
        }
      ).getUtilityExtensions();
      const textHighlight = utilityExtensions.find(
        (ext: MockExtension) => ext.name === 'TextHighlightView'
      );

      expect(textHighlight).toBeDefined();
    });

    it('should include BlockAndDragDrop extension', () => {
      const utilityExtensions = (
        extensionsClass as unknown as {
          getUtilityExtensions: () => Extensions;
        }
      ).getUtilityExtensions();
      const blockDragDrop = utilityExtensions.find(
        (ext: MockExtension) => ext.name === 'BlockAndDragDrop'
      );

      expect(blockDragDrop).toBeDefined();
    });

    it('should include Focus extension', () => {
      const utilityExtensions = (
        extensionsClass as unknown as {
          getUtilityExtensions: () => Extensions;
        }
      ).getUtilityExtensions();
      const focus = utilityExtensions.find(
        (ext: MockExtension) => ext.name === 'Focus'
      );

      expect(focus).toBeDefined();
    });

    it('should include Callout extension', () => {
      const utilityExtensions = (
        extensionsClass as unknown as {
          getUtilityExtensions: () => Extensions;
        }
      ).getUtilityExtensions();
      const callout = utilityExtensions.find(
        (ext: MockExtension) => ext.name === 'Callout'
      );

      expect(callout).toBeDefined();
    });
  });

  describe('getTableExtensions', () => {
    it('should return table extensions array', () => {
      const tableExtensions = (
        extensionsClass as unknown as {
          getTableExtensions: () => Extensions;
        }
      ).getTableExtensions();

      expect(tableExtensions).toBeDefined();
      expect(Array.isArray(tableExtensions)).toBe(true);
      expect(tableExtensions.length).toBeGreaterThan(0);
    });

    it('should include Table extension', () => {
      const tableExtensions = (
        extensionsClass as unknown as {
          getTableExtensions: () => Extensions;
        }
      ).getTableExtensions();
      const table = tableExtensions.find(
        (ext: MockExtension) => ext.name === 'Table'
      );

      expect(table).toBeDefined();
    });

    it('should include TableRow extension', () => {
      const tableExtensions = (
        extensionsClass as unknown as {
          getTableExtensions: () => Extensions;
        }
      ).getTableExtensions();
      const tableRow = tableExtensions.find(
        (ext: MockExtension) => ext.name === 'TableRow'
      );

      expect(tableRow).toBeDefined();
    });

    it('should include TableHeader extension', () => {
      const tableExtensions = (
        extensionsClass as unknown as {
          getTableExtensions: () => Extensions;
        }
      ).getTableExtensions();
      const tableHeader = tableExtensions.find(
        (ext: MockExtension) => ext.name === 'TableHeader'
      );

      expect(tableHeader).toBeDefined();
    });

    it('should include TableCell extension', () => {
      const tableExtensions = (
        extensionsClass as unknown as {
          getTableExtensions: () => Extensions;
        }
      ).getTableExtensions();
      const tableCell = tableExtensions.find(
        (ext: MockExtension) => ext.name === 'TableCell'
      );

      expect(tableCell).toBeDefined();
    });
  });

  describe('getAdvancedContentExtensions', () => {
    it('should return advanced content extensions array', () => {
      const advancedExtensions = (
        extensionsClass as unknown as {
          getAdvancedContentExtensions: () => Extensions;
        }
      ).getAdvancedContentExtensions();

      expect(advancedExtensions).toBeDefined();
      expect(Array.isArray(advancedExtensions)).toBe(true);
      expect(advancedExtensions.length).toBeGreaterThan(0);
    });

    it('should include MathEquation extension', () => {
      const advancedExtensions = (
        extensionsClass as unknown as {
          getAdvancedContentExtensions: () => Extensions;
        }
      ).getAdvancedContentExtensions();
      const mathEquation = advancedExtensions.find(
        (ext: MockExtension) => ext.name === 'MathEquation'
      );

      expect(mathEquation).toBeDefined();
    });

    it('should include TrailingNode extension', () => {
      const advancedExtensions = (
        extensionsClass as unknown as {
          getAdvancedContentExtensions: () => Extensions;
        }
      ).getAdvancedContentExtensions();
      const trailingNode = advancedExtensions.find(
        (ext: MockExtension) => ext.name === 'TrailingNode'
      );

      expect(trailingNode).toBeDefined();
    });

    it('should include FileNode extension', () => {
      const advancedExtensions = (
        extensionsClass as unknown as {
          getAdvancedContentExtensions: () => Extensions;
        }
      ).getAdvancedContentExtensions();
      const fileNode = advancedExtensions.find(
        (ext: MockExtension) => ext.name === 'FileNode'
      );

      expect(fileNode).toBeDefined();
    });
  });

  describe('getExtensions', () => {
    it('should return all extensions combined', () => {
      const allExtensions = extensionsClass.getExtensions();

      expect(allExtensions).toBeDefined();
      expect(Array.isArray(allExtensions)).toBe(true);
      expect(allExtensions.length).toBeGreaterThan(0);
    });

    it('should include extensions from all categories', () => {
      const allExtensions = extensionsClass.getExtensions();

      // Check for core extensions
      const starterKit = allExtensions.find(
        (ext: MockExtension) => ext.name === 'StarterKit'
      );
      // Check for utility extensions
      const diffView = allExtensions.find(
        (ext: MockExtension) => ext.name === 'DiffView'
      );
      // Check for table extensions
      const table = allExtensions.find(
        (ext: MockExtension) => ext.name === 'Table'
      );
      // Check for advanced extensions
      const mathEquation = allExtensions.find(
        (ext: MockExtension) => ext.name === 'MathEquation'
      );

      expect(starterKit).toBeDefined();
      expect(diffView).toBeDefined();
      expect(table).toBeDefined();
      expect(mathEquation).toBeDefined();
    });

    it('should return the same extensions on multiple calls', () => {
      const extensions1 = extensionsClass.getExtensions();
      const extensions2 = extensionsClass.getExtensions();

      expect(extensions1).toHaveLength(extensions2.length);
    });
  });

  describe('serializeContentForBackend', () => {
    it('should return the input HTML unchanged by default', () => {
      const inputHtml = '<p>Test content</p>';
      const result = extensionsClass.serializeContentForBackend(inputHtml);

      expect(result).toBe(inputHtml);
    });

    it('should handle empty string', () => {
      const result = extensionsClass.serializeContentForBackend('');

      expect(result).toBe('');
    });

    it('should handle complex HTML', () => {
      const complexHtml =
        '<div><p>Test</p><ul><li>Item 1</li><li>Item 2</li></ul></div>';
      const result = extensionsClass.serializeContentForBackend(complexHtml);

      expect(result).toBe(complexHtml);
    });
  });

  describe('parseContentFromBackend', () => {
    it('should return the input HTML unchanged by default', () => {
      const inputHtml = '<p>Test content</p>';
      const result = extensionsClass.parseContentFromBackend(inputHtml);

      expect(result).toBe(inputHtml);
    });

    it('should handle empty string', () => {
      const result = extensionsClass.parseContentFromBackend('');

      expect(result).toBe('');
    });

    it('should handle complex HTML', () => {
      const complexHtml =
        '<div><p>Test</p><ul><li>Item 1</li><li>Item 2</li></ul></div>';
      const result = extensionsClass.parseContentFromBackend(complexHtml);

      expect(result).toBe(complexHtml);
    });
  });

  describe('extensibility', () => {
    it('should allow subclasses to override getHandlebarsExtensions', () => {
      class ExtendedClass extends BlockEditorExtensionsClassBase {
        protected getHandlebarsExtensions(): Extensions {
          return [{ name: 'CustomHandlebars' }] as Extensions;
        }
      }

      const extended = new ExtendedClass();
      const extensions = extended.getExtensions({ enableHandlebars: true });
      const customHandlebars = extensions.find(
        (ext: MockExtension) => ext.name === 'CustomHandlebars'
      );

      expect(customHandlebars).toBeDefined();
    });

    it('should allow subclasses to override serializeContentForBackend', () => {
      class ExtendedClass extends BlockEditorExtensionsClassBase {
        public serializeContentForBackend(html: string): string {
          return html.toUpperCase();
        }
      }

      const extended = new ExtendedClass();
      const result = extended.serializeContentForBackend('<p>test</p>');

      expect(result).toBe('<P>TEST</P>');
    });

    it('should allow subclasses to override parseContentFromBackend', () => {
      class ExtendedClass extends BlockEditorExtensionsClassBase {
        public parseContentFromBackend(html: string): string {
          return html.toLowerCase();
        }
      }

      const extended = new ExtendedClass();
      const result = extended.parseContentFromBackend('<P>TEST</P>');

      expect(result).toBe('<p>test</p>');
    });

    it('should allow subclasses to add custom extensions to each category', () => {
      class ExtendedClass extends BlockEditorExtensionsClassBase {
        protected getCoreExtensions(): Extensions {
          return [
            ...super.getCoreExtensions(),
            { name: 'CustomCore' },
          ] as Extensions;
        }

        protected getUtilityExtensions(): Extensions {
          return [
            ...super.getUtilityExtensions(),
            { name: 'CustomUtility' },
          ] as Extensions;
        }
      }

      const extended = new ExtendedClass();
      const extensions = extended.getExtensions();

      const customCore = extensions.find(
        (ext: MockExtension) => ext.name === 'CustomCore'
      );
      const customUtility = extensions.find(
        (ext: MockExtension) => ext.name === 'CustomUtility'
      );

      expect(customCore).toBeDefined();
      expect(customUtility).toBeDefined();
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(blockEditorExtensionsClassBase).toBeInstanceOf(
        BlockEditorExtensionsClassBase
      );
    });

    it('should use the same instance across imports', () => {
      const instance1 = blockEditorExtensionsClassBase;
      const instance2 = blockEditorExtensionsClassBase;

      expect(instance1).toBe(instance2);
    });
  });
});
