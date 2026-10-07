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
  getActivityScope,
  getActivityScopeKey,
  getTaskListScope,
  INBOX_SCOPE,
} from './activityScope';

const TABLE_LINK = '<#E::table::svc.db.schema.customers>';
const USER_LINK = '<#E::user::harsh.vador>';

describe('activityScope', () => {
  it('reads an entity link as what happened to the entity', () => {
    expect(getActivityScope(TABLE_LINK)).toEqual({
      type: 'entity',
      entityLink: TABLE_LINK,
    });
    expect(getTaskListScope(TABLE_LINK)).toEqual({
      type: 'entity',
      aboutEntity: 'svc.db.schema.customers',
    });
  });

  it('reads a user link as what the user did and their tasks', () => {
    expect(getActivityScope(USER_LINK)).toEqual({
      type: 'user',
      userName: 'harsh.vador',
    });
    expect(getTaskListScope(USER_LINK)).toEqual({
      type: 'assignee',
      assignee: 'harsh.vador',
    });
  });

  // Each scope keeps its own cached lists.
  it('keys every scope apart', () => {
    const keys = [
      INBOX_SCOPE,
      getActivityScope(TABLE_LINK),
      getActivityScope(USER_LINK),
    ].map(getActivityScopeKey);

    expect(new Set(keys).size).toBe(3);
  });
});
