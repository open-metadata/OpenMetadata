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

export const DATA_ASSET_RULES = [
  {
    name: 'Multiple Users or Single Team Ownership',
    description:
      'Validates that an entity has either multiple owners or a single team as the owner.',
    rule: '{"multipleUsersOrSingleTeamOwnership":{"var":"owners"}}',
    enabled: true,
    ignoredEntities: [],
    provider: 'system',
  },
  {
    name: 'Multiple Domains are not allowed',
    description:
      'By default, we only allow entities to be assigned to a single domain, except for Users and Teams.',
    rule: '{"<=":[{"length":{"var":"domains"}},1]}',
    enabled: true,
    ignoredEntities: ['user', 'team', 'persona', 'bot'],
    provider: 'system',
  },
  {
    name: 'Multiple Data Products are not allowed',
    description:
      'By default, we only allow entities to be assigned to a single Data Product.',
    rule: '{"<=":[{"length":{"var":"dataProducts"}},1]}',
    enabled: true,
    ignoredEntities: [],
    provider: 'system',
  },
  {
    name: 'Tables can only have a single Glossary Term',
    description:
      'Ensures that an asset is associated with only one Glossary Term.',
    rule: '{"<=":[{"length":{"filterTagsBySource":[{"var":"tags"},"Glossary"]}},1]}',
    enabled: true,
    entityType: 'table',
    ignoredEntities: [],
    provider: 'system',
  },
  {
    name: 'Data Product Domain Validation',
    description:
      "Validates that Data Products assigned to an entity match the entity's domains.",
    rule: '{"validateDataProductDomainMatch":[{"var":"dataProducts"},{"var":"domains"}]}',
    enabled: true,
    ignoredEntities: ['user', 'team', 'persona', 'bot'],
    provider: 'system',
  },
];
