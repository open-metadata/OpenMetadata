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
  EntityRule,
  ParsedRule,
  RuleType,
} from '../context/RuleEnforcementProvider/RuleEnforcementProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { getEntityRulesValidation, parseRule } from './RuleEnforcementUtils';

describe('RuleEnforcementUtils', () => {
  describe('parseRule', () => {
    describe('Rule type detection', () => {
      it('should parse MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP rule', () => {
        const entityRule: EntityRule = {
          name: 'Ownership Rule',
          description: 'Multiple users or single team ownership',
          rule: JSON.stringify({ multipleUsersOrSingleTeamOwnership: true }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result).toEqual({
          type: RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP,
          condition: { multipleUsersOrSingleTeamOwnership: true },
          enabled: true,
          ignoredEntities: [],
          description: 'Multiple users or single team ownership',
          name: 'Ownership Rule',
        });
      });

      it('should parse MULTIPLE_DOMAINS_NOT_ALLOWED rule', () => {
        const entityRule: EntityRule = {
          name: 'Domain Rule',
          description: 'Limit domains',
          rule: JSON.stringify({ '<=': 1, var: 'domains' }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.type).toBe(RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED);
        expect(result.condition).toEqual({ '<=': 1, var: 'domains' });
        expect(result.name).toBe('Domain Rule');
      });

      it('should parse MULTIPLE_DATA_PRODUCTS_NOT_ALLOWED rule', () => {
        const entityRule: EntityRule = {
          name: 'Data Product Rule',
          description: 'Limit data products',
          rule: JSON.stringify({ '<=': 1, var: 'dataProducts' }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.type).toBe(RuleType.MULTIPLE_DATA_PRODUCTS_NOT_ALLOWED);
        expect(result.condition).toEqual({ '<=': 1, var: 'dataProducts' });
        expect(result.name).toBe('Data Product Rule');
      });

      it('should parse DATA_PRODUCT_DOMAIN_VALIDATION rule', () => {
        const entityRule: EntityRule = {
          name: 'Domain Validation Rule',
          description: 'Validate data product domain',
          rule: JSON.stringify({ validateDataProductDomainMatch: true }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.type).toBe(RuleType.DATA_PRODUCT_DOMAIN_VALIDATION);
        expect(result.condition).toEqual({
          validateDataProductDomainMatch: true,
        });
        expect(result.name).toBe('Domain Validation Rule');
      });

      it('should parse SINGLE_GLOSSARY_TERM_FOR_TABLE rule', () => {
        const entityRule: EntityRule = {
          name: 'Glossary Term Rule',
          description: 'Single glossary term for table',
          rule: JSON.stringify({
            '<=': 1,
            filterTagsBySource: 'Glossary',
          }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.type).toBe(RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE);
        expect(result.condition).toEqual({
          '<=': 1,
          filterTagsBySource: 'Glossary',
        });
        expect(result.name).toBe('Glossary Term Rule');
      });

      it('should parse custom rule when no known pattern matches', () => {
        const entityRule: EntityRule = {
          name: 'Custom Rule',
          description: 'A custom validation rule',
          rule: JSON.stringify({ customValidation: true }),
          enabled: true,
          ignoredEntities: [],
          provider: 'custom',
        };

        const result = parseRule(entityRule);

        expect(result.type).toBe('custom');
        expect(result.condition).toEqual({ customValidation: true });
        expect(result.name).toBe('Custom Rule');
      });
    });

    describe('Rule properties', () => {
      it('should preserve enabled status as true', () => {
        const entityRule: EntityRule = {
          name: 'Test Rule',
          description: 'Test',
          rule: JSON.stringify({ test: true }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.enabled).toBe(true);
      });

      it('should preserve enabled status as false', () => {
        const entityRule: EntityRule = {
          name: 'Test Rule',
          description: 'Test',
          rule: JSON.stringify({ test: true }),
          enabled: false,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.enabled).toBe(false);
      });

      it('should preserve ignoredEntities array', () => {
        const ignoredEntities = [EntityType.TABLE, EntityType.DASHBOARD];
        const entityRule: EntityRule = {
          name: 'Test Rule',
          description: 'Test',
          rule: JSON.stringify({ test: true }),
          enabled: true,
          ignoredEntities,
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.ignoredEntities).toEqual(ignoredEntities);
      });

      it('should preserve rule description and name', () => {
        const entityRule: EntityRule = {
          name: 'My Test Rule',
          description: 'This is a detailed description',
          rule: JSON.stringify({ test: true }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.name).toBe('My Test Rule');
        expect(result.description).toBe('This is a detailed description');
      });
    });

    describe('Edge cases', () => {
      it('should handle complex JSON rule structures', () => {
        const entityRule: EntityRule = {
          name: 'Complex Rule',
          description: 'Complex validation',
          rule: JSON.stringify({
            and: [{ '>=': 1 }, { '<=': 5 }],
            nested: { deep: { property: true } },
          }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.condition).toEqual({
          and: [{ '>=': 1 }, { '<=': 5 }],
          nested: { deep: { property: true } },
        });
      });

      it('should handle empty ignoredEntities array', () => {
        const entityRule: EntityRule = {
          name: 'Test Rule',
          description: 'Test',
          rule: JSON.stringify({ test: true }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        };

        const result = parseRule(entityRule);

        expect(result.ignoredEntities).toEqual([]);
      });
    });
  });

  describe('getEntityRulesValidation', () => {
    describe('Default hints', () => {
      it('should return default hints when no rules are provided', () => {
        const hints = getEntityRulesValidation([], EntityType.TABLE);

        expect(hints).toEqual({
          canAddMultipleUserOwners: true,
          canAddMultipleTeamOwner: true,
          canAddMultipleDomains: true,
          canAddMultipleDataProducts: true,
          maxDomains: Infinity,
          maxDataProducts: Infinity,
          canAddMultipleGlossaryTerm: true,
          requireDomainForDataProduct: false,
        });
      });

      it('should return default hints when rules are empty array', () => {
        const hints = getEntityRulesValidation([], EntityType.DASHBOARD);

        expect(hints.canAddMultipleUserOwners).toBe(true);
        expect(hints.canAddMultipleTeamOwner).toBe(true);
      });
    });

    describe('MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP rule', () => {
      it('should apply ownership constraints', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP,
            condition: { multipleUsersOrSingleTeamOwnership: true },
            enabled: true,
            ignoredEntities: [],
            description: 'Ownership rule',
            name: 'Ownership Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.canAddMultipleUserOwners).toBe(true);
        expect(hints.canAddMultipleTeamOwner).toBe(false);
      });
    });

    describe('MULTIPLE_DOMAINS_NOT_ALLOWED rule', () => {
      it('should restrict multiple domains', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED,
            condition: { '<=': 1 },
            enabled: true,
            ignoredEntities: [],
            description: 'Domain rule',
            name: 'Domain Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.canAddMultipleDomains).toBe(false);
        expect(hints.maxDomains).toBe(1);
      });
    });

    describe('MULTIPLE_DATA_PRODUCTS_NOT_ALLOWED rule', () => {
      it('should restrict multiple data products', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_DATA_PRODUCTS_NOT_ALLOWED,
            condition: { '<=': 1 },
            enabled: true,
            ignoredEntities: [],
            description: 'Data product rule',
            name: 'Data Product Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.canAddMultipleDataProducts).toBe(false);
        expect(hints.maxDataProducts).toBe(1);
      });
    });

    describe('DATA_PRODUCT_DOMAIN_VALIDATION rule', () => {
      it('should require domain for data product', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.DATA_PRODUCT_DOMAIN_VALIDATION,
            condition: { validateDataProductDomainMatch: true },
            enabled: true,
            ignoredEntities: [],
            description: 'Domain validation',
            name: 'Domain Validation',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.requireDomainForDataProduct).toBe(true);
      });
    });

    describe('SINGLE_GLOSSARY_TERM_FOR_TABLE rule', () => {
      it('should restrict glossary terms for table entity type', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE,
            condition: { '<=': 1, filterTagsBySource: 'Glossary' },
            enabled: true,
            ignoredEntities: [],
            description: 'Glossary term rule',
            name: 'Glossary Term Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.canAddMultipleGlossaryTerm).toBe(false);
      });

      it('should not restrict glossary terms for non-table entity types', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE,
            condition: { '<=': 1, filterTagsBySource: 'Glossary' },
            enabled: true,
            ignoredEntities: [],
            description: 'Glossary term rule',
            name: 'Glossary Term Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.DASHBOARD);

        expect(hints.canAddMultipleGlossaryTerm).toBe(true);
      });

      it('should handle case-insensitive table entity type', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE,
            condition: { '<=': 1, filterTagsBySource: 'Glossary' },
            enabled: true,
            ignoredEntities: [],
            description: 'Glossary term rule',
            name: 'Glossary Term Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, 'TABLE' as EntityType);

        expect(hints.canAddMultipleGlossaryTerm).toBe(false);
      });
    });

    describe('Disabled rules', () => {
      it('should skip disabled rules', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP,
            condition: { multipleUsersOrSingleTeamOwnership: true },
            enabled: false,
            ignoredEntities: [],
            description: 'Ownership rule',
            name: 'Ownership Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.canAddMultipleUserOwners).toBe(true);
        expect(hints.canAddMultipleTeamOwner).toBe(true);
      });
    });

    describe('Ignored entities', () => {
      it('should skip rules for ignored entity types', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED,
            condition: { '<=': 1 },
            enabled: true,
            ignoredEntities: [EntityType.TABLE],
            description: 'Domain rule',
            name: 'Domain Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.canAddMultipleDomains).toBe(true);
        expect(hints.maxDomains).toBe(Infinity);
      });

      it('should apply rules for non-ignored entity types', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED,
            condition: { '<=': 1 },
            enabled: true,
            ignoredEntities: [EntityType.DASHBOARD],
            description: 'Domain rule',
            name: 'Domain Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.canAddMultipleDomains).toBe(false);
        expect(hints.maxDomains).toBe(1);
      });
    });

    describe('Multiple rules', () => {
      it('should apply multiple rules correctly', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP,
            condition: { multipleUsersOrSingleTeamOwnership: true },
            enabled: true,
            ignoredEntities: [],
            description: 'Ownership rule',
            name: 'Ownership Rule',
          },
          {
            type: RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED,
            condition: { '<=': 1 },
            enabled: true,
            ignoredEntities: [],
            description: 'Domain rule',
            name: 'Domain Rule',
          },
          {
            type: RuleType.DATA_PRODUCT_DOMAIN_VALIDATION,
            condition: { validateDataProductDomainMatch: true },
            enabled: true,
            ignoredEntities: [],
            description: 'Domain validation',
            name: 'Domain Validation',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.canAddMultipleUserOwners).toBe(true);
        expect(hints.canAddMultipleTeamOwner).toBe(false);
        expect(hints.canAddMultipleDomains).toBe(false);
        expect(hints.maxDomains).toBe(1);
        expect(hints.requireDomainForDataProduct).toBe(true);
      });

      it('should handle mix of enabled and disabled rules', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED,
            condition: { '<=': 1 },
            enabled: true,
            ignoredEntities: [],
            description: 'Domain rule',
            name: 'Domain Rule',
          },
          {
            type: RuleType.MULTIPLE_DATA_PRODUCTS_NOT_ALLOWED,
            condition: { '<=': 1 },
            enabled: false,
            ignoredEntities: [],
            description: 'Data product rule',
            name: 'Data Product Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints.canAddMultipleDomains).toBe(false);
        expect(hints.canAddMultipleDataProducts).toBe(true);
      });
    });

    describe('Custom rules', () => {
      it('should not affect hints for unknown rule types', () => {
        const rules: ParsedRule[] = [
          {
            type: 'custom',
            condition: { customValidation: true },
            enabled: true,
            ignoredEntities: [],
            description: 'Custom rule',
            name: 'Custom Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TABLE);

        expect(hints).toEqual({
          canAddMultipleUserOwners: true,
          canAddMultipleTeamOwner: true,
          canAddMultipleDomains: true,
          canAddMultipleDataProducts: true,
          maxDomains: Infinity,
          maxDataProducts: Infinity,
          canAddMultipleGlossaryTerm: true,
          requireDomainForDataProduct: false,
        });
      });
    });

    describe('Different entity types', () => {
      it('should handle DASHBOARD entity type', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED,
            condition: { '<=': 1 },
            enabled: true,
            ignoredEntities: [],
            description: 'Domain rule',
            name: 'Domain Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.DASHBOARD);

        expect(hints.canAddMultipleDomains).toBe(false);
        expect(hints.maxDomains).toBe(1);
      });

      it('should handle TOPIC entity type', () => {
        const rules: ParsedRule[] = [
          {
            type: RuleType.MULTIPLE_DATA_PRODUCTS_NOT_ALLOWED,
            condition: { '<=': 1 },
            enabled: true,
            ignoredEntities: [],
            description: 'Data product rule',
            name: 'Data Product Rule',
          },
        ];

        const hints = getEntityRulesValidation(rules, EntityType.TOPIC);

        expect(hints.canAddMultipleDataProducts).toBe(false);
        expect(hints.maxDataProducts).toBe(1);
      });
    });
  });
});
