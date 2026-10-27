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

import { useMutation } from '@tanstack/react-query';
import { AxiosError, isAxiosError } from 'axios';
import { useState } from 'react';
import { OntologyReleaseExportOptions } from '../../../generated/api/data/ontologyReleaseExportOptions';
import { OntologyReleaseValidation } from '../../../generated/api/data/ontologyReleaseValidation';
import {
  exportOntologyRelease,
  getOntologyReleaseValidation,
} from '../../../rest/ontologyAPI';
import { OntologyReleaseExportFormat } from '../../../rest/ontologyExport.constants';
import { showErrorToast } from '../../../utils/ToastUtils';

const GATE_STATUS = 422;

const isValidationReport = (data: unknown): data is OntologyReleaseValidation =>
  typeof data === 'object' && data !== null && 'shacl' in data;

const gateReport = (error: unknown): OntologyReleaseValidation | undefined => {
  if (!isAxiosError(error) || error.response?.status !== GATE_STATUS) {
    return undefined;
  }
  const data: unknown = error.response.data;

  return isValidationReport(data) ? data : undefined;
};

export const useOntologyReleaseShacl = (releaseId?: string) => {
  const [report, setReport] = useState<OntologyReleaseValidation>();
  const run = useMutation({
    mutationFn: () => {
      if (!releaseId) {
        throw new Error('Missing active ontology release');
      }

      return getOntologyReleaseValidation(releaseId);
    },
    onError: (error) => showErrorToast(error as AxiosError),
    onSuccess: setReport,
  });
  const download = useMutation({
    mutationFn: async (request: {
      readonly format: OntologyReleaseExportFormat;
      readonly options: OntologyReleaseExportOptions;
    }) => {
      if (!releaseId) {
        throw new Error('Missing active ontology release');
      }
      try {
        return await exportOntologyRelease(
          releaseId,
          request.format,
          request.options
        );
      } catch (error) {
        const blocking = gateReport(error);
        if (!blocking) {
          throw error;
        }
        setReport(blocking);

        return undefined;
      }
    },
    onError: (error) => showErrorToast(error as AxiosError),
  });

  return {
    download: download.mutate,
    isDownloading: download.isPending,
    isRunning: run.isPending,
    report,
    run: () => run.mutate(),
  };
};
