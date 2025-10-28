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

import { AxiosError } from 'axios';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { EntityType } from '../../enums/entity.enum';
import { ParsedRule } from '../../generated/system/entityRules';
import { getEntityRules } from '../../rest/ruleEnforcementAPI';
import { getUIHints, parseRule } from '../../utils/RuleEnforcementUtils';
import { showErrorToast } from '../../utils/ToastUtils';

interface RuleEnforcementContextType {
  rules: Record<string, ParsedRule[]>;
  isLoading: boolean;
  error: string | null;
  fetchRulesForEntity: (entityType: EntityType | string) => Promise<void>;
  getRulesForEntity: (entityType: EntityType | string) => ParsedRule[];
  getUIHintsForEntity: (
    entityType: EntityType | string
  ) => ReturnType<typeof getUIHints>;
  refreshRules: () => Promise<void>;
}

const RuleEnforcementContext = createContext<
  RuleEnforcementContextType | undefined
>(undefined);

interface RuleEnforcementProviderProps {
  children: React.ReactNode;
  initialEntityTypes?: (EntityType | string)[];
}

export const RuleEnforcementProvider: React.FC<RuleEnforcementProviderProps> =
  ({ children, initialEntityTypes = [] }) => {
    const [rules, setRules] = useState<Record<string, ParsedRule[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadedEntityTypes, setLoadedEntityTypes] = useState<Set<string>>(
      new Set()
    );

    const fetchRulesForEntity = useCallback(
      async (entityType: EntityType | string) => {
        const entityKey = entityType.toLowerCase();

        // Skip if already loaded
        if (loadedEntityTypes.has(entityKey)) {
          return;
        }

        setIsLoading(true);
        setError(null);

        try {
          const response = await getEntityRules(entityType);
          const entityRules = response.data;

          const parsedRules = entityRules.map(parseRule);

          setRules((prev) => ({
            ...prev,
            [entityKey]: parsedRules,
          }));

          setLoadedEntityTypes((prev) => new Set([...prev, entityKey]));
        } catch (err) {
          const error = err as AxiosError;
          const errorMessage = `Failed to fetch rules for ${entityType}`;
          setError(errorMessage);
          showErrorToast(error, errorMessage);
        } finally {
          setIsLoading(false);
        }
      },
      [loadedEntityTypes]
    );

    const getRulesForEntity = useCallback(
      (entityType: EntityType | string): ParsedRule[] => {
        return rules[entityType.toLowerCase()] || [];
      },
      [rules]
    );

    const getUIHintsForEntity = useCallback(
      (entityType: EntityType | string) => {
        const entityRules = getRulesForEntity(entityType);

        return getUIHints(entityRules, entityType);
      },
      [getRulesForEntity]
    );

    const refreshRules = useCallback(async () => {
      // Clear loaded types to force refresh
      setLoadedEntityTypes(new Set());
      setRules({});

      // Reload rules for all previously loaded entity types
      const typesToReload = Array.from(loadedEntityTypes);
      await Promise.all(typesToReload.map(fetchRulesForEntity));
    }, [loadedEntityTypes, fetchRulesForEntity]);

    // Load initial entity types on mount
    useEffect(() => {
      if (initialEntityTypes.length > 0) {
        Promise.all(initialEntityTypes.map(fetchRulesForEntity));
      }
    }, []);

    const contextValue = useMemo(
      () => ({
        rules,
        isLoading,
        error,
        fetchRulesForEntity,
        getRulesForEntity,
        getUIHintsForEntity,
        refreshRules,
      }),
      [
        rules,
        isLoading,
        error,
        fetchRulesForEntity,
        getRulesForEntity,
        getUIHintsForEntity,
        refreshRules,
      ]
    );

    return (
      <RuleEnforcementContext.Provider value={contextValue}>
        {children}
      </RuleEnforcementContext.Provider>
    );
  };

export const useRuleEnforcement = (): RuleEnforcementContextType => {
  const context = useContext(RuleEnforcementContext);
  if (!context) {
    throw new Error(
      'useRuleEnforcement must be used within a RuleEnforcementProvider'
    );
  }

  return context;
};

export default RuleEnforcementProvider;
