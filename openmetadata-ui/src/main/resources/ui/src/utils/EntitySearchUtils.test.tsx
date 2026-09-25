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
  renderHighlightedText,
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

    it('should treat regex metacharacters in searchText as literal text', () => {
      const result = highlightSearchText('value is a(b', 'a(b');

      expect(result).toBe(
        'value is <span data-highlight="true" class="text-highlighter">a(b</span>'
      );
    });

    it('should not throw on an unbalanced regex metacharacter in searchText', () => {
      const result = highlightSearchText('an [open bracket', '[');

      expect(result).toBe(
        'an <span data-highlight="true" class="text-highlighter">[</span>open bracket'
      );
    });

    it('should not be vulnerable to ReDoS for catastrophic backtracking input', () => {
      const longText = `${'a'.repeat(10000)}!`;
      const start = performance.now();
      const result = highlightSearchText(longText, '(a+)+$');
      const elapsed = performance.now() - start;

      expect(result).toBe(longText);
      expect(elapsed).toBeLessThan(1000);
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

    it('should treat regex metacharacters in searchText as literal text', () => {
      const result = highlightSearchArrayElement(
        'type is map(int)',
        'map(int)'
      );
      const { container } = render(<>{result}</>);

      const highlighted = container.querySelector('.text-highlighter');

      expect(highlighted).toBeInTheDocument();
      expect(highlighted?.textContent).toBe('map(int)');
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

  describe('renderHighlightedText method', () => {
    it('returns the raw string when there is no highlight wrapper', () => {
      expect(renderHighlightedText('plain text')).toBe('plain text');
    });

    it('returns the input as-is for null / undefined / empty', () => {
      expect(renderHighlightedText(undefined)).toBe('');
      expect(renderHighlightedText(null)).toBe('');
      expect(renderHighlightedText('')).toBe('');
    });

    it('wraps the matched segment in a real span.text-highlighter node', () => {
      const { container } = render(
        <>
          {renderHighlightedText(
            'foo <span class="text-highlighter">bar</span> baz'
          )}
        </>
      );

      const span = container.querySelector('span.text-highlighter');

      expect(span).not.toBeNull();
      expect(span?.textContent).toBe('bar');
      expect(container.textContent).toBe('foo bar baz');
    });

    it('renders injected script / img / attribute payloads as literal text', () => {
      const payload =
        '<script>alert(1)</script><img src=x onerror=alert(1)>' +
        '<a href="javascript:alert(1)">click</a>';
      const { container } = render(<>{renderHighlightedText(payload)}</>);

      // Nothing was interpreted as HTML — the payload appears verbatim.
      expect(container.textContent).toBe(payload);
      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('a')).toBeNull();
    });

    it('tolerates the client-side data-highlight attribute on the wrapper', () => {
      const { container } = render(
        <>
          {renderHighlightedText(
            '<span data-highlight="true" class="text-highlighter">hit</span>'
          )}
        </>
      );

      expect(
        container.querySelector('span.text-highlighter')?.textContent
      ).toBe('hit');
    });

    it('escapes content inside the wrapper (no nested HTML interpretation)', () => {
      const { container } = render(
        <>
          {renderHighlightedText(
            '<span class="text-highlighter"><img src=x onerror=alert(1)></span>'
          )}
        </>
      );
      const span = container.querySelector('span.text-highlighter');

      expect(span?.textContent).toBe('<img src=x onerror=alert(1)>');
      expect(container.querySelector('img')).toBeNull();
    });

    it('preserves the version-diff wrapper with its class and data-testid', () => {
      const { container } = render(
        <>
          {renderHighlightedText(
            '<span data-diff="true" class="diff-added text-underline" data-testid="diff-added">test-case-version-changed</span>'
          )}
        </>
      );
      const diff = container.querySelector('[data-testid="diff-added"]');

      expect(diff).not.toBeNull();
      expect(diff?.textContent).toBe('test-case-version-changed');
      expect(diff?.getAttribute('class')).toBe('diff-added text-underline');
    });

    it('drops unrecognized attributes on the outer span', () => {
      const { container } = render(
        <>
          {renderHighlightedText(
            '<span data-diff="true" class="diff-added" data-testid="diff-added" onmouseover="alert(1)" style="color:red">hit</span>'
          )}
        </>
      );
      const diff = container.querySelector('[data-testid="diff-added"]');

      expect(diff).not.toBeNull();
      // style + onmouseover were dropped — only class + data-testid survived.
      expect(diff?.getAttribute('style')).toBeNull();
      expect(diff?.getAttribute('onmouseover')).toBeNull();
    });

    it('renders unrecognized spans as literal text', () => {
      const { container } = render(
        <>
          {renderHighlightedText(
            'foo <span class="not-a-known-wrapper">bar</span> baz'
          )}
        </>
      );

      expect(container.querySelector('span.not-a-known-wrapper')).toBeNull();
      expect(container.textContent).toBe(
        'foo <span class="not-a-known-wrapper">bar</span> baz'
      );
    });
  });
});
