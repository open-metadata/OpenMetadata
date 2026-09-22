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

import {
  Assistance,
  CheckType,
  Requirement,
  Role,
} from '../../../generated/entity/governance/onboardingPlaybook';

export const CHECK_TYPE_LABEL_KEY: Record<CheckType, string> = {
  [CheckType.Attribute]: 'label.attribute',
  [CheckType.Relationship]: 'label.relationship',
  [CheckType.Responsibility]: 'label.responsibility',
  [CheckType.Assessment]: 'label.assessment',
  [CheckType.Approval]: 'label.approval',
};

export const CHECK_TYPE_HINT_KEY: Record<CheckType, string> = {
  [CheckType.Attribute]: 'message.check-type-attribute',
  [CheckType.Relationship]: 'message.check-type-relationship',
  [CheckType.Responsibility]: 'message.check-type-responsibility',
  [CheckType.Assessment]: 'message.check-type-assessment',
  [CheckType.Approval]: 'message.check-type-approval',
};

export const REQUIREMENT_LABEL_KEY: Record<Requirement, string> = {
  [Requirement.Blocking]: 'label.blocking',
  [Requirement.Recommended]: 'label.recommended',
  [Requirement.Optional]: 'label.optional',
};

/** Blocking reads as the decisive state, recommended as advisory, optional as neutral. */
export const REQUIREMENT_BADGE_COLOR: Record<
  Requirement,
  'brand' | 'warning' | 'gray'
> = {
  [Requirement.Blocking]: 'brand',
  [Requirement.Recommended]: 'warning',
  [Requirement.Optional]: 'gray',
};

export const ASSISTANCE_LABEL_KEY: Record<Assistance, string> = {
  [Assistance.AI]: 'label.ai-draft',
  [Assistance.Autofill]: 'label.copy-from-similar-assets',
  [Assistance.Example]: 'label.example-and-guidance',
  [Assistance.None]: 'label.no-assistance',
};

export const ASSISTANCE_HINT_KEY: Record<Assistance, string> = {
  [Assistance.AI]: 'message.assistance-ai',
  [Assistance.Autofill]: 'message.assistance-autofill',
  [Assistance.Example]: 'message.assistance-example',
  [Assistance.None]: 'message.assistance-none',
};

/**
 * Who a check's task goes to, named the way the people doing the work are named rather than after
 * the ownership field each one resolves from: `creator` is whoever is adding the asset, and a
 * standing group such as Data Management is a named team rather than a role of its own.
 */
export const ROLE_LABEL_KEY: Record<Role, string> = {
  [Role.Creator]: 'label.producer',
  [Role.Owners]: 'label.owner',
  [Role.DomainOwners]: 'label.domain-steward',
  [Role.Experts]: 'label.data-expert',
  [Role.Explicit]: 'label.named-users-or-teams',
};

/** The order the design lists them in: closest to the asset first, standing groups last. */
export const ROLE_ORDER: Role[] = [
  Role.Creator,
  Role.Owners,
  Role.Experts,
  Role.DomainOwners,
  Role.Explicit,
];

/** Kind pill on a check: where the answer lives. Approvals are decisions, not fields. */
export const CHECK_KIND_LABEL_KEY = {
  approval: 'label.approval',
  custom: 'label.custom-property',
  native: 'label.native-field',
} as const;

export const CHECK_KIND_BADGE_COLOR = {
  approval: 'gray',
  custom: 'purple',
  native: 'brand',
} as const;
