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

import { act, render, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../enums/entity.enum';
import { getEntityRules } from '../../rest/ruleEnforcementAPI';
import {
  getEntityRulesValidation,
  parseRule,
} from '../../utils/RuleEnforcementUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  RuleEnforcementProvider,
  useRuleEnforcementProvider,
} from './RuleEnforcementProvider';
import { EntityRule, RuleType } from './RuleEnforcementProvider.interface';

jest.mock('../../rest/ruleEnforcementAPI', () => ({
  getEntityRules: jest.fn(),
}));

jest.mock('../../utils/RuleEnforcementUtils', () => ({
  parseRule: jest.fn(),
  getEntityRulesValidation: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockEntityRules: EntityRule[] = [
  {
    name: 'Test Rule',
    description: 'Test rule description',
    rule: JSON.stringify({ multipleUsersOrSingleTeamOwnership: true }),
    enabled: true,
    ignoredEntities: [],
    provider: 'system',
  },
];

const mockParsedRules = [
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
  canAddMultipleGlossaryTermTable: true,
  requireDomainForDataProduct: false,
};

describe('RuleEnforcementProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEntityRules as jest.Mock).mockResolvedValue(mockEntityRules);
    (parseRule as jest.Mock).mockImplementation((rule) => ({
      type: RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP,
      condition: JSON.parse(rule.rule),
      enabled: rule.enabled,
      ignoredEntities: rule.ignoredEntities,
      description: rule.description,
      name: rule.name,
    }));
    (getEntityRulesValidation as jest.Mock).mockReturnValue(mockUIHints);
  });

  describe('Provider rendering', () => {
    it('should render children correctly', () => {
      const { getByTestId } = render(
        <RuleEnforcementProvider>
          <div data-testid="test-child">Test Child</div>
        </RuleEnforcementProvider>
      );

      expect(getByTestId('test-child')).toBeInTheDocument();
    });

    it('should provide context value to consumers', () => {
      const TestConsumer = () => {
        const context = useRuleEnforcementProvider();

        return (
          <div>
            <span data-testid="has-context">
              {context ? 'Has Context' : 'No Context'}
            </span>
          </div>
        );
      };

      const { getByTestId } = render(
        <RuleEnforcementProvider>
          <TestConsumer />
        </RuleEnforcementProvider>
      );

      expect(getByTestId('has-context')).toHaveTextContent('Has Context');
    });
  });

  describe('fetchRulesForEntity', () => {
    it('should fetch rules for an entity type', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      await waitFor(() => {
        expect(getEntityRules).toHaveBeenCalledWith(EntityType.TABLE);
        expect(parseRule).toHaveBeenCalledTimes(mockEntityRules.length);
      });
    });

    it('should update loading state while fetching', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      expect(result.current.isLoading).toBe(false);

      const fetchPromise = act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      await fetchPromise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not fetch rules if already loaded', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      await waitFor(() => {
        expect(getEntityRules).toHaveBeenCalledTimes(1);
      });

      (getEntityRules as jest.Mock).mockClear();

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      expect(getEntityRules).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API Error');
      (getEntityRules as jest.Mock).mockRejectedValueOnce(mockError);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(mockError);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should store parsed rules in state', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      await waitFor(() => {
        const rules = result.current.getRulesForEntity(EntityType.TABLE);

        expect(rules).toHaveLength(mockEntityRules.length);
        expect(rules[0].type).toBe(
          RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP
        );
      });
    });

    it('should fetch rules for multiple entity types independently', async () => {
      const dashboardRules: EntityRule[] = [
        {
          name: 'Dashboard Rule',
          description: 'Dashboard rule description',
          rule: JSON.stringify({ '<=': 1 }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        },
      ];

      (getEntityRules as jest.Mock).mockImplementation((entityType) => {
        if (entityType === EntityType.TABLE) {
          return Promise.resolve(mockEntityRules);
        }

        return Promise.resolve(dashboardRules);
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
        await result.current.fetchRulesForEntity(EntityType.DASHBOARD);
      });

      await waitFor(() => {
        expect(getEntityRules).toHaveBeenCalledWith(EntityType.TABLE);
        expect(getEntityRules).toHaveBeenCalledWith(EntityType.DASHBOARD);
        expect(getEntityRules).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('getRulesForEntity', () => {
    it('should return empty array for entity type with no rules', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      const rules = result.current.getRulesForEntity(EntityType.TABLE);

      expect(rules).toEqual([]);
    });

    it('should return rules for entity type after fetching', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      await waitFor(() => {
        const rules = result.current.getRulesForEntity(EntityType.TABLE);

        expect(rules).toHaveLength(mockEntityRules.length);
        expect(rules).toEqual(mockParsedRules);
      });
    });

    it('should return different rules for different entity types', async () => {
      const dashboardRules: EntityRule[] = [
        {
          name: 'Dashboard Rule',
          description: 'Dashboard rule description',
          rule: JSON.stringify({ '<=': 1 }),
          enabled: true,
          ignoredEntities: [],
          provider: 'system',
        },
      ];

      (getEntityRules as jest.Mock).mockImplementation((entityType) => {
        if (entityType === EntityType.TABLE) {
          return Promise.resolve(mockEntityRules);
        }

        return Promise.resolve(dashboardRules);
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
        await result.current.fetchRulesForEntity(EntityType.DASHBOARD);
      });

      await waitFor(() => {
        const tableRules = result.current.getRulesForEntity(EntityType.TABLE);
        const dashboardRulesResult = result.current.getRulesForEntity(
          EntityType.DASHBOARD
        );

        expect(tableRules).toHaveLength(1);
        expect(dashboardRulesResult).toHaveLength(1);
        expect(tableRules[0].name).toBe('Test Rule');
        expect(dashboardRulesResult[0].name).toBe('Dashboard Rule');
      });
    });
  });

  describe('getEntityRuleValidation', () => {
    it('should return UI hints for entity type with no rules', () => {
      (getEntityRulesValidation as jest.Mock).mockReturnValue({
        canAddMultipleUserOwners: true,
        canAddMultipleTeamOwner: true,
        canAddMultipleDomains: true,
        canAddMultipleDataProducts: true,
        maxDomains: Infinity,
        maxDataProducts: Infinity,
        canAddMultipleGlossaryTermTable: true,
        requireDomainForDataProduct: false,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      const hints = result.current.getEntityRuleValidation(EntityType.TABLE);

      expect(hints.canAddMultipleUserOwners).toBe(true);
    });

    it('should return UI hints based on loaded rules', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      await waitFor(() => {
        const hints = result.current.getEntityRuleValidation(EntityType.TABLE);

        expect(getEntityRulesValidation).toHaveBeenCalledWith(
          mockParsedRules,
          EntityType.TABLE
        );
        expect(hints).toEqual(mockUIHints);
      });
    });

    it('should call getEntityRulesValidation with correct entity type', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.DASHBOARD);
      });

      await waitFor(() => {
        result.current.getEntityRuleValidation(EntityType.DASHBOARD);

        expect(getEntityRulesValidation).toHaveBeenCalledWith(
          expect.any(Array),
          EntityType.DASHBOARD
        );
      });
    });
  });

  describe('Context memoization', () => {
    it('should memoize context value', () => {
      const TestConsumer = () => {
        const context1 = useRuleEnforcementProvider();
        const context2 = useRuleEnforcementProvider();

        return (
          <div data-testid="same-context">
            {context1 === context2 ? 'Same' : 'Different'}
          </div>
        );
      };

      const { getByTestId } = render(
        <RuleEnforcementProvider>
          <TestConsumer />
        </RuleEnforcementProvider>
      );

      expect(getByTestId('same-context')).toHaveTextContent('Same');
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent fetch requests for same entity type', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await Promise.all([
          result.current.fetchRulesForEntity(EntityType.TABLE),
          result.current.fetchRulesForEntity(EntityType.TABLE),
          result.current.fetchRulesForEntity(EntityType.TABLE),
        ]);
      });

      await waitFor(() => {
        expect(getEntityRules).toHaveBeenCalled();

        const rules = result.current.getRulesForEntity(EntityType.TABLE);

        expect(rules).toHaveLength(mockEntityRules.length);
      });
    });

    it('should handle empty rules response', async () => {
      (getEntityRules as jest.Mock).mockResolvedValueOnce([]);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      await waitFor(() => {
        const rules = result.current.getRulesForEntity(EntityType.TABLE);

        expect(rules).toEqual([]);
      });
    });

    it('should update rules state correctly after multiple fetches', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RuleEnforcementProvider>{children}</RuleEnforcementProvider>
      );

      const { result } = renderHook(() => useRuleEnforcementProvider(), {
        wrapper,
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.TABLE);
      });

      await waitFor(() => {
        expect(result.current.getRulesForEntity(EntityType.TABLE)).toHaveLength(
          1
        );
      });

      await act(async () => {
        await result.current.fetchRulesForEntity(EntityType.DASHBOARD);
      });

      await waitFor(() => {
        expect(result.current.getRulesForEntity(EntityType.TABLE)).toHaveLength(
          1
        );
        expect(
          result.current.getRulesForEntity(EntityType.DASHBOARD)
        ).toHaveLength(1);
      });
    });
  });
});
