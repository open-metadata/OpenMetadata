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

import { indentUnit, language } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { CSMode } from '../enums/codemirror.enum';
import { CodeMirrorOptions } from '../interface/codemirror.interface';
import {
  getCodeMirrorExtensions,
  getCodeMirrorLanguage,
} from './CodeMirror.utils';

const getLanguageName = (mode?: Parameters<typeof getCodeMirrorLanguage>[0]) =>
  EditorState.create({ extensions: getCodeMirrorLanguage(mode) }).facet(
    language
  )?.name;

const createState = (options: CodeMirrorOptions) =>
  EditorState.create({
    doc: 'select 1',
    extensions: getCodeMirrorExtensions(options),
  });

describe('getCodeMirrorLanguage', () => {
  it.each([
    [CSMode.SQL, 'sql'],
    [CSMode.PYTHON, 'python'],
    [CSMode.YAML, 'yaml'],
    [CSMode.JAVASCRIPT, 'javascript'],
  ])('should resolve %s to the %s language', (mode, expected) => {
    expect(getLanguageName({ name: mode })).toBe(expected);
  });

  it('should resolve the javascript mode with json: true to the json language', () => {
    expect(getLanguageName({ name: CSMode.JAVASCRIPT, json: true })).toBe(
      'json'
    );
  });

  it('should resolve clike to the java stream parser', () => {
    expect(getLanguageName({ name: CSMode.CLIKE })).toBe('java');
  });

  it('should return no language extension for an undefined or unknown mode', () => {
    expect(getCodeMirrorLanguage()).toEqual([]);
    expect(getLanguageName()).toBeUndefined();
    // getMetricExpressionLanguageName lowercases Language values, so a value
    // outside CSMode (e.g. Language.External) can reach here.
    expect(getCodeMirrorLanguage({ name: 'external' as CSMode })).toEqual([]);
  });
});

describe('getCodeMirrorExtensions', () => {
  it('should return no extensions for an empty option bag', () => {
    expect(getCodeMirrorExtensions()).toEqual([]);
    expect(getCodeMirrorExtensions({})).toEqual([]);
  });

  it('should ignore the CodeMirror 5 only options', () => {
    expect(
      getCodeMirrorExtensions({
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        theme: 'default',
      })
    ).toEqual([]);
  });

  it.each([
    'lineNumbers',
    'lineWrapping',
    'styleActiveLine',
    'matchBrackets',
    'autoCloseBrackets',
    'foldGutter',
  ] as const)('should map the %s option to an extension', (option) => {
    expect(getCodeMirrorExtensions({ [option]: true })).not.toHaveLength(0);
    expect(getCodeMirrorExtensions({ [option]: false })).toHaveLength(0);
  });

  it('should make the state read-only and non-editable for readOnly', () => {
    expect(createState({ readOnly: true }).readOnly).toBe(true);
    expect(createState({ readOnly: false }).readOnly).toBe(false);
  });

  it('should apply tabSize', () => {
    expect(createState({ tabSize: 2 }).tabSize).toBe(2);
  });

  it('should indent with spaces by default and with a tab when asked', () => {
    expect(createState({ indentUnit: 2 }).facet(indentUnit)).toBe('  ');
    expect(
      createState({ indentUnit: 2, indentWithTabs: true }).facet(indentUnit)
    ).toBe('\t');
  });

  it('should only apply the placeholder when it has content', () => {
    expect(
      getCodeMirrorExtensions({ placeholder: 'Enter a query' })
    ).toHaveLength(1);
    expect(getCodeMirrorExtensions({ placeholder: '' })).toHaveLength(0);
  });
});
