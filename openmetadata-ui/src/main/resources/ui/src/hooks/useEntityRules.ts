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

import { useEffect, useMemo } from 'react';
import { useRuleEnforcementProvider } from '../context/RuleEnforcementProvider/RuleEnforcementProvider';
import { EntityType } from '../enums/entity.enum';

export const useEntityRules = (entityType: EntityType) => {
  const {
    rules: allEntityRules,
    fetchRulesForEntity,
    getRulesForEntity,
    getEntityRuleValidation,
    isLoading,
  } = useRuleEnforcementProvider();

  // Get rules for current entity type
  const rules = useMemo(
    () => getRulesForEntity(entityType),
    [entityType, getRulesForEntity]
  );

  // Get UI Component Hints/ EntityRules for current entity
  const entityRules = useMemo(
    () => getEntityRuleValidation(entityType),
    [allEntityRules, entityType]
  );

  // The backend only returns *enabled* rules, so an empty rule set is
  // indistinguishable from "not fetched yet". Track whether the rules for this
  // entity have actually loaded so consumers can hold the strict default (e.g.
  // domain-scoped Data Products) until the real rule state is known.
  const isRulesLoaded = useMemo(
    () => Boolean(allEntityRules?.[entityType]),
    [allEntityRules, entityType]
  );

  useEffect(() => {
    if (entityType) {
      fetchRulesForEntity(entityType);
    }
  }, [entityType, fetchRulesForEntity]);

  return {
    rules,
    entityRules,
    isRulesLoaded,
    isLoading,
  };
};
