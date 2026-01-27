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
  DataAssetRuleValidation,
  EntityRule,
  ParsedRule,
  RuleType,
} from '../context/RuleEnforcementProvider/RuleEnforcementProvider.interface';
import { EntityType } from '../enums/entity.enum';

/**
 * Parse a rule string into a structured object
 */
export const parseRule = (rule: EntityRule): ParsedRule => {
  const ruleObj = JSON.parse(rule.rule);

  // Determine rule type from the parsed object
  let ruleType = 'custom';

  if (ruleObj.multipleUsersOrSingleTeamOwnership) {
    ruleType = RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP;
  } else if (ruleObj['<='] && JSON.stringify(ruleObj).includes('domains')) {
    ruleType = RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED;
  } else if (
    ruleObj['<='] &&
    JSON.stringify(ruleObj).includes('dataProducts')
  ) {
    ruleType = RuleType.MULTIPLE_DATA_PRODUCTS_NOT_ALLOWED;
  } else if (ruleObj.validateDataProductDomainMatch) {
    ruleType = RuleType.DATA_PRODUCT_DOMAIN_VALIDATION;
  } else if (
    ruleObj['<='] &&
    JSON.stringify(ruleObj).includes('filterTagsBySource') &&
    JSON.stringify(ruleObj).includes('Glossary')
  ) {
    ruleType = RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE;
  }

  return {
    type: ruleType,
    condition: ruleObj,
    enabled: rule.enabled,
    ignoredEntities: rule.ignoredEntities,
    description: rule.description,
    name: rule.name,
  };
};

/**
 * Get UI hints for specific rules (e.g., disable buttons, show warnings)
 */
export const getEntityRulesValidation = (
  rules: ParsedRule[],
  entityType: EntityType
) => {
  const hints: DataAssetRuleValidation = {
    canAddMultipleUserOwners: true,
    canAddMultipleTeamOwner: true,
    canAddMultipleDomains: true,
    canAddMultipleDataProducts: true,
    maxDomains: Infinity,
    maxDataProducts: Infinity,
    canAddMultipleGlossaryTerm: true,
    requireDomainForDataProduct: false,
  };

  rules.forEach((rule) => {
    if (rule.ignoredEntities.includes(entityType) || !rule.enabled) {
      return;
    }

    switch (rule.type) {
      case RuleType.MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP:
        hints.canAddMultipleUserOwners = true;
        hints.canAddMultipleTeamOwner = false;

        break;

      case RuleType.MULTIPLE_DOMAINS_NOT_ALLOWED:
        hints.canAddMultipleDomains = false;
        hints.maxDomains = 1;

        break;

      case RuleType.MULTIPLE_DATA_PRODUCTS_NOT_ALLOWED:
        hints.canAddMultipleDataProducts = false;
        hints.maxDataProducts = 1;

        break;

      case RuleType.DATA_PRODUCT_DOMAIN_VALIDATION:
        hints.requireDomainForDataProduct = true;

        break;

      case RuleType.SINGLE_GLOSSARY_TERM_FOR_TABLE:
        // Check if entity is a table and limit glossary terms
        if (entityType.toLowerCase() === 'table') {
          hints.canAddMultipleGlossaryTerm = false;
        }

        break;
    }
  });

  return hints;
};
