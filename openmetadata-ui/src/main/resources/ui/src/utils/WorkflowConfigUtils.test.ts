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

import { buildFieldOptions } from './WorkflowConfigUtils';

describe('WorkflowConfigUtils.buildFieldOptions', () => {
  it('prefixes custom-property names with extension. so workflow nodes can resolve them', () => {
    const fields = [
      { name: 'description' },
      { name: 'HyperLinkTest' },
      { name: 'Department' },
    ];
    const customPropertyNames = new Set(['HyperLinkTest', 'Department']);

    const options = buildFieldOptions(fields, customPropertyNames);

    expect(options).toContain('extension.HyperLinkTest');
    expect(options).toContain('extension.Department');
    // A custom property must never leak out as a bare name.
    expect(options).not.toContain('HyperLinkTest');
    expect(options).not.toContain('Department');
  });

  it('leaves standard fields unprefixed', () => {
    const fields = [{ name: 'description' }, { name: 'owners' }];

    const options = buildFieldOptions(fields, new Set());

    expect(options).toEqual(['description', 'owners']);
  });

  it('keeps standard and custom fields in one list, prefixing only the custom ones', () => {
    const fields = [{ name: 'description' }, { name: 'HyperLinkTest' }];

    const options = buildFieldOptions(fields, new Set(['HyperLinkTest']));

    expect(options).toEqual(['description', 'extension.HyperLinkTest']);
  });

  it('de-duplicates field options', () => {
    const fields = [
      { name: 'description' },
      { name: 'description' },
      { name: 'HyperLinkTest' },
      { name: 'HyperLinkTest' },
    ];

    const options = buildFieldOptions(fields, new Set(['HyperLinkTest']));

    expect(options).toEqual(['description', 'extension.HyperLinkTest']);
  });

  it('applies the extension prefix after the exclude filter so the custom property is not dropped', () => {
    // filterExcludeFields drops names containing "." (other than column./columns.),
    // so the prefix must be added afterwards.
    const fields = [
      { name: 'HyperLinkTest' },
      { name: 'someInternal.nested' },
      { name: 'columns.description' },
    ];

    const options = buildFieldOptions(fields, new Set(['HyperLinkTest']));

    expect(options).toContain('extension.HyperLinkTest');
    expect(options).toContain('columns.description');
    expect(options).not.toContain('someInternal.nested');
  });

  it('ignores fields without a name', () => {
    const fields = [{ name: undefined }, {}, { name: 'description' }];

    const options = buildFieldOptions(fields, new Set());

    expect(options).toEqual(['description']);
  });
});
