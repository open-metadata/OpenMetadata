/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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

/**
 * Describes an Access Control Rule for OpenMetadata Metadata Operations. All non-null user
 * (subject) and entity (object) attributes are evaluated with logical AND.
 */
export interface Rule {
  /**
   * Allow or Deny operation on the entity.
   */
  allow?: boolean;
  /**
   * Is the rule enabled.
   */
  enabled?: boolean;
  /**
   * Entity tag that the rule should match on.
   */
  entityTagAttr?: string;
  /**
   * Entity type that the rule should match on.
   */
  entityTypeAttr?: string;
  /**
   * Name for this Rule.
   */
  name: string;
  /**
   * Operation on the entity.
   */
  operation?: Operation;
  /**
   * Priority of this rule among all rules across all policies.
   */
  priority?: number;
  /**
   * Role of the user that the rule should match on.
   */
  userRoleAttr?: string;
}

/**
 * Operation on the entity.
 *
 * This schema defines all possible operations on metadata of data entities.
 */
export enum Operation {
  DecryptTokens = 'DecryptTokens',
  SuggestDescription = 'SuggestDescription',
  SuggestTags = 'SuggestTags',
  UpdateDescription = 'UpdateDescription',
  UpdateLineage = 'UpdateLineage',
  UpdateOwner = 'UpdateOwner',
  UpdateTags = 'UpdateTags',
  UpdateTeam = 'UpdateTeam',
}
