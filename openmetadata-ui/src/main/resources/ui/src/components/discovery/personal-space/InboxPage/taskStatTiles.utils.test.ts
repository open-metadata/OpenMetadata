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

// Only the relative-time formatter is stubbed; routing helpers reached through
// the builder read the rest of the module at import time.
jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../../utils/date-time/DateTimeUtils'),
  getRelativeTime: (ts: number) => `ago-${ts}`,
}));

import {
  Task,
  TaskCategory,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { TestCase } from '../../../../generated/tests/testCase';
import { StatTile, TaskAboutEntity } from './taskDetail.types';
import { getTaskStatTiles } from './taskStatTiles.utils';

const t = (key: string, options?: Record<string, unknown>) => {
  if (options?.entity) {
    return `${key}:${options.entity}`;
  }

  return options?.count === undefined ? key : `${key}:${options.count}`;
};

const task = (overrides: Partial<Task>): Task =>
  ({ id: 'task-1', status: 'Open', ...overrides } as unknown as Task);

const keys = (tiles: StatTile[]) => tiles.map((tile) => tile.key);

describe('getTaskStatTiles', () => {
  describe('incident', () => {
    const about: TaskAboutEntity = {
      testCase: {
        testDefinition: { id: 'd1', name: 'tableRowCountToEqual' },
      } as unknown as TestCase,
      testCaseTableFqn: 'svc.db.schema.customer_rows',
    };
    const incident = task({
      category: TaskCategory.Incident,
      payload: { severity: 'Severity1' },
      workflowStageDisplayName: 'Assigned',
    } as unknown as Partial<Task>);

    it('describes the failing test rather than asset reach', () => {
      expect(keys(getTaskStatTiles(incident, about, t))).toEqual([
        'testType',
        'table',
        'severity',
        'incidentStatus',
      ]);
    });

    it('links the table the test runs against, by its name', () => {
      const table = getTaskStatTiles(incident, about, t).find(
        (tile) => tile.key === 'table'
      );

      expect(table).toMatchObject({ value: 'customer_rows', layout: 'field' });
      expect(table?.to).toContain('customer_rows');
    });

    // Same wording as the incident manager's own severity chip.
    it('reads severity the way the incident manager does', () => {
      expect(
        getTaskStatTiles(incident, about, t).find(
          (tile) => tile.key === 'severity'
        )
      ).toMatchObject({ value: 'Severity 1', badgeColor: 'error' });
    });

    it('names the incident stage the workflow reports', () => {
      expect(
        getTaskStatTiles(incident, about, t).find(
          (tile) => tile.key === 'incidentStatus'
        )?.value
      ).toBe('Assigned');
    });

    it('prefers the severity on the incident record to the payload copy', () => {
      expect(
        getTaskStatTiles(
          incident,
          { ...about, incidentSeverity: 'Severity2' } as TaskAboutEntity,
          t
        ).find((tile) => tile.key === 'severity')?.value
      ).toBe('Severity 2');
    });

    it('drops tiles whose facts are missing', () => {
      expect(
        keys(getTaskStatTiles(task({ category: TaskCategory.Incident }), {}, t))
      ).toEqual(['incidentStatus']);
    });
  });

  it('shows usage and current tags for a tag request', () => {
    const tiles = getTaskStatTiles(
      task({
        type: TaskType.TagUpdate,
        payload: { currentTags: [] },
      } as unknown as Partial<Task>),
      { weeklyQueryCount: 9 },
      t
    );

    expect(tiles).toEqual([
      { key: 'queries', label: 'label.queries-this-week', value: '9' },
      {
        key: 'currentTags',
        label: 'label.current-entity:label.tag-plural',
        value: '0',
      },
    ]);
  });

  describe('ownership', () => {
    const ownership = task({ type: TaskType.OwnershipUpdate });

    // Nothing records when the owner left, so there is no duration to show.
    it('flags an unowned asset and says so plainly', () => {
      const tiles = getTaskStatTiles(ownership, { ownerCount: 0 }, t);

      expect(tiles.find((tile) => tile.key === 'currentOwners')).toMatchObject({
        value: '0',
        tone: 'warning',
      });
      expect(tiles.find((tile) => tile.key === 'owner')?.value).toBe(
        'label.no-owner'
      );
    });

    it('names the owners when there are some', () => {
      const tiles = getTaskStatTiles(
        ownership,
        {
          ownerCount: 1,
          entity: { owners: [{ name: 'carol' }] } as never,
        },
        t
      );

      expect(tiles.find((tile) => tile.key === 'owner')?.value).toBe('carol');
      expect(
        tiles.find((tile) => tile.key === 'currentOwners')?.tone
      ).toBeUndefined();
    });
  });

  describe('everything else', () => {
    const description = task({ type: TaskType.DescriptionUpdate });

    it('shows reach, columns, usage and the last metadata change', () => {
      expect(
        keys(
          getTaskStatTiles(
            description,
            {
              downstreamCount: 47,
              columnCount: 38,
              weeklyQueryCount: 2,
              updatedAt: 1000,
            },
            t
          )
        )
      ).toEqual(['downstream', 'columns', 'queries', 'updatedAt']);
    });

    // The PII share is what makes a column count worth a reviewer's attention.
    it('calls out the PII-tagged columns and colours the count', () => {
      expect(
        getTaskStatTiles(
          description,
          { columnCount: 38, piiColumnCount: 6 },
          t
        )[0]
      ).toMatchObject({
        label: 'label.column-plural-pii-count:6',
        tone: 'error',
      });
    });

    it('names the timestamp as a metadata update, relative to now', () => {
      expect(
        getTaskStatTiles(description, { updatedAt: 1000 }, t)[0]
      ).toMatchObject({ label: 'label.metadata-updated', value: 'ago-1000' });
    });

    it('shows nothing when no figure is known', () => {
      expect(getTaskStatTiles(description, {}, t)).toEqual([]);
    });
  });
});
