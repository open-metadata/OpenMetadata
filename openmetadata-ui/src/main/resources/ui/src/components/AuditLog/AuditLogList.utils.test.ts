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

import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import { ChangeEvent, EventType } from '../../generated/type/changeEvent';
import { AuditLogEntry } from '../../types/auditLogs.interface';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import {
  EVENT_TYPE_COLORS,
  formatCellValue,
  getChangeRows,
  getEntityRefLink,
  getFieldPath,
  getLineageEdge,
  getReadableSummary,
  getStatusColor,
  isAuthEvent,
  MAX_RECORDS,
  parseChangeValue,
  toChangeValue,
} from './AuditLogList.utils';

const lineageLog = (entity: unknown): AuditLogEntry => ({
  eventType: EventType.EntityLineageAdded,
  changeEvent: { entity } as unknown as ChangeEvent,
});

describe('AuditLogList.utils', () => {
  describe('EVENT_TYPE_COLORS', () => {
    // Event types the audit log never records (AuditLogRepository.SUPPORTED_EVENT_TYPES).
    // A new EventType must be added here or given a colour, so the list stays a decision.
    const NOT_AUDITED = new Set<string>([
      EventType.EntityNoChange,
      EventType.LogicalTestCaseAdded,
      EventType.OntologyChangeSetApplied,
      EventType.OntologyImported,
      EventType.OntologyRelationshipTypeUpdated,
      EventType.PostCreated,
      EventType.PostUpdated,
      EventType.ThreadCreated,
      EventType.ThreadUpdated,
    ]);

    it('should colour every event type the audit log records', () => {
      const uncoloured = Object.values(EventType).filter(
        (type) => !NOT_AUDITED.has(type) && !EVENT_TYPE_COLORS[type]
      );

      expect(uncoloured).toEqual([]);
    });
  });

  describe('isAuthEvent', () => {
    it.each([
      [EventType.UserLogin, true],
      [EventType.UserLogout, true],
      [EventType.EntityUpdated, false],
      [undefined, false],
    ])('should treat %s as auth event: %s', (eventType, expected) => {
      expect(isAuthEvent(eventType)).toBe(expected);
    });
  });

  describe('getFieldPath', () => {
    it.each([
      [undefined, ''],
      ['', ''],
      ['description', 'Description'],
      ['testCaseResultSummary', 'Test Case Result Summary'],
      ['columns.customer_id.tags', 'Columns › customer_id › Tags'],
      ['columns."order.id".dataType', 'Columns › order.id › Data Type'],
      [
        'columns.address.street_name.description',
        'Columns › address › street_name › Description',
      ],
    ])('should turn %s into "%s"', (name, expected) => {
      expect(getFieldPath(name)).toBe(expected);
    });
  });

  describe('parseChangeValue', () => {
    it('should parse JSON strings and leave everything else untouched', () => {
      expect(parseChangeValue('[{"name":"a"}]')).toEqual([{ name: 'a' }]);
      expect(parseChangeValue('{"a":1}')).toEqual({ a: 1 });
      expect(parseChangeValue('plain text')).toBe('plain text');
      expect(parseChangeValue(false)).toBe(false);
      expect(parseChangeValue(undefined)).toBeUndefined();
    });
  });

  describe('toChangeValue', () => {
    it.each([[undefined], [null], [''], ['[]']])(
      'should return nothing for an empty value (%s)',
      (raw) => {
        expect(toChangeValue(raw)).toBeUndefined();
      }
    );

    it('should keep false and 0 as real values', () => {
      expect(toChangeValue(false)).toEqual({ type: 'text', text: 'false' });
      expect(toChangeValue(0)).toEqual({ type: 'text', text: '0' });
    });

    it('should strip HTML from text values', () => {
      expect(toChangeValue('<p>The ID of the customer.</p>')).toEqual({
        type: 'text',
        text: 'The ID of the customer.',
      });
    });

    it('should decode HTML entities and keep paragraphs apart', () => {
      expect(
        toChangeValue('<p>Orders &amp; returns</p><p>Second&nbsp;line</p>')
      ).toEqual({ type: 'text', text: 'Orders & returns Second line' });
    });

    it.each([
      ['map<string,int>'],
      ['array<struct<a:int>>'],
      ['a < b and c > d'],
    ])('should keep non-HTML angle-bracket text "%s" as is', (raw) => {
      expect(toChangeValue(raw)).toEqual({ type: 'text', text: raw });
    });

    it('should treat a list of columns as records, not references', () => {
      expect(toChangeValue([{ name: 'id', dataType: 'INT' }])).toEqual({
        type: 'records',
        records: [{ name: 'id', dataType: 'INT' }],
        totalCount: 1,
      });
    });

    it('should classify tiers, classification tags and glossary terms', () => {
      expect(
        toChangeValue(
          JSON.stringify([
            { tagFQN: 'Tier.Tier1', name: 'Tier1' },
            { tagFQN: 'PII.Sensitive', name: 'Sensitive' },
            { tagFQN: 'Business.Revenue', source: 'Glossary' },
          ])
        )
      ).toEqual({
        type: 'refs',
        refs: [
          { fqn: 'Tier.Tier1', refKind: 'tier', label: 'Tier1' },
          {
            fqn: 'PII.Sensitive',
            refKind: 'classification',
            label: 'PII.Sensitive',
          },
          {
            fqn: 'Business.Revenue',
            refKind: 'glossary',
            label: 'Business.Revenue',
          },
        ],
      });
    });

    it('should classify domains and data products apart from other entity references', () => {
      expect(
        toChangeValue([
          { type: 'domain', name: 'Customer360', displayName: 'Customer 360' },
          {
            type: 'dataProduct',
            name: 'sales',
            fullyQualifiedName: 'Sales.sales',
          },
          { id: 'u-1', type: 'user', name: 'admin' },
        ])
      ).toMatchObject({
        type: 'refs',
        refs: [
          {
            fqn: 'Customer360',
            entityType: 'domain',
            refKind: 'domain',
            label: 'Customer 360',
          },
          {
            fqn: 'Sales.sales',
            entityType: 'dataProduct',
            refKind: 'domain',
            label: 'sales',
          },
          {
            fqn: 'admin',
            entityType: 'user',
            refKind: 'entity',
            label: 'admin',
          },
        ],
      });
    });

    it('should treat a single reference object as a one-item list', () => {
      expect(
        toChangeValue({ id: 't-1', type: 'team', name: 'Engineering' })
      ).toMatchObject({
        type: 'refs',
        refs: [
          {
            id: 't-1',
            name: 'Engineering',
            fqn: 'Engineering',
            entityType: 'team',
            refKind: 'entity',
            label: 'Engineering',
          },
        ],
      });
    });

    it('should keep the first records of a list of objects and its full count', () => {
      const rows = Array.from({ length: MAX_RECORDS + 2 }, (_, index) => ({
        status: 'Success',
        index,
      }));
      const value = toChangeValue(JSON.stringify(rows));

      expect(value).toEqual({
        type: 'records',
        records: rows.slice(0, MAX_RECORDS),
        totalCount: MAX_RECORDS + 2,
      });
    });

    it('should turn a plain object into key-value entries', () => {
      expect(toChangeValue('{"runId":"r-1","config":{}}')).toEqual({
        type: 'keyValue',
        entries: [
          ['runId', 'r-1'],
          ['config', {}],
        ],
      });
    });

    it('should join a list of plain values as text', () => {
      expect(toChangeValue(['a', 'b', 3])).toEqual({
        type: 'text',
        text: 'a, b, 3',
      });
    });
  });

  describe('getChangeRows', () => {
    it('should return no rows without a change description', () => {
      expect(getChangeRows(undefined)).toEqual([]);
    });

    it('should list added, updated and removed fields in that order', () => {
      const rows = getChangeRows({
        fieldsAdded: [
          { name: 'columns.id.tags', newValue: '[{"tagFQN":"PII.Sensitive"}]' },
        ],
        fieldsUpdated: [
          { name: 'description', oldValue: 'old', newValue: 'new' },
        ],
        fieldsDeleted: [
          { name: 'owners', oldValue: '[{"type":"user","name":"bob"}]' },
        ],
      });

      expect(
        rows.map(({ key, action, path }) => ({ key, action, path }))
      ).toEqual([
        {
          key: 'added-columns.id.tags',
          action: 'added',
          path: 'Columns › id › Tags',
        },
        { key: 'updated-description', action: 'updated', path: 'Description' },
        { key: 'removed-owners', action: 'removed', path: 'Owners' },
      ]);
    });

    it('should read only the side of the change that matters for its action', () => {
      const [added, updated, removed] = getChangeRows({
        fieldsAdded: [{ name: 'a', oldValue: 'ignored', newValue: 'new-a' }],
        fieldsUpdated: [{ name: 'b', oldValue: 'old-b', newValue: 'new-b' }],
        fieldsDeleted: [{ name: 'c', oldValue: 'old-c', newValue: 'ignored' }],
      });

      expect(added.oldValue).toBeUndefined();
      expect(added.newValue).toEqual({ type: 'text', text: 'new-a' });
      expect(updated.oldValue).toEqual({ type: 'text', text: 'old-b' });
      expect(updated.newValue).toEqual({ type: 'text', text: 'new-b' });
      expect(removed.oldValue).toEqual({ type: 'text', text: 'old-c' });
      expect(removed.newValue).toBeUndefined();
    });

    it('should drop the deleted flag, which the event badge already shows', () => {
      expect(
        getChangeRows({
          fieldsAdded: [],
          fieldsUpdated: [{ name: 'deleted', oldValue: false, newValue: true }],
          fieldsDeleted: [],
        })
      ).toEqual([]);
    });
  });

  describe('getStatusColor', () => {
    it.each([
      ['Success', 'success'],
      ['PASSED', 'success'],
      ['Failed', 'error'],
      ['error', 'error'],
      ['Aborted', 'warning'],
      ['partialSuccess', 'warning'],
      ['Unknown', 'gray'],
    ])('should colour %s as %s', (status, color) => {
      expect(getStatusColor(status)).toBe(color);
    });
  });

  describe('formatCellValue', () => {
    it('should show the placeholder for missing values', () => {
      expect(formatCellValue('status', null)).toEqual({
        text: NO_DATA_PLACEHOLDER,
      });
      expect(formatCellValue('status', '')).toEqual({
        text: NO_DATA_PLACEHOLDER,
      });
    });

    it('should format epoch milliseconds under a time-like key', () => {
      const timestamp = 1795564824021;

      expect(formatCellValue('timestamp', timestamp)).toEqual({
        text: formatDateTime(timestamp),
      });
      expect(formatCellValue('endDate', timestamp)).toEqual({
        text: formatDateTime(timestamp),
      });
    });

    it('should not read small numbers under a time-like key as dates', () => {
      expect(formatCellValue('executionTime', 42)).toEqual({ text: '42' });
    });

    it('should colour status and state values', () => {
      expect(formatCellValue('status', 'Aborted')).toEqual({
        text: 'Aborted',
        color: 'warning',
      });
      expect(formatCellValue('pipelineState', 'success')).toEqual({
        text: 'success',
        color: 'success',
      });
    });

    it('should name the items of a list and flag empty structures', () => {
      expect(
        formatCellValue('status', [
          { name: 'OpenMetadata' },
          { displayName: 'Sales' },
        ])
      ).toEqual({ text: 'OpenMetadata, Sales' });
      expect(formatCellValue('config', {})).toEqual({
        text: '',
        isEmpty: true,
      });
      expect(formatCellValue('items', [])).toEqual({ text: '', isEmpty: true });
      expect(formatCellValue('config', { retries: 3 })).toEqual({
        text: '{"retries":3}',
      });
    });

    it('should shorten UUIDs and leave other strings whole', () => {
      expect(
        formatCellValue('runId', 'b7f39045-3277-417e-98e8-dbac25cf4544')
      ).toEqual({ text: 'b7f39045…' });
      expect(formatCellValue('initiator', 'ingestion-bot')).toEqual({
        text: 'ingestion-bot',
      });
    });
  });

  describe('getEntityRefLink', () => {
    it.each([
      [{ entityType: 'user', fqn: 'john_doe' }, '/users/john_doe'],
      [
        { entityType: 'team', fqn: 'Engineering' },
        '/settings/members/teams/Engineering',
      ],
      [
        { entityType: 'table', fqn: 'svc.db.schema.orders' },
        '/table/svc.db.schema.orders',
      ],
      [{ entityType: 'notAnEntity', fqn: 'x' }, undefined],
      [{ fqn: 'x' }, undefined],
    ])('should link %o to %s', (ref, expected) => {
      expect(
        getEntityRefLink({ label: ref.fqn, refKind: 'entity', ...ref })
      ).toBe(expected);
    });
  });

  describe('getLineageEdge', () => {
    const edge = {
      fromEntity: {
        type: 'table',
        name: 'customer',
        fullyQualifiedName: 'svc.db.s.customer',
      },
      toEntity: {
        type: 'table',
        name: 'orders',
        fullyQualifiedName: 'svc.db.s.orders',
      },
    };

    it('should read both endpoints from an object or a JSON string', () => {
      const expected = {
        from: {
          fqn: 'svc.db.s.customer',
          entityType: 'table',
          refKind: 'entity',
          label: 'customer',
        },
        to: {
          fqn: 'svc.db.s.orders',
          entityType: 'table',
          refKind: 'entity',
          label: 'orders',
        },
      };

      expect(getLineageEdge(lineageLog(edge))).toMatchObject(expected);
      expect(getLineageEdge(lineageLog(JSON.stringify(edge)))).toMatchObject(
        expected
      );
    });

    it('should return nothing when an endpoint is missing', () => {
      expect(
        getLineageEdge(lineageLog({ fromEntity: edge.fromEntity }))
      ).toBeUndefined();
      expect(
        getLineageEdge({ eventType: EventType.EntityUpdated })
      ).toBeUndefined();
    });
  });

  describe('getReadableSummary', () => {
    it('should hide a summary that only repeats the event type', () => {
      expect(
        getReadableSummary({
          eventType: EventType.EntityLineageAdded,
          summary: 'entityLineageAdded',
        })
      ).toBeUndefined();
    });

    it('should keep a real summary', () => {
      expect(
        getReadableSummary({
          eventType: EventType.EntityCreated,
          summary: 'Created glossary: AuditDemoGlossary',
        })
      ).toBe('Created glossary: AuditDemoGlossary');
      expect(
        getReadableSummary({ eventType: EventType.EntityCreated })
      ).toBeUndefined();
    });
  });
});
