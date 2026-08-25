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

import { EntityType } from '../../enums/entity.enum';

export interface EntityRule {
  name: string;
  description: string;
  rule: string;
  enabled: boolean;
  ignoredEntities: string[];
  provider: 'system' | 'custom';
}

export interface EntityRulesSettings {
  rules: EntityRule[];
}

export enum RuleType {
  MULTIPLE_USERS_OR_SINGLE_TEAM_OWNERSHIP = 'multipleUsersOrSingleTeamOwnership',
  MULTIPLE_DOMAINS_NOT_ALLOWED = 'multipleDomains',
  MULTIPLE_DATA_PRODUCTS_NOT_ALLOWED = 'multipleDataProducts',
  DATA_PRODUCT_DOMAIN_VALIDATION = 'dataProductDomainValidation',
  SINGLE_GLOSSARY_TERM_FOR_TABLE = 'singleGlossaryTermForTable',
}

export interface ParsedRule {
  type: RuleType | string;
  condition: Record<string, unknown>;
  enabled: boolean;
  ignoredEntities: string[];
  description: string;
  name: string;
}

export interface RuleValidationResult {
  isValid: boolean;
  rule: ParsedRule;
  message?: string;
}

export interface DataAssetRuleValidation {
  canAddMultipleUserOwners: boolean;
  canAddMultipleTeamOwner: boolean;
  canAddMultipleDomains: boolean;
  canAddMultipleDataProducts: boolean;
  maxDomains: number;
  maxDataProducts: number;
  canAddMultipleGlossaryTerm: boolean;
  requireDomainForDataProduct: boolean;
}

export interface RuleEnforcementContextType {
  rules: Record<EntityType, ParsedRule[]>;
  isLoading: boolean;
  fetchRulesForEntity: (entityType: EntityType) => Promise<void>;
  getRulesForEntity: (entityType: EntityType) => ParsedRule[];
  getEntityRuleValidation: (entityType: EntityType) => DataAssetRuleValidation;
}
