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

import { renderHook } from '@testing-library/react-hooks';
import { useRuleEnforcementProvider } from '../context/RuleEnforcementProvider/RuleEnforcementProvider';
import {
  ParsedRule,
  RuleType,
} from '../context/RuleEnforcementProvider/RuleEnforcementProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { useEntityRules } from './useEntityRules';

jest.mock('../context/RuleEnforcementProvider/RuleEnforcementProvider', () => ({
  useRuleEnforcementProvider: jest.fn(),
}));

describe('useEntityRules', () => {
  const mockFetchRulesForEntity = jest.fn();
  const mockGetRulesForEntity = jest.fn();
  const mockGetEntityRuleValidation = jest.fn();

  const mockParsedRules: ParsedRule[] = [
    {
      type: RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP,
      condition: { multipleUsersOrSingleTeamOwnership: true },
      enabled: true,
      ignoredEntities: [],
      description: 'Test rule description',
      name: 'Test Rule',
    },
  ];

  const mockUIHints = {
    canAddMultipleUserOwners: true,
    canAddMultipleTeamOwner: false,
    canAddMultipleDomains: true,
    canAddMultipleDataProducts: true,
    maxDomains: Infinity,
    maxDataProducts: Infinity,
    canAddMultipleGlossaryTerm: true,
    requireDomainForDataProduct: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRuleEnforcementProvider as jest.Mock).mockReturnValue({
      fetchRulesForEntity: mockFetchRulesForEntity,
      getRulesForEntity: mockGetRulesForEntity,
      getEntityRuleValidation: mockGetEntityRuleValidation,
      isLoading: false,
    });
    mockGetRulesForEntity.mockReturnValue(mockParsedRules);
    mockGetEntityRuleValidation.mockReturnValue(mockUIHints);
  });

  describe('Basic functionality', () => {
    it('should return rules for the specified entity type', () => {
      const { result } = renderHook(() => useEntityRules(EntityType.TABLE));

      expect(mockGetRulesForEntity).toHaveBeenCalledWith(EntityType.TABLE);
      expect(result.current.rules).toEqual(mockParsedRules);
    });

    it('should return entity rules (UI hints) for the specified entity type', () => {
      const { result } = renderHook(() => useEntityRules(EntityType.TABLE));

      expect(mockGetEntityRuleValidation).toHaveBeenCalledWith(
        EntityType.TABLE
      );
      expect(result.current.entityRules).toEqual(mockUIHints);
    });

    it('should return loading state from provider', () => {
      (useRuleEnforcementProvider as jest.Mock).mockReturnValue({
        fetchRulesForEntity: mockFetchRulesForEntity,
        getRulesForEntity: mockGetRulesForEntity,
        getEntityRuleValidation: mockGetEntityRuleValidation,
        isLoading: true,
      });

      const { result } = renderHook(() => useEntityRules(EntityType.TABLE));

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Entity type changes', () => {
    it('should fetch rules for new entity type when entityType changes', () => {
      const { rerender } = renderHook(
        ({ entityType }) => useEntityRules(entityType),
        {
          initialProps: { entityType: EntityType.TABLE },
        }
      );

      expect(mockFetchRulesForEntity).toHaveBeenCalledWith(EntityType.TABLE);
      expect(mockFetchRulesForEntity).toHaveBeenCalledTimes(1);

      rerender({ entityType: EntityType.DASHBOARD });

      expect(mockFetchRulesForEntity).toHaveBeenCalledWith(
        EntityType.DASHBOARD
      );
      expect(mockFetchRulesForEntity).toHaveBeenCalledTimes(2);
    });

    it('should return updated rules when entity type changes', () => {
      const dashboardRules: ParsedRule[] = [
        {
          type: RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED,
          condition: { '<=': 1 },
          enabled: true,
          ignoredEntities: [],
          description: 'Dashboard rule',
          name: 'Dashboard Rule',
        },
      ];

      mockGetRulesForEntity.mockImplementation((entityType: EntityType) => {
        return entityType === EntityType.TABLE
          ? mockParsedRules
          : dashboardRules;
      });

      const { result, rerender } = renderHook(
        ({ entityType }) => useEntityRules(entityType),
        {
          initialProps: { entityType: EntityType.TABLE },
        }
      );

      expect(result.current.rules).toEqual(mockParsedRules);

      rerender({ entityType: EntityType.DASHBOARD });

      expect(result.current.rules).toEqual(dashboardRules);
    });
  });

  describe('Memoization', () => {
    it('should memoize rules and return the same reference when dependencies do not change', () => {
      const { result, rerender } = renderHook(() =>
        useEntityRules(EntityType.TABLE)
      );

      const firstRulesReference = result.current.rules;

      rerender();

      expect(result.current.rules).toBe(firstRulesReference);
    });

    it('should memoize entityRules and return the same reference when dependencies do not change', () => {
      const { result, rerender } = renderHook(() =>
        useEntityRules(EntityType.TABLE)
      );

      const firstEntityRulesReference = result.current.entityRules;

      rerender();

      expect(result.current.entityRules).toBe(firstEntityRulesReference);
    });

    it('should recompute rules when entity type changes', () => {
      const tableRules = mockParsedRules;
      const dashboardRules: ParsedRule[] = [
        {
          type: RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED,
          condition: { '<=': 1 },
          enabled: true,
          ignoredEntities: [],
          description: 'Dashboard rule',
          name: 'Dashboard Rule',
        },
      ];

      mockGetRulesForEntity.mockImplementation((entityType: EntityType) => {
        return entityType === EntityType.TABLE ? tableRules : dashboardRules;
      });

      const { result, rerender } = renderHook(
        ({ entityType }) => useEntityRules(entityType),
        {
          initialProps: { entityType: EntityType.TABLE },
        }
      );

      const firstRulesReference = result.current.rules;

      expect(firstRulesReference).toBe(tableRules);

      rerender({ entityType: EntityType.DASHBOARD });

      expect(result.current.rules).not.toBe(firstRulesReference);
      expect(result.current.rules).toBe(dashboardRules);
    });
  });

  describe('Different entity types', () => {
    it('should work with DASHBOARD entity type', () => {
      const { result } = renderHook(() => useEntityRules(EntityType.DASHBOARD));

      expect(mockFetchRulesForEntity).toHaveBeenCalledWith(
        EntityType.DASHBOARD
      );
      expect(mockGetRulesForEntity).toHaveBeenCalledWith(EntityType.DASHBOARD);
      expect(mockGetEntityRuleValidation).toHaveBeenCalledWith(
        EntityType.DASHBOARD
      );
      expect(result.current.rules).toEqual(mockParsedRules);
    });

    it('should work with TOPIC entity type', () => {
      const { result } = renderHook(() => useEntityRules(EntityType.TOPIC));

      expect(mockFetchRulesForEntity).toHaveBeenCalledWith(EntityType.TOPIC);
      expect(mockGetRulesForEntity).toHaveBeenCalledWith(EntityType.TOPIC);
      expect(mockGetEntityRuleValidation).toHaveBeenCalledWith(
        EntityType.TOPIC
      );
      expect(result.current.rules).toEqual(mockParsedRules);
    });

    it('should work with CONTAINER entity type', () => {
      const { result } = renderHook(() => useEntityRules(EntityType.CONTAINER));

      expect(mockFetchRulesForEntity).toHaveBeenCalledWith(
        EntityType.CONTAINER
      );
      expect(mockGetRulesForEntity).toHaveBeenCalledWith(EntityType.CONTAINER);
      expect(mockGetEntityRuleValidation).toHaveBeenCalledWith(
        EntityType.CONTAINER
      );
      expect(result.current.rules).toEqual(mockParsedRules);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty rules array', () => {
      mockGetRulesForEntity.mockReturnValue([]);

      const { result } = renderHook(() => useEntityRules(EntityType.TABLE));

      expect(result.current.rules).toEqual([]);
    });

    it('should handle when getEntityRuleValidation returns default hints', () => {
      const defaultHints = {
        canAddMultipleUserOwners: true,
        canAddMultipleTeamOwner: true,
        canAddMultipleDomains: true,
        canAddMultipleDataProducts: true,
        maxDomains: Infinity,
        maxDataProducts: Infinity,
        canAddMultipleGlossaryTerm: true,
        requireDomainForDataProduct: false,
        warnings: [],
      };
      mockGetEntityRuleValidation.mockReturnValue(defaultHints);

      const { result } = renderHook(() => useEntityRules(EntityType.TABLE));

      expect(result.current.entityRules).toEqual(defaultHints);
    });

    it('should handle multiple rules with different types', () => {
      const multipleRules: ParsedRule[] = [
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
          description: 'Data product rule',
          name: 'Data Product Rule',
        },
      ];

      mockGetRulesForEntity.mockReturnValue(multipleRules);

      const { result } = renderHook(() => useEntityRules(EntityType.TABLE));

      expect(result.current.rules).toEqual(multipleRules);
      expect(result.current.rules).toHaveLength(3);
    });
  });
});
