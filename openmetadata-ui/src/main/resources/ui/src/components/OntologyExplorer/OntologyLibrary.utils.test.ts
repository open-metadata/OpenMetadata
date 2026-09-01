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

import {
  Format,
  OntologyPackManifest,
} from '../../generated/api/data/ontologyPackManifest';
import {
  defaultModuleIds,
  selectedModuleTotals,
  updateModuleSelection,
} from './OntologyLibrary.utils';

const PACK: OntologyPackManifest = {
  abbreviation: 'TEST',
  bundled: true,
  description: 'Test pack',
  id: 'test',
  license: 'CC0',
  licenseUrl: 'https://example.com/license',
  modules: [
    {
      conceptCount: 2,
      dependencies: [],
      description: 'Core',
      format: Format.Turtle,
      id: 'core',
      name: 'Core',
      relationshipCount: 1,
      selectedByDefault: true,
    },
    {
      conceptCount: 3,
      dependencies: ['core'],
      description: 'Clinical',
      format: Format.Turtle,
      id: 'clinical',
      name: 'Clinical',
      relationshipCount: 2,
      selectedByDefault: false,
    },
    {
      conceptCount: 5,
      dependencies: ['clinical'],
      description: 'Workflow',
      format: Format.Turtle,
      id: 'workflow',
      name: 'Workflow',
      relationshipCount: 4,
      selectedByDefault: false,
    },
  ],
  name: 'Test Ontology',
  sourceUrl: 'https://example.com/source',
  standard: 'Test Standard',
  version: '1.0',
};

describe('OntologyLibrary utils', () => {
  it('includes dependencies while preserving manifest order', () => {
    expect(updateModuleSelection(PACK, [], 'workflow', true)).toEqual([
      'core',
      'clinical',
      'workflow',
    ]);
  });

  it('removes dependent modules when a prerequisite is deselected', () => {
    expect(
      updateModuleSelection(
        PACK,
        ['core', 'clinical', 'workflow'],
        'clinical',
        false
      )
    ).toEqual(['core']);
  });

  it('derives defaults and live totals from selected modules', () => {
    const selectedIds = defaultModuleIds(PACK);

    expect(selectedIds).toEqual(['core']);
    expect(selectedModuleTotals(PACK, ['core', 'clinical'])).toEqual({
      concepts: 5,
      relationships: 3,
    });
  });
});
