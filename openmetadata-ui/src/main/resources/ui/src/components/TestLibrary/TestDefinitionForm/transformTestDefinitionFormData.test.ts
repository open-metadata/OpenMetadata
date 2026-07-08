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
import {
  EntityType,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  buildCreateTestDefinitionPayload,
  buildEditPatch,
  buildFormDefaults,
} from './transformTestDefinitionFormData';

describe('transformTestDefinitionFormData', () => {
  describe('buildFormDefaults', () => {
    it('defaults testPlatforms to [OpenMetadata] and supportedServices to [] when adding', () => {
      const defaults = buildFormDefaults(undefined);

      expect(defaults.testPlatforms).toEqual([TestPlatform.OpenMetadata]);
      expect(defaults.supportedServices).toEqual([]);
    });

    it('hydrates from initialValues when editing', () => {
      const defaults = buildFormDefaults({
        name: 'my_test',
        entityType: EntityType.Column,
        testPlatforms: [TestPlatform.OpenMetadata],
        supportedServices: ['Mysql'],
      } as never);

      expect(defaults.name).toBe('my_test');
      expect(defaults.entityType).toBe(EntityType.Column);
      expect(defaults.supportedServices).toEqual(['Mysql']);
    });
  });

  describe('buildCreateTestDefinitionPayload', () => {
    it('derives the column validatorClass when sqlExpression + entityType=COLUMN', () => {
      const payload = buildCreateTestDefinitionPayload({
        name: 'c',
        sqlExpression: 'SELECT 1',
        entityType: EntityType.Column,
        testPlatforms: [TestPlatform.OpenMetadata],
      });

      expect(payload.validatorClass).toBe(
        'ColumnRuleLibrarySqlExpressionValidator'
      );
      expect(payload.entityType).toBe(EntityType.Column);
    });

    it('derives the table validatorClass and defaults entityType to TABLE', () => {
      const payload = buildCreateTestDefinitionPayload({
        name: 't',
        sqlExpression: 'SELECT 1',
        testPlatforms: [TestPlatform.OpenMetadata],
      });

      expect(payload.validatorClass).toBe(
        'TableRuleLibrarySqlExpressionValidator'
      );
      expect(payload.entityType).toBe(EntityType.Table);
    });

    it('omits validatorClass when there is no sqlExpression', () => {
      const payload = buildCreateTestDefinitionPayload({
        name: 't',
        entityType: EntityType.Table,
        testPlatforms: [TestPlatform.OpenMetadata],
      });

      expect(payload.validatorClass).toBeUndefined();
    });
  });

  describe('buildEditPatch', () => {
    it('produces a JSON patch of changed fields only', () => {
      const initial = {
        id: '1',
        name: 'n',
        displayName: 'old',
        entityType: EntityType.Table,
      } as never;
      const patch = buildEditPatch(initial, {
        name: 'n',
        displayName: 'new',
        entityType: EntityType.Table,
      });

      expect(patch).toEqual([
        { op: 'replace', path: '/displayName', value: 'new' },
      ]);
    });

    it('returns an empty patch when nothing changed', () => {
      const initial = { id: '1', name: 'n' } as never;

      expect(buildEditPatch(initial, { name: 'n' })).toEqual([]);
    });

    it('ignores undefined-valued keys so untouched fields do not generate patch ops', () => {
      const initial = {
        id: '1',
        name: 'n',
        description: 'has desc',
      } as never;

      expect(
        buildEditPatch(initial, { name: 'n', description: undefined })
      ).toEqual([]);
    });

    it('emits a replace op for a genuine empty-string clear', () => {
      const initial = {
        id: '1',
        name: 'n',
        description: 'has desc',
      } as never;

      expect(buildEditPatch(initial, { name: 'n', description: '' })).toEqual([
        { op: 'replace', path: '/description', value: '' },
      ]);
    });
  });
});
