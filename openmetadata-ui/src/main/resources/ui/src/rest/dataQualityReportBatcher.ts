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
import { DataQualityReport } from '../generated/tests/dataQualityReport';
import { DataQualityReportRequest } from '../generated/tests/dataQualityReportBatchRequest';
import {
  DataQualityReportParamsType,
  getDataQualityReportBatch,
} from './testAPI';

interface PendingReport {
  params: DataQualityReportParamsType;
  resolve: (value: DataQualityReport) => void;
  reject: (reason?: unknown) => void;
}

let pendingReports: PendingReport[] = [];
let isFlushScheduled = false;

const flushReports = async (): Promise<void> => {
  const batch = pendingReports;

  pendingReports = [];
  isFlushScheduled = false;

  const requests: DataQualityReportRequest[] = batch.map((pending, index) => ({
    ...pending.params,
    key: String(index),
  }));

  try {
    const { results } = await getDataQualityReportBatch({ requests });
    const resultByKey = new Map(
      results.map((result) => [result.key, result] as const)
    );

    batch.forEach((pending, index) => {
      const result = resultByKey.get(String(index));

      if (result?.report) {
        pending.resolve(result.report);
      } else {
        pending.reject(
          new Error(result?.error ?? 'Data quality report request failed')
        );
      }
    });
  } catch (error) {
    batch.forEach((pending) => pending.reject(error));
  }
};

/**
 * Coalesces every data quality report request fired within the same microtask
 * into a single POST `/dataQualityReport/batch` call. This collapses the data
 * quality dashboard's N independent report requests into one round trip while
 * keeping each caller's promise (and error handling) independent.
 */
export const batchedDataQualityReport = (
  params: DataQualityReportParamsType
): Promise<DataQualityReport> => {
  return new Promise<DataQualityReport>((resolve, reject) => {
    pendingReports.push({ params, resolve, reject });

    if (!isFlushScheduled) {
      isFlushScheduled = true;
      void Promise.resolve().then(flushReports);
    }
  });
};
