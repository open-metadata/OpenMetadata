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
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import type { ReleaseDisplayStatus } from './OntologyReleasePanel.utils';

export const RELEASE_STAGE_LABELS: Record<Stage, string> = {
  [Stage.Draft]: 'label.draft',
  [Stage.InReview]: 'label.ontology-in-review',
  [Stage.ChangesRequested]: 'label.changes-requested',
  [Stage.Approved]: 'label.approved',
  [Stage.Published]: 'label.published',
};

export const RELEASE_STAGE_COLORS: Record<Stage, 'success' | 'error' | 'gray'> =
  {
    [Stage.Draft]: 'gray',
    [Stage.InReview]: 'gray',
    [Stage.ChangesRequested]: 'error',
    [Stage.Approved]: 'success',
    [Stage.Published]: 'success',
  };

type ReleaseBadgeColor = 'success' | 'gray' | 'blue' | 'error';

export const RELEASE_DISPLAY_STATUS: Record<
  ReleaseDisplayStatus,
  { label: string; color: ReleaseBadgeColor }
> = {
  active: { label: 'label.active', color: 'success' },
  superseded: { label: 'label.superseded', color: 'gray' },
  approved: { label: 'label.approved', color: 'success' },
  inReview: { label: 'label.ontology-in-review', color: 'blue' },
  rejected: { label: 'label.rejected', color: 'error' },
  withdrawn: { label: 'label.withdrawn', color: 'gray' },
  draft: { label: 'label.draft', color: 'gray' },
};
