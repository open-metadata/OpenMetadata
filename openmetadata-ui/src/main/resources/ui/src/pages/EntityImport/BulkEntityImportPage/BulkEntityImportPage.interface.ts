/*
 *  Copyright 2025 Collate.
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
import { ReactNode } from 'react';
import type { Column } from 'react-data-grid';
import { VALIDATION_STEP } from '../../../constants/BulkImport.constant';
import { EntityStatus } from '../../../generated/entity/data/metric';
import { CSVImportResult } from '../../../generated/type/csvImportResult';
import { getImportOperationSummary } from '../../../utils/CSV/CSV.utils';

export type TranslateFn = (
  key: string,
  options?: Record<string, unknown>
) => string;

export interface ActiveImportBannerProps {
  activeAsyncImportJob?: CSVImportJobType;
}

export interface ImportWizardFooterProps {
  activeStep: VALIDATION_STEP;
  isValidating: boolean;
  isRichGridImport: boolean;
  onBack: () => void;
  onCancel: () => void;
  onValidate: () => void;
}

export interface Step0UploadContentProps {
  isCsvPreviewProcessing: boolean;
  abortReason?: string;
  processingPreview: ReactNode;
  uploadStep: ReactNode;
  onRetryCsvUpload: () => void;
}

export interface Step2ResultsContentProps {
  isValidating: boolean;
  hasActiveAsyncImportJob: boolean;
  importProgress: ReactNode;
  validationData?: CSVImportResult;
  importOperationSummary?: ReturnType<typeof getImportOperationSummary>;
  validateCSVData?: {
    columns: Column<Record<string, string>>[];
    dataSource: Record<string, string>[];
  };
  importResultColumns: Column<Record<string, string>>[];
}

export interface Step1EditGridContentProps {
  validationData?: CSVImportResult;
  editDataGrid: ReactNode;
  onAddRow: () => void;
  onToggleRowFilter: () => void;
  onRevertChanges: () => void;
}

export interface MetricBulkEditListFilters {
  searchText?: string;
  statusFilter?: EntityStatus;
}

export type MetricBulkEditScope =
  | {
      mode: 'selected';
      metricIds: string[];
      metricNames: string[];
      filters: MetricBulkEditListFilters;
    }
  | {
      mode: 'filtered';
      filters: MetricBulkEditListFilters;
    };

export interface BulkEntityImportLocationState {
  metricBulkEditScope?: MetricBulkEditScope;
  selectedMetricNames?: string[];
}

export type CSVImportAsyncResponse = {
  jobId: string;
  message: string;
};

export type CSVImportAsyncWebsocketResponse = {
  jobId: string;
  status: 'COMPLETED' | 'FAILED' | 'STARTED' | 'IN_PROGRESS';
  result?: CSVImportResult;
  error?: string | null;
  progress?: number;
  total?: number;
  message?: string;
};

export type CSVImportAsyncJob = Partial<CSVImportAsyncWebsocketResponse> &
  CSVImportAsyncResponse;

export type CSVImportJobType =
  | (Partial<CSVImportAsyncJob> & {
      type: 'initialLoad';
      initialResult: string;
    })
  | (Partial<CSVImportAsyncJob> & { type: 'onValidate' });
