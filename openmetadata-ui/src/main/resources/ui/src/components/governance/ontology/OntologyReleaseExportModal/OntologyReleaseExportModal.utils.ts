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

import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import type {
  OntologyReleaseExportContentState,
  OntologyReleaseExportSelection,
} from './OntologyReleaseExportContent';

interface OntologyReleasePreviewState {
  readonly content?: string;
  readonly isActiveReleaseLoading: boolean;
  readonly isError: boolean;
  readonly isPreviewLoading: boolean;
  readonly release?: OntologyRelease | null;
  readonly retry: () => void;
}

export const resolveContentOptions = (
  selection: OntologyReleaseExportSelection
) => ({
  includeBoundAssets:
    selection.options.includeBoundAssets && selection.card !== 'csv',
  includeInverses: selection.options.includeInverses,
});

export const resolveContentState = ({
  content,
  isActiveReleaseLoading,
  isError,
  isPreviewLoading,
  release,
  retry,
}: OntologyReleasePreviewState): OntologyReleaseExportContentState => {
  if (isActiveReleaseLoading) {
    return { kind: 'loading' };
  }
  if (isError) {
    return { kind: 'error', onRetry: retry };
  }

  return release
    ? { content, isPreviewLoading, kind: 'ready' }
    : { kind: 'empty' };
};
