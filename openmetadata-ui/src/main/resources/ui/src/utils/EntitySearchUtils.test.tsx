/*
 *  Copyright 2023 Collate.
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
import { render } from '@testing-library/react';
import {
  highlightEntityNameAndDescription,
  highlightSearchArrayElement,
  highlightSearchText,
} from './EntitySearchUtils';
import {
  entityWithoutNameAndDescHighlight,
  highlightedEntityDescription,
  highlightedEntityDisplayName,
  mockHighlightedResult,
  mockHighlights,
  mockSearchText,
  mockText,
} from './mocks/EntityUtils.mock';

jest.mock('./StringUtils', () => ({
  bytesToSize: jest.fn(),
  getEncodedFqn: jest.fn(),
  stringToHTML: jest.fn().mockImplementation((value) => value),
}));

jest.mock('./FqnUtils', () => ({
  getPartialNameFromTableFQN: jest.fn().mockImplementation((value) => value),
  getTableFQNFromColumnFQN: jest.fn().mockImplementation((value) => value),
}));

describe('EntitySearchUtils unit tests', () => {
  describe('highlightEntityNameAndDescription method', () => {
    it('highlightEntityNameAndDescription method should return the entity with highlighted name and description', () => {
      const highlightedEntity = highlightEntityNameAndDescription(
        entityWithoutNameAndDescHighlight,
        mockHighlights
      );

      expect(highlightedEntity.displayName).toBe(highlightedEntityDisplayName);
      expect(highlightedEntity.description).toBe(highlightedEntityDescription);
    });
  });

  describe('highlightSearchText method', () => {
    it('should return the text with highlighted search text', () => {
      const result = highlightSearchText(mockText, mockSearchText);

      expect(result).toBe(mockHighlightedResult);
    });

    it('should return the original text if searchText is not found', () => {
      const result = highlightSearchText(mockText, 'nonexistent');

      expect(result).toBe(mockText);
    });

    it('should return an empty string if no text is provided', () => {
      const result = highlightSearchText('', 'test');

      expect(result).toBe('');
    });

    it('should return an empty string if no searchText is provided', () => {
      const result = highlightSearchText(mockText, '');

      expect(result).toBe(mockText);
    });

    it('should return empty string if both text and searchText are missing', () => {
      const result = highlightSearchText('', '');

      expect(result).toBe('');
    });

    const falsyTestCases = [
      { text: null, searchText: 'test', expected: '' },
      { text: 'mockText', searchText: null, expected: 'mockText' },
      { text: null, searchText: null, expected: '' },
      { text: 0, searchText: '', expected: 0 },
      { text: false, searchText: '', expected: false },
    ];

    it.each(falsyTestCases)(
      'should return expected when text or searchText is null or falsy',
      ({ text, searchText, expected }) => {
        const result = highlightSearchText(
          (text as string) ?? undefined,
          searchText ?? undefined
        );

        expect(result).toBe(expected);
      }
    );
  });

  describe('highlightSearchArrayElement method', () => {
    it('should highlight the searchText in the text', () => {
      const result = highlightSearchArrayElement(mockText, 'highlightText');
      const { container } = render(<>{result}</>);

      const highlighted = container.querySelector('.text-highlighter');

      expect(highlighted).toBeInTheDocument();
      expect(highlighted?.textContent).toBe('highlightText');
    });

    it('should highlight multiple occurrences of the searchText', () => {
      const result = highlightSearchArrayElement(
        'Data testing environment, Manually test data',
        'data'
      );
      const { container } = render(<>{result}</>);

      const highlightedElements =
        container.querySelectorAll('.text-highlighter');

      expect(highlightedElements).toHaveLength(2);
      expect(highlightedElements[0].textContent).toBe('Data');
      expect(highlightedElements[1].textContent).toBe('data');
    });

    it('should not modify parts of the text that do not match searchText', () => {
      const result = highlightSearchArrayElement(mockText, 'highlightText');
      const { container } = render(<>{result}</>);

      const nonHighlighted = container.textContent;

      expect(nonHighlighted).toContain('description');
    });

    it('should not wrap searchText in the result if it does not appear in text', () => {
      const result = highlightSearchArrayElement(mockText, 'foo');
      const { container } = render(<>{result}</>);

      const highlighted = container.querySelector('.text-highlighter');

      expect(highlighted).toBeNull();
    });

    it('should handle case-insensitive search', () => {
      const result = highlightSearchArrayElement(mockText, 'HighlightText');
      const { container } = render(<>{result}</>);

      const highlighted = container.querySelector('.text-highlighter');

      expect(highlighted).toBeInTheDocument();
      expect(highlighted?.textContent).toBe('highlightText');
    });

    it('should return an empty string if no text is provided', () => {
      const result = highlightSearchArrayElement('', 'test');

      expect(result).toBe('');
    });

    it('should return an empty string if no searchText is provided', () => {
      const result = highlightSearchArrayElement(mockText, '');

      expect(result).toBe(mockText);
    });

    it('should return empty string if both text and searchText are missing', () => {
      const result = highlightSearchArrayElement('', '');

      expect(result).toBe('');
    });

    const falsyTestCases = [
      { text: null, searchText: 'test', expected: '' },
      { text: 'mockText', searchText: null, expected: 'mockText' },
      { text: null, searchText: null, expected: '' },
      { text: 0 as unknown as string, searchText: '', expected: 0 },
      { text: false as unknown as string, searchText: '', expected: false },
    ];

    it.each(falsyTestCases)(
      'should return expected when text or searchText is null or falsy',
      ({ text, searchText, expected }) => {
        const result = highlightSearchArrayElement(
          text ?? undefined,
          searchText ?? undefined
        );

        expect(result).toBe(expected);
      }
    );
  });
});
