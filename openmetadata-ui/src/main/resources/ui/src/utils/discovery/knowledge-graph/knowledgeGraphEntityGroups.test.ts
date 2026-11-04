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

import { groupEntityTypeChoices } from './knowledgeGraphEntityGroups';

const option = (id: string, count = 1) => ({ id, label: id, count });

describe('groupEntityTypeChoices', () => {
  it('places each entity type under its Explore-style group and preserves group order', () => {
    const sections = groupEntityTypeChoices([
      option('user', 3),
      option('table', 4),
      option('dashboard', 2),
      option('team', 1),
      option('databaseSchema', 5),
    ]);

    expect(sections.map((s) => s.key)).toEqual([
      'databases',
      'dashboards',
      'owners',
    ]);
    expect(sections[0].choices.map((c) => c.id).sort()).toEqual([
      'databaseSchema',
      'table',
    ]);
    expect(sections[2].choices.map((c) => c.id).sort()).toEqual([
      'team',
      'user',
    ]);
  });

  it('drops groups that have no matching choice', () => {
    const sections = groupEntityTypeChoices([option('table'), option('user')]);

    expect(sections.map((s) => s.key)).toEqual(['databases', 'owners']);
    expect(sections.map((s) => s.labelKey)).toEqual([
      'label.database-plural',
      'label.owner-plural',
    ]);
  });

  it('spills unknown types into an Other section at the end', () => {
    const sections = groupEntityTypeChoices([
      option('table'),
      option('customThing'),
    ]);

    expect(sections[sections.length - 1]).toMatchObject({
      key: 'other',
      labelKey: 'label.kg-other',
      choices: [expect.objectContaining({ id: 'customThing' })],
    });
  });
});
