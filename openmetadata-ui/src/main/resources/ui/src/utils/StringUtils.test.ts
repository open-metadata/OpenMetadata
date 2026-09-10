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

// Mock i18n for tests
jest.mock('./i18next/LocalUtil', () => ({
  __esModule: true,
  default: {
    t: jest.fn((key: string) => {
      const translations: Record<string, string> = {
        'label.ordinal-suffix-st': 'st',
        'label.ordinal-suffix-nd': 'nd',
        'label.ordinal-suffix-rd': 'rd',
        'label.ordinal-suffix-th': 'th',
      };

      return translations[key] || key;
    }),
  },
}));

import {
  formatJsonString,
  getDecodedFqn,
  getEncodedFqn,
  jsonToCSV,
  ordinalize,
  removeAttachmentsWithoutUrl,
  replaceCallback,
  stringToHTML,
} from './StringUtils';

describe('StringUtils', () => {
  it('getEncodedFqn should return encoded Fqn', () => {
    const fqn = 'sample_data.db_sample.schema_sample.dim/client.';
    const encodedFqn = 'sample_data.db_sample.schema_sample.dim%2Fclient.';

    expect(getEncodedFqn(fqn)).toEqual(encodedFqn);
  });

  it('getEncodedFqn should return encoded Fqn with space as plus', () => {
    const fqn = 'sample_data.db_sample.schema_sample.dim client.';
    const encodedFqn = 'sample_data.db_sample.schema_sample.dim+client.';

    expect(getEncodedFqn(fqn, true)).toEqual(encodedFqn);
  });

  it('getDecodedFqn should return decoded Fqn', () => {
    const fqn = 'sample_data.db_sample.schema_sample.dim%2Fclient.';
    const decodedFqn = 'sample_data.db_sample.schema_sample.dim/client.';

    expect(getDecodedFqn(fqn)).toEqual(decodedFqn);
  });

  it('getDecodedFqn should return decoded Fqn with plus as space', () => {
    const fqn = 'sample_data.db_sample.schema_sample.dim+client.';
    const decodedFqn = 'sample_data.db_sample.schema_sample.dim client.';

    expect(getDecodedFqn(fqn, true)).toEqual(decodedFqn);
  });

  describe('replaceCallback', () => {
    it('should return a hexadecimal string', () => {
      const result = replaceCallback('x');

      expect(typeof result).toBe('string');
      expect(/^[0-9a-f]$/.test(result)).toBeTruthy();
    });

    it('should return a hexadecimal string between 0 and f when character is x', () => {
      const result = replaceCallback('x');

      expect(parseInt(result, 16)).toBeGreaterThanOrEqual(0);
      expect(parseInt(result, 16)).toBeLessThanOrEqual(15);
    });

    it('should return a hexadecimal string between 8 and b when character is not x', () => {
      const result = replaceCallback('y');

      expect(parseInt(result, 16)).toBeGreaterThanOrEqual(8);
      expect(parseInt(result, 16)).toBeLessThanOrEqual(11);
    });
  });

  describe('formatJsonString', () => {
    it('should format a simple JSON string', () => {
      const jsonString = JSON.stringify({ key1: 'value1', key2: 'value2' });
      const expectedOutput = '[key1]: value1\n[key2]: value2\n';

      expect(formatJsonString(jsonString)).toStrictEqual(expectedOutput);
    });

    it('should format a deeply nested JSON string', () => {
      const jsonString = JSON.stringify({
        key1: 'value1',
        key2: {
          subKey1: 'subValue1',
          subKey2: {
            subSubKey1: 'subSubValue1',
            subSubKey2: 'subSubValue2',
          },
        },
      });
      const expectedOutput =
        '[key1]: value1\n[key2]:\n  [subKey1]: subValue1\n  [subKey2]:\n    [subSubKey1]: subSubValue1\n    [subSubKey2]: subSubValue2\n';

      expect(formatJsonString(jsonString)).toStrictEqual(expectedOutput);
    });

    it('should return the original string if it is not valid JSON', () => {
      const jsonString = 'not valid JSON';

      expect(formatJsonString(jsonString)).toStrictEqual(jsonString);
    });
  });

  it('jsonToCSV should return expected csv', () => {
    const jsonData = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'San Francisco' },
      { name: 'Bob', age: 35, city: 'Chicago' },
    ];

    const headers = [
      { field: 'name', title: 'Name' },
      { field: 'age', title: 'Age' },
      { field: 'city', title: 'City' },
    ];

    const expectedCSV = `Name,Age,City\n"John","30","New York"\n"Jane","25","San Francisco"\n"Bob","35","Chicago"`;

    expect(jsonToCSV(jsonData, headers)).toEqual(expectedCSV);
    expect(jsonToCSV(jsonData, [])).toEqual('');
    expect(jsonToCSV([], headers)).toEqual('');
  });

  describe('ordinalize', () => {
    it('should return "1st" for 1', () => {
      expect(ordinalize(1)).toBe('1st');
    });

    it('should return "2nd" for 2', () => {
      expect(ordinalize(2)).toBe('2nd');
    });

    it('should return "3rd" for 3', () => {
      expect(ordinalize(3)).toBe('3rd');
    });

    it('should return "4th" for 4', () => {
      expect(ordinalize(4)).toBe('4th');
    });

    it('should return "11th" for 11', () => {
      expect(ordinalize(11)).toBe('11th');
    });

    it('should return "12th" for 12', () => {
      expect(ordinalize(12)).toBe('12th');
    });

    it('should return "13th" for 13', () => {
      expect(ordinalize(13)).toBe('13th');
    });

    it('should return "21st" for 21', () => {
      expect(ordinalize(21)).toBe('21st');
    });

    it('should return "22nd" for 22', () => {
      expect(ordinalize(22)).toBe('22nd');
    });

    it('should return "23rd" for 23', () => {
      expect(ordinalize(23)).toBe('23rd');
    });

    it('should return "100th" for 100', () => {
      expect(ordinalize(100)).toBe('100th');
    });

    it('should return "101st" for 101', () => {
      expect(ordinalize(101)).toBe('101st');
    });
  });

  describe('removeAttachmentsWithoutUrl', () => {
    it('should remove attachment divs without data-url attribute', () => {
      const htmlString =
        '<p>Hello</p><div data-type="file-attachment">No URL</div><p>World</p>';
      const result = removeAttachmentsWithoutUrl(htmlString);

      expect(result).toBe('<p>Hello</p><p>World</p>');
    });

    it('should keep attachment divs with data-url attribute', () => {
      const htmlString =
        '<p>Hello</p><div data-type="file-attachment" data-url="https://example.com/file.pdf">With URL</div><p>World</p>';
      const result = removeAttachmentsWithoutUrl(htmlString);

      expect(result).toBe(
        '<p>Hello</p><div data-type="file-attachment" data-url="https://example.com/file.pdf">With URL</div><p>World</p>'
      );
    });

    it('should remove only attachments without url when mixed', () => {
      const htmlString =
        '<div data-type="file-attachment" data-url="https://example.com/file1.pdf">Keep</div>' +
        '<div data-type="file-attachment">Remove</div>' +
        '<div data-type="file-attachment" data-url="https://example.com/file2.pdf">Keep</div>';
      const result = removeAttachmentsWithoutUrl(htmlString);

      expect(result).toBe(
        '<div data-type="file-attachment" data-url="https://example.com/file1.pdf">Keep</div>' +
          '<div data-type="file-attachment" data-url="https://example.com/file2.pdf">Keep</div>'
      );
    });

    it('should return the same html when no attachments are present', () => {
      const htmlString = '<p>Hello World</p><span>No attachments here</span>';
      const result = removeAttachmentsWithoutUrl(htmlString);

      expect(result).toBe('<p>Hello World</p><span>No attachments here</span>');
    });

    it('should handle empty string', () => {
      const result = removeAttachmentsWithoutUrl('');

      expect(result).toBe('');
    });

    it('should remove attachment with empty data-url attribute', () => {
      const htmlString =
        '<div data-type="file-attachment" data-url="">Empty URL</div>';
      const result = removeAttachmentsWithoutUrl(htmlString);

      expect(result).toBe('');
    });

    it('should not affect other divs without file-attachment type', () => {
      const htmlString =
        '<div class="regular">Keep this</div><div data-type="file-attachment">Remove</div>';
      const result = removeAttachmentsWithoutUrl(htmlString);

      expect(result).toBe('<div class="regular">Keep this</div>');
    });
  });

  describe('stringToHTML sanitization', () => {
    // Helper: stringify the parse() output to a comparable HTML string.
    const toHtml = (result: string | JSX.Element | JSX.Element[]): string => {
      if (typeof result === 'string') {
        return result;
      }
      const nodes = Array.isArray(result) ? result : [result];

      return nodes
        .map((node) => {
          if (typeof node === 'string') {
            return node;
          }
          const { type, props } = node;
          const tag =
            typeof type === 'string' ? type : (type as { name?: string }).name;
          const attrs = Object.entries(props ?? {})
            .filter(([k]) => k !== 'children')
            .map(([k, v]) => `${k}="${String(v)}"`)
            .join(' ');
          const children = (props as { children?: unknown })?.children ?? '';

          return `<${tag}${attrs ? ' ' + attrs : ''}>${
            typeof children === 'string' ? children : ''
          }</${tag}>`;
        })
        .join('');
    };

    it('returns falsy input untouched', () => {
      expect(stringToHTML('')).toBe('');
    });

    it('strips <iframe>', () => {
      const payload =
        '<iframe src="javascript:alert(document.domain)"></iframe>';
      const html = toHtml(stringToHTML(payload));

      expect(html).not.toContain('<iframe');
      expect(html).not.toContain('javascript:');
    });

    it('strips <script> tags', () => {
      const payload = '<script>alert(1)</script>hello';
      const html = toHtml(stringToHTML(payload));

      expect(html).not.toContain('<script');
      expect(html).toContain('hello');
    });

    it('strips inline event-handler attributes (onerror, onclick)', () => {
      const payload = '<img src=x onerror="alert(1)">';
      const html = toHtml(stringToHTML(payload));

      expect(html).not.toMatch(/onerror=/i);
    });

    it('strips <form><button formaction=javascript:...>', () => {
      const payload =
        '<form><button formaction="javascript:alert(document.cookie)">team_test</button></form>';
      const html = toHtml(stringToHTML(payload));

      expect(html).not.toMatch(/formaction=["']?javascript:/i);
    });

    it('preserves the highlightSearchText <span> wrapper', () => {
      const highlighted =
        '<span data-highlight="true" class="text-highlighter">foo</span>';
      const html = toHtml(stringToHTML(highlighted));

      expect(html).toContain('foo');
      expect(html).toContain('text-highlighter');
    });

    it('preserves benign diff/highlight tags (<mark>, <ins>, <del>, <em>)', () => {
      const payload = '<mark>m</mark><ins>i</ins><del>d</del><em>e</em>';
      const html = toHtml(stringToHTML(payload));

      expect(html).toContain('m');
      expect(html).toContain('i');
      expect(html).toContain('d');
      expect(html).toContain('e');
    });
  });
});
