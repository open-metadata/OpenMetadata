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

import { TFunction } from 'i18next';

export interface OntologyQueryScope {
  readonly ontologyName: string;
  readonly version: 'draft' | 'published';
  /** The active release's semantic version, such as "1.0.0". */
  readonly releaseVersion?: string;
}

/** "clinical · v1.0.0" for the active release, "clinical · draft" for the working copy. */
export function buildQueryScopeLabel(
  scope: OntologyQueryScope,
  t: TFunction
): string {
  let version: string;
  if (scope.version === 'draft') {
    version = t('label.draft').toLocaleLowerCase();
  } else {
    version = scope.releaseVersion
      ? `v${scope.releaseVersion}`
      : t('label.published').toLocaleLowerCase();
  }

  return `${scope.ontologyName} · ${version}`;
}
