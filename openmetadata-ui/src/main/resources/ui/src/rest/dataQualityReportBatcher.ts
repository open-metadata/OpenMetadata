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

// Mirror of the server-side MAX_DATA_QUALITY_REPORT_BATCH_SIZE. A render tick
// that produces more report requests than this is split across multiple POSTs
// so the client never trips the server's batch-size cap (which would 400 and
// reject the whole batch).
const MAX_BATCH_SIZE = 50;

const flushChunk = async (chunk: PendingReport[]): Promise<void> => {
  const requests: DataQualityReportRequest[] = chunk.map((pending, index) => ({
    ...pending.params,
    key: String(index),
  }));

  try {
    const { results } = await getDataQualityReportBatch({ requests });
    const resultByKey = new Map(
      results.map((result) => [result.key, result] as const)
    );

    chunk.forEach((pending, index) => {
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
    chunk.forEach((pending) => pending.reject(error));
  }
};

const flushReports = (): void => {
  const batch = pendingReports;

  pendingReports = [];
  isFlushScheduled = false;

  for (let start = 0; start < batch.length; start += MAX_BATCH_SIZE) {
    void flushChunk(batch.slice(start, start + MAX_BATCH_SIZE));
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
