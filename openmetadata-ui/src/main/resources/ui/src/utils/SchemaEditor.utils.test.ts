/*
 *  Copyright 2026 Collate.
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
import { getSchemaEditorValue } from './SchemaEditor.utils';

describe('getSchemaEditorValue', () => {
  describe('with autoFormat enabled (default)', () => {
    it('should pretty-print compact valid JSON with a 2-space indent', () => {
      expect(getSchemaEditorValue('{"a":1,"b":[2]}')).toBe(
        '{\n  "a": 1,\n  "b": [\n    2\n  ]\n}'
      );
    });

    it('should return invalid JSON unchanged', () => {
      expect(getSchemaEditorValue('{ not: valid')).toBe('{ not: valid');
    });

    it('should return plain non-JSON text unchanged', () => {
      expect(getSchemaEditorValue('hello world')).toBe('hello world');
    });

    it('should return the raw value when the JSON parses to a falsy value', () => {
      // getJSONFromString returns 0/false/null which the util treats as "not
      // parseable" and falls back to the original string.
      expect(getSchemaEditorValue('0')).toBe('0');
      expect(getSchemaEditorValue('false')).toBe('false');
    });
  });

  describe('with autoFormat disabled', () => {
    it('should return compact valid JSON untouched (no live re-indent)', () => {
      expect(getSchemaEditorValue('{"a":1,"b":[2]}', false)).toBe(
        '{"a":1,"b":[2]}'
      );
    });

    it('should preserve a partially typed JSON string verbatim', () => {
      expect(getSchemaEditorValue('{"a":', false)).toBe('{"a":');
    });
  });

  describe('with non-string input', () => {
    it('should stringify an object with a 2-space indent', () => {
      expect(getSchemaEditorValue({ a: 1 } as unknown as string)).toBe(
        '{\n  "a": 1\n}'
      );
    });

    it('should return an empty string for a number or undefined', () => {
      expect(getSchemaEditorValue(42 as unknown as string)).toBe('');
      expect(getSchemaEditorValue(undefined as unknown as string)).toBe('');
    });
  });
});
