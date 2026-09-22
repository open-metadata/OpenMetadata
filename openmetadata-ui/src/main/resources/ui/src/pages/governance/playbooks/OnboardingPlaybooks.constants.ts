/*
 *  Copyright 2026 Collate.
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

import { TargetEntityType } from '../../../generated/entity/governance/onboardingPlaybook';

/** Asset types that support a playbook. Types without one still appear, ready to configure. */
export const PLAYBOOK_ENTITY_TYPES: TargetEntityType[] = [
  TargetEntityType.DataProduct,
  TargetEntityType.GlossaryTerm,
  TargetEntityType.Metric,
  TargetEntityType.Domain,
];

export const PLAYBOOK_ENTITY_LABEL_KEY: Record<TargetEntityType, string> = {
  [TargetEntityType.DataProduct]: 'label.data-product',
  [TargetEntityType.GlossaryTerm]: 'label.glossary-term',
  [TargetEntityType.Metric]: 'label.metric',
  [TargetEntityType.Domain]: 'label.domain',
};

/**
 * Playbook authoring uses the existing role and permission model - this table documents it rather
 * than introducing a new admin surface.
 */
/** Count labels carry the asset's own noun, pluralised by i18n. */
export const PLAYBOOK_ENTITY_COUNT_KEY: Record<TargetEntityType, string> = {
  [TargetEntityType.DataProduct]: 'message.product-count',
  [TargetEntityType.GlossaryTerm]: 'message.term-count',
  [TargetEntityType.Metric]: 'message.metric-count',
  [TargetEntityType.Domain]: 'message.domain-count',
};

export const PLAYBOOK_AUTHOR_ROLES = [
  {
    roleKey: 'label.platform-admin',
    scopeKey: 'label.all-playbooks',
    capabilityKey: 'message.playbook-capability-admin',
  },
  {
    roleKey: 'label.data-steward-manage-playbooks',
    scopeKey: 'label.playbooks-in-their-domains',
    capabilityKey: 'message.playbook-capability-steward',
  },
  {
    roleKey: 'label.domain-owner',
    scopeKey: 'label.playbooks-applied-to-their-domain',
    capabilityKey: 'message.playbook-capability-domain-owner',
  },
] as const;
