import { ExportTypes } from '../../../constants/Export.constants';

/*
 *  Copyright 2023 Collate.
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
export type CSVExportResponse = {
  jobId: string;
  message: string;
};

export type CSVExportWebsocketResponse = {
  jobId: string;
  status: 'COMPLETED' | 'FAILED';
  data: string;
  error: string | null;
};

export type CSVExportJob = {
  fileName: string;
} & Partial<CSVExportWebsocketResponse> &
  CSVExportResponse;

export interface PDFLayoutConfig {
  layoutType: 'grid' | 'vertical' | 'horizontal';
  imageSpacing: number;
  pageOrientation: 'portrait' | 'landscape';
  customPageSize?: { width: number; height: number };
}

export interface PDFDimensions {
  pageWidth: number;
  pageHeight: number;
  availableWidth: number;
  availableHeight: number;
  imageWidth: number;
  imageHeight: number;
  gridColumns: number;
  gridRows: number;
}

export type ExportData = {
  name: string;
  title?: string;
  documentSelector?: string;
  exportTypes: ExportTypes[];
  viewport?: ExportViewport;
  exportConfig?: Partial<PDFLayoutConfig>;
  hideExportModal?: boolean;
  onExport: (
    name: string,
    params?: {
      recursive?: boolean;
    }
  ) => Promise<CSVExportResponse | string>;
};
export interface EntityExportModalContextProps {
  csvExportData?: string;
  clearCSVExportData: () => void;
  showModal: (data: ExportData) => void;
  triggerExportForBulkEdit: (data: ExportData) => void;
  onUpdateCSVExportJob: (data: Partial<CSVExportWebsocketResponse>) => void;
}

export interface ExportViewport {
  x: number;
  y: number;
  zoom: number;
}
