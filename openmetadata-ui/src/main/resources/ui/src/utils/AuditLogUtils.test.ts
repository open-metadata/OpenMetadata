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

import { AuditLogActiveFilter } from '../types/auditLogs.interface';
import { buildParamsFromFilters } from './AuditLogUtils';

describe('AuditLogUtils', () => {
  describe('buildParamsFromFilters', () => {
    it('should return empty params for empty filters', () => {
      expect(buildParamsFromFilters([])).toEqual({});
    });

    it('should extract startTs and endTs from time filter when both are defined', () => {
      const startTs = 1700000000000;
      const endTs = 1700086400000;
      const filters: AuditLogActiveFilter[] = [
        {
          category: 'time',
          categoryLabel: 'Time',
          value: {
            key: 'yesterday',
            label: 'Yesterday',
            value: 'yesterday',
            startTs,
            endTs,
          },
        },
      ];

      expect(buildParamsFromFilters(filters)).toEqual({ startTs, endTs });
    });

    it('should not add startTs or endTs when time filter lacks them', () => {
      const filters: AuditLogActiveFilter[] = [
        {
          category: 'time',
          categoryLabel: 'Time',
          value: {
            key: 'yesterday',
            label: 'Yesterday',
            value: 'yesterday',
          },
        },
      ];

      expect(buildParamsFromFilters(filters)).toEqual({});
    });

    it('should extract userName and actorType USER from user filter', () => {
      const filters: AuditLogActiveFilter[] = [
        {
          category: 'user',
          categoryLabel: 'User',
          value: {
            key: 'john',
            label: 'John Doe',
            value: 'john',
          },
        },
      ];

      expect(buildParamsFromFilters(filters)).toEqual({
        userName: 'john',
        actorType: 'USER',
      });
    });

    it('should extract userName and actorType BOT from bot filter', () => {
      const filters: AuditLogActiveFilter[] = [
        {
          category: 'bot',
          categoryLabel: 'Bot',
          value: {
            key: 'ingestion-bot',
            label: 'Ingestion Bot',
            value: 'ingestion-bot',
          },
        },
      ];

      expect(buildParamsFromFilters(filters)).toEqual({
        userName: 'ingestion-bot',
        actorType: 'BOT',
      });
    });

    it('should extract entityType from entityType filter', () => {
      const filters: AuditLogActiveFilter[] = [
        {
          category: 'entityType',
          categoryLabel: 'Entity Type',
          value: {
            key: 'table',
            label: 'Table',
            value: 'table',
          },
        },
      ];

      expect(buildParamsFromFilters(filters)).toEqual({ entityType: 'table' });
    });

    it('should merge params from multiple filters', () => {
      const startTs = 1700000000000;
      const endTs = 1700086400000;
      const filters: AuditLogActiveFilter[] = [
        {
          category: 'time',
          categoryLabel: 'Time',
          value: {
            key: 'yesterday',
            label: 'Yesterday',
            value: 'yesterday',
            startTs,
            endTs,
          },
        },
        {
          category: 'entityType',
          categoryLabel: 'Entity Type',
          value: {
            key: 'dashboard',
            label: 'Dashboard',
            value: 'dashboard',
          },
        },
        {
          category: 'user',
          categoryLabel: 'User',
          value: {
            key: 'alice',
            label: 'Alice',
            value: 'alice',
          },
        },
      ];

      expect(buildParamsFromFilters(filters)).toEqual({
        startTs,
        endTs,
        entityType: 'dashboard',
        userName: 'alice',
        actorType: 'USER',
      });
    });

    it('should overwrite same param when multiple filters of same category exist', () => {
      const filters: AuditLogActiveFilter[] = [
        {
          category: 'entityType',
          categoryLabel: 'Entity Type',
          value: { key: 'table', label: 'Table', value: 'table' },
        },
        {
          category: 'entityType',
          categoryLabel: 'Entity Type',
          value: { key: 'topic', label: 'Topic', value: 'topic' },
        },
      ];

      expect(buildParamsFromFilters(filters)).toEqual({ entityType: 'topic' });
    });
  });
});
