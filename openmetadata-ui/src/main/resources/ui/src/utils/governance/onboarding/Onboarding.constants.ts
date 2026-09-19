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

/**
 * Stage keys of the default lifecycle, mirroring OnboardingLifecycle on the server.
 *
 * <p>Stages are playbook-defined, so these are the fallback vocabulary rather than a closed set - a
 * playbook may declare its own stages and these keys simply will not appear.
 */
export const ONBOARDING_STAGE = {
  CREATION: 'creation',
  DRAFT: 'draft',
  IN_REVIEW: 'inReview',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  DEPRECATED: 'deprecated',
} as const;

/**
 * A stage key. Deliberately a plain string rather than a union of the defaults - a playbook may
 * declare stages of its own, and narrowing here would reject them.
 */
export type OnboardingStageKey = string;
