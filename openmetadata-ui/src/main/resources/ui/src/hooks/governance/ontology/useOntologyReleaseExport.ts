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

import { useQuery } from '@tanstack/react-query';
import { OntologyReleaseExportOptions } from '../../../generated/api/data/ontologyReleaseExportOptions';
import { OntologyRelease } from '../../../generated/entity/data/ontologyRelease';
import {
  exportOntologyRelease,
  getOntologyRelease,
  getOntologyState,
} from '../../../rest/ontologyAPI';
import { OntologyReleaseExportFormat } from '../../../rest/ontologyExport.constants';

export const useOntologyReleaseExport = (
  ontologyId: string,
  format: OntologyReleaseExportFormat,
  options: OntologyReleaseExportOptions
) => {
  const activeRelease = useQuery<OntologyRelease | null>({
    gcTime: 0,
    queryKey: ['ontology-active-release', ontologyId],
    retry: false,
    queryFn: async ({ signal }) => {
      const state = await getOntologyState(ontologyId, signal);
      if (!state.activeReleaseId) {
        return null;
      }
      // The release ID comes from the state response, so this request is necessarily dependent.
      // eslint-disable-next-line openmetadata-imports/review-sequential-api-calls
      const release = await getOntologyRelease(state.activeReleaseId, signal);
      if (release.ontology.id !== ontologyId) {
        throw new Error('Ontology release identity does not match the scope');
      }

      return release;
    },
  });
  const releaseContent = useQuery({
    enabled: Boolean(activeRelease.data),
    gcTime: 0,
    queryKey: [
      'ontology-release-export',
      activeRelease.data?.id,
      format,
      options,
    ],
    retry: false,
    queryFn: ({ signal }) => {
      if (!activeRelease.data) {
        throw new Error('Missing active ontology release');
      }

      return exportOntologyRelease(
        activeRelease.data.id,
        format,
        options,
        signal
      );
    },
  });

  const retry = () => {
    if (activeRelease.isError) {
      void activeRelease.refetch();

      return;
    }
    void releaseContent.refetch();
  };

  return {
    content: releaseContent.data,
    isActiveReleaseLoading: activeRelease.isLoading,
    isError: activeRelease.isError || releaseContent.isError,
    isPreviewLoading: releaseContent.isLoading,
    release: activeRelease.data,
    retry,
  };
};
