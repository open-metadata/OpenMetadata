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
  useMemo,
  useState,
} from 'react';
import { EntityType } from '../../enums/entity.enum';
import { getEntityRules } from '../../rest/ruleEnforcementAPI';
import {
  getEntityRulesValidation,
  parseRule,
} from '../../utils/RuleEnforcementUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  ParsedRule,
  RuleEnforcementContextType,
} from './RuleEnforcementProvider.interface';

const RuleEnforcementContext = createContext<RuleEnforcementContextType>(
  {} as RuleEnforcementContextType
);
interface RuleEnforcementProviderProps {
  children: React.ReactNode;
}

export const RuleEnforcementProvider: React.FC<RuleEnforcementProviderProps> =
  ({ children }) => {
    const [rules, setRules] = useState<Record<string, ParsedRule[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [loadedEntityTypes, setLoadedEntityTypes] = useState<Set<string>>(
      new Set()
    );

    const fetchRulesForEntity = useCallback(
      async (entityType: EntityType) => {
        // Skip if already loaded
        if (loadedEntityTypes.has(entityType)) {
          return;
        }

        setIsLoading(true);

        try {
          const response = await getEntityRules(entityType);
          const parsedRules = response.map(parseRule);

          setRules((prev) => ({
            ...prev,
            [entityType]: parsedRules,
          }));

          setLoadedEntityTypes((prev) => new Set([...prev, entityType]));
        } catch (err) {
          showErrorToast(err as AxiosError);
        } finally {
          setIsLoading(false);
        }
      },
      [loadedEntityTypes]
    );

    const getRulesForEntity = useCallback(
      (entityType: EntityType): ParsedRule[] => {
        return rules[entityType] || [];
      },
      [rules]
    );

    const getEntityRuleValidation = useCallback(
      (entityType: EntityType) => {
        const entityRules = getRulesForEntity(entityType);

        return getEntityRulesValidation(entityRules, entityType);
      },
      [getRulesForEntity]
    );

    const contextValue = useMemo(
      () => ({
        rules,
        isLoading,
        fetchRulesForEntity,
        getRulesForEntity,
        getEntityRuleValidation,
      }),
      [
        rules,
        isLoading,
        fetchRulesForEntity,
        getRulesForEntity,
        getEntityRuleValidation,
      ]
    );

    return (
      <RuleEnforcementContext.Provider value={contextValue}>
        {children}
      </RuleEnforcementContext.Provider>
    );
  };

export const useRuleEnforcementProvider = () =>
  useContext(RuleEnforcementContext);

export default RuleEnforcementProvider;
