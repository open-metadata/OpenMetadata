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
import { getFeedFieldLabelKey, getFeedFieldPath } from './FeedFieldPath.utils';

describe('getFeedFieldPath', () => {
  it('names the column and its field for a column-level link', () => {
    expect(
      getFeedFieldPath('<#E::table::db.sch.t::columns::last_name::description>')
    ).toEqual({
      column: { name: 'last_name', fqn: 'db.sch.t.last_name' },
      field: 'description',
    });
  });

  it('names only the column when the link stops at it', () => {
    expect(getFeedFieldPath('<#E::table::db.sch.t::columns::id>')).toEqual({
      column: { name: 'id', fqn: 'db.sch.t.id' },
      field: undefined,
    });
  });

  it('names the field of an entity-level field link', () => {
    expect(getFeedFieldPath('<#E::table::db.sch.t::description>')).toEqual({
      field: 'description',
    });
  });

  it('has no path for a link to the entity itself, or no link', () => {
    expect(getFeedFieldPath('<#E::table::db.sch.t>')).toBeUndefined();
    expect(getFeedFieldPath(undefined)).toBeUndefined();
  });
});

describe('getFeedFieldLabelKey', () => {
  it('maps link field names onto their label keys', () => {
    expect(getFeedFieldLabelKey('tags')).toBe('label.tag-plural');
    expect(getFeedFieldLabelKey('owners')).toBe('label.owners');
  });
});
