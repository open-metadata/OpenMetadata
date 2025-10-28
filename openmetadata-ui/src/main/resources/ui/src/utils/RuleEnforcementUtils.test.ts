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

import { EntityType } from '../enums/entity.enum';
import { EntityRule, RuleType } from '../generated/system/entityRules';
import { getUIHints, parseRule } from './RuleEnforcementUtils';

describe('RuleEnforcementUtils', () => {
  describe('parseRule', () => {
    it('should parse multipleUsersOrSingleTeamOwnership rule', () => {
      const rule: EntityRule = {
        name: 'Ownership Rule',
        description: 'Test ownership rule',
        rule: JSON.stringify({
          multipleUsersOrSingleTeamOwnership: [{ var: 'owners' }],
        }),
        enabled: true,
        ignoredEntities: [],
        provider: 'system',
      };

      const parsed = parseRule(rule);

      expect(parsed.type).toBe(
        RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP
      );
      expect(parsed.enabled).toBe(true);
      expect(parsed.condition).toEqual({
        multipleUsersOrSingleTeamOwnership: [{ var: 'owners' }],
      });
    });

    it('should parse singleGlossaryTermForTable rule', () => {
      const rule: EntityRule = {
        name: 'Glossary Term Rule',
        description: 'Tables can only have a single Glossary Term',
        rule: JSON.stringify({
          '<=': [
            { length: [{ filterTagsBySource: [{ var: 'tags' }, 'Glossary'] }] },
            1,
          ],
        }),
        enabled: true,
        ignoredEntities: [],
        provider: 'system',
      };

      const parsed = parseRule(rule);

      expect(parsed.type).toBe(RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE);
      expect(parsed.enabled).toBe(true);
    });

    it('should handle invalid JSON in rule', () => {
      const rule: EntityRule = {
        name: 'Invalid Rule',
        description: 'Test invalid rule',
        rule: 'invalid json',
        enabled: true,
        ignoredEntities: [],
        provider: 'system',
      };

      const parsed = parseRule(rule);

      expect(parsed.type).toBe('invalid');
      expect(parsed.enabled).toBe(false);
    });
  });

  describe('getUIHints', () => {
    const glossaryTermRule = {
      type: RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE,
      condition: {
        '<=': [
          { length: [{ filterTagsBySource: [{ var: 'tags' }, 'Glossary'] }] },
          1,
        ],
      },
      enabled: true,
      ignoredEntities: [],
      description: 'Tables can only have a single Glossary Term',
      name: 'Glossary Term Rule',
    };

    it('should set canAddMultipleGlossaryTermTable to false for tables', () => {
      const hints = getUIHints([glossaryTermRule], EntityType.TABLE);

      expect(hints.canAddMultipleGlossaryTermTable).toBe(false);
      expect(hints.warnings).toContain(
        'Tables can only have a single Glossary Term'
      );
    });

    it('should not apply glossary term rule to non-table entities', () => {
      const hints = getUIHints([glossaryTermRule], EntityType.DASHBOARD);

      expect(hints.canAddMultipleGlossaryTermTable).toBe(true);
    });
  });
});
