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
import { SuggestionProps } from '@tiptap/suggestion';
import tippy, { Instance, Props } from 'tippy.js';
import renderItems from './renderItems';

const mockSetProps = jest.fn();
const mockTippyInstance: Partial<Instance<Props>> = {
  destroy: jest.fn(),
  hide: jest.fn(),
  setProps: mockSetProps,
  state: { isDestroyed: false } as Instance<Props>['state'],
};

jest.mock('tippy.js', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue([
    {
      destroy: jest.fn(),
      hide: jest.fn(),
      setProps: jest.fn(),
      state: { isDestroyed: false },
    },
  ]),
}));

jest.mock('@tiptap/react', () => ({
  ReactRenderer: jest.fn().mockImplementation(() => ({
    element: document.createElement('div'),
    updateProps: jest.fn(),
    ref: null,
  })),
}));

jest.mock('../getDialogContainer', () => ({
  getDialogContainer: jest.fn().mockReturnValue(document.body),
}));

jest.mock('./SlashCommandList', () => ({
  SlashCommandList: jest.fn(),
}));

const mockTippy = tippy as jest.MockedFunction<typeof tippy>;

const makeSuggestionProps = (
  clientRect: SuggestionProps['clientRect'],
  editorOverrides: Partial<SuggestionProps['editor']> = {}
): Partial<SuggestionProps> => ({
  clientRect,
  editor: {
    view: {},
    isActive: jest.fn().mockReturnValue(false),
    ...editorOverrides,
  } as SuggestionProps['editor'],
  items: [],
  command: jest.fn(),
  query: '',
  text: '',
  range: {} as SuggestionProps['range'],
  decorationNode: null,
});

describe('renderItems getReferenceClientRect null safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTippy.mockReturnValue([mockTippyInstance as Instance<Props>]);
  });

  describe('onStart', () => {
    it('should not call tippy when clientRect is null', () => {
      const handler = renderItems();

      handler.onStart(makeSuggestionProps(null) as SuggestionProps);

      expect(mockTippy).not.toHaveBeenCalled();
    });

    it('should not call tippy when editor is in a table', () => {
      const handler = renderItems();

      handler.onStart(
        makeSuggestionProps(() => new DOMRect(), {
          isActive: jest.fn().mockReturnValue(true),
        }) as SuggestionProps
      );

      expect(mockTippy).not.toHaveBeenCalled();
    });

    it('should pass a getReferenceClientRect that returns DOMRect when clientRect returns null', () => {
      const handler = renderItems();

      handler.onStart(makeSuggestionProps(() => null) as SuggestionProps);

      const [, options] = mockTippy.mock.calls[0];
      const result = options.getReferenceClientRect?.();

      expect(result).toBeInstanceOf(DOMRect);
    });

    it('should pass a getReferenceClientRect that returns the rect from a valid clientRect', () => {
      const rect = new DOMRect(10, 20, 100, 40);
      const handler = renderItems();

      handler.onStart(makeSuggestionProps(() => rect) as SuggestionProps);

      const [, options] = mockTippy.mock.calls[0];
      const result = options.getReferenceClientRect?.();

      expect(result).toBe(rect);
    });

    it('getReferenceClientRect should never throw even when clientRect returns null', () => {
      const handler = renderItems();

      handler.onStart(makeSuggestionProps(() => null) as SuggestionProps);

      const [, options] = mockTippy.mock.calls[0];

      expect(() => options.getReferenceClientRect?.()).not.toThrow();
    });
  });

  describe('onUpdate', () => {
    it('should not call setProps when clientRect is null', () => {
      const handler = renderItems();
      handler.onStart(
        makeSuggestionProps(() => new DOMRect()) as SuggestionProps
      );

      handler.onUpdate(makeSuggestionProps(null) as SuggestionProps);

      expect(mockTippyInstance.setProps).not.toHaveBeenCalled();
    });

    it('should pass a getReferenceClientRect that returns DOMRect when clientRect returns null', () => {
      const handler = renderItems();
      handler.onStart(
        makeSuggestionProps(() => new DOMRect()) as SuggestionProps
      );

      handler.onUpdate(makeSuggestionProps(() => null) as SuggestionProps);

      const { getReferenceClientRect } =
        mockTippyInstance.setProps.mock.calls[0][0];
      const result = getReferenceClientRect();

      expect(result).toBeInstanceOf(DOMRect);
    });

    it('should pass a getReferenceClientRect that returns the rect from a valid clientRect', () => {
      const rect = new DOMRect(5, 10, 200, 30);
      const handler = renderItems();
      handler.onStart(
        makeSuggestionProps(() => new DOMRect()) as SuggestionProps
      );

      handler.onUpdate(makeSuggestionProps(() => rect) as SuggestionProps);

      const { getReferenceClientRect } =
        mockTippyInstance.setProps.mock.calls[0][0];

      expect(getReferenceClientRect()).toBe(rect);
    });
  });
});
