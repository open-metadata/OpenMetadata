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

import { AxiosError } from 'axios';
import {
  decodeHtmlEntities,
  formatJsonString,
  getDecodedFqn,
  getEncodedFqn,
  getPermissionErrorText,
  jsonToCSV,
  ordinalize,
  removeAttachmentsWithoutUrl,
  replaceCallback,
  slugify,
  stripMarkdown,
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

  describe('slugify', () => {
    it('should convert string to lowercase', () => {
      expect(slugify('HELLO')).toBe('hello');
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('hello world')).toBe('hello-world');
      expect(slugify('foo bar baz')).toBe('foo-bar-baz');
    });

    it('should replace multiple spaces with single hyphen', () => {
      expect(slugify('hello    world')).toBe('hello-world');
      expect(slugify('foo  bar   baz')).toBe('foo-bar-baz');
    });

    it('should replace special characters with hyphens', () => {
      expect(slugify('hello@world')).toBe('hello-world');
      expect(slugify('foo#bar$baz')).toBe('foo-bar-baz');
      expect(slugify('test!@#$%^&*()value')).toBe('test-value');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(slugify('-hello-')).toBe('hello');
      expect(slugify('--foo--')).toBe('foo');
      expect(slugify('---bar---')).toBe('bar');
      expect(slugify('@hello@')).toBe('hello');
    });

    it('should remove multiple consecutive hyphens', () => {
      expect(slugify('hello---world')).toBe('hello-world');
      expect(slugify('foo@@bar')).toBe('foo-bar');
    });

    it('should preserve alphanumeric characters', () => {
      expect(slugify('hello123world')).toBe('hello123world');
      expect(slugify('test1-2-3')).toBe('test1-2-3');
      expect(slugify('abc123xyz')).toBe('abc123xyz');
    });

    it('should handle long strings without truncation', () => {
      const longString =
        'this-is-a-very-long-string-that-exceeds-the-maximum-length-limit';
      const result = slugify(longString);

      expect(result).toBe(
        'this-is-a-very-long-string-that-exceeds-the-maximum-length-limit'
      );
      expect(result.length).toBeGreaterThan(48);
    });

    it('should handle empty string', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle string with only special characters', () => {
      expect(slugify('@#$%^&*()')).toBe('');
      expect(slugify('!!!')).toBe('');
    });

    it('should handle string with mixed case and special characters', () => {
      expect(slugify('Hello@World#123')).toBe('hello-world-123');
      expect(slugify('Foo$Bar%Baz!')).toBe('foo-bar-baz');
    });

    it('should handle underscores as special characters', () => {
      expect(slugify('hello_world')).toBe('hello-world');
      expect(slugify('foo_bar_baz')).toBe('foo-bar-baz');
    });

    it('should handle dots and commas', () => {
      expect(slugify('hello.world')).toBe('hello-world');
      expect(slugify('foo,bar,baz')).toBe('foo-bar-baz');
    });

    it('should handle URLs and paths', () => {
      expect(slugify('https://example.com/path')).toBe(
        'https-example-com-path'
      );
      expect(slugify('/api/v1/users')).toBe('api-v1-users');
    });

    it('should handle complex real-world examples', () => {
      expect(slugify('User Profile Settings')).toBe('user-profile-settings');
      expect(slugify('2024-01-15 Report')).toBe('2024-01-15-report');
      expect(slugify('Q1 Financial Report (2024)')).toBe(
        'q1-financial-report-2024'
      );
    });

    it('should handle unicode characters by removing them', () => {
      expect(slugify('hello\u00A0world')).toBe('hello-world');
      expect(slugify('café')).toBe('caf');
      expect(slugify('naïve')).toBe('na-ve');
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

  describe('decodeHtmlEntities', () => {
    it('should decode numeric HTML entities', () => {
      expect(decodeHtmlEntities('This is &#98;old text')).toBe(
        'This is bold text'
      );
    });

    it('should decode named HTML entities', () => {
      expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    });

    it('should leave plain text unaffected', () => {
      expect(decodeHtmlEntities('plain text')).toBe('plain text');
    });
  });

  describe('stripMarkdown', () => {
    it('should strip markdown syntax', () => {
      expect(stripMarkdown('**bold** and `code`')).toBe('bold and code');
    });

    it('should decode HTML entities left over from markdown stripping', () => {
      expect(stripMarkdown('This is &#98;old and &amp; italic')).toBe(
        'This is bold and & italic'
      );
    });

    it('should trim surrounding whitespace', () => {
      expect(stripMarkdown('  **hello world**  ')).toBe('hello world');
    });
  });

  describe('getPermissionErrorText', () => {
    it('should return the friendly permission message for a 403 error', () => {
      const error = {
        response: { status: 403, data: { message: "operations not allowed" } },
      } as AxiosError;

      expect(getPermissionErrorText(error, 'fallback')).toBe(
        'message.operation-forbidden-please-contact-admin'
      );
    });

    it('should return the backend message for a non-403 error', () => {
      const error = {
        response: { status: 500, data: { message: 'boom' } },
      } as AxiosError;

      expect(getPermissionErrorText(error, 'fallback')).toBe('boom');
    });

    it('should return the fallback text when a non-403 error has no message', () => {
      const error = { response: { status: 500, data: {} } } as AxiosError;

      expect(getPermissionErrorText(error, 'fallback')).toBe('fallback');
    });

    it('should return a plain string error unchanged', () => {
      expect(getPermissionErrorText('plain error', 'fallback')).toBe(
        'plain error'
      );
    });
  });
});
