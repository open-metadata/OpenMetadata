/*
 *  Copyright 2024 Collate.
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
export const LIST_OF_FIELDS_TO_EDIT_NOT_TO_BE_PRESENT = [
  {
    containerSelector: '[data-testid="header-domain-container"]',
    elementSelector: '[data-testid="add-domain"]',
  },
  {
    containerSelector: '[data-testid="owner-label"]',
    elementSelector: '[data-testid="edit-owner"]',
  },
  {
    containerSelector: '[data-testid="header-tier-container"]',
    elementSelector: '[data-testid="edit-tier"]',
  },
  {
    containerSelector: '[data-testid="asset-description-container"]',
    elementSelector: '[data-testid="edit-description"]',
  },
  {
    containerSelector:
      '[data-testid="KnowledgePanel.Tags"] [data-testid="tags-container"]',
    elementSelector: '[data-testid="add-tag"]',
  },
  {
    containerSelector:
      '[data-testid="KnowledgePanel.GlossaryTerms"] [data-testid="glossary-container"]',
    elementSelector: '[data-testid="add-tag"]',
  },
];

export const LIST_OF_FIELDS_TO_EDIT_TO_BE_DISABLED = [
  {
    containerSelector: '[data-testid="asset-header-btn-group"]',
    elementSelector: '[data-testid="up-vote-btn"]',
  },
  {
    containerSelector: '[data-testid="asset-header-btn-group"]',
    elementSelector: '[data-testid="down-vote-btn"]',
  },
  {
    containerSelector: '[data-testid="entity-header-title"]',
    elementSelector: '[data-testid="entity-follow-button"]',
  },
];

export const ENTITIES_WITHOUT_FOLLOWING_BUTTON = [
  'databases',
  'databaseSchemas',
  'services/databaseServices',
  'services/messagingServices',
  'services/pipelineServices',
  'services/dashboardServices',
  'services/mlmodelServices',
  'services/storageServices',
  'services/metadataServices',
  'services/searchServices',
  'apiCollections',
];

/**
 * Timeout for deleting big entities
 * 5 minutes
 */
export const BIG_ENTITY_DELETE_TIMEOUT = 5 * 60 * 1000;
