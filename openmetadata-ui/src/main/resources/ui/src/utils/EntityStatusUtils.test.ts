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

import { EntityStatus } from '../generated/entity/data/glossaryTerm';
import {
  getVisibleStatusColumns,
  isUnprocessedStatus,
} from './EntityStatusUtils';

const COLUMNS = [{ id: 'name' }, { id: 'entityStatus' }];

describe('isUnprocessedStatus', () => {
  it.each([undefined, '', 'Unprocessed', 'unprocessed'])(
    'treats %p as unprocessed',
    (status) => {
      expect(isUnprocessedStatus(status)).toBe(true);
    }
  );

  it.each(['Approved', 'in review', 'draft'])(
    'treats %p as reviewed',
    (status) => {
      expect(isUnprocessedStatus(status)).toBe(false);
    }
  );
});

describe('getVisibleStatusColumns', () => {
  it('drops the status column when every entity is unprocessed', () => {
    expect(
      getVisibleStatusColumns(COLUMNS, [
        { entityStatus: EntityStatus.Unprocessed },
        {},
      ])
    ).toEqual([{ id: 'name' }]);
  });

  it('keeps the status column when unprocessed is mixed with another status', () => {
    expect(
      getVisibleStatusColumns(COLUMNS, [
        { entityStatus: EntityStatus.Unprocessed },
        { entityStatus: EntityStatus.Approved },
      ])
    ).toBe(COLUMNS);
  });
});
