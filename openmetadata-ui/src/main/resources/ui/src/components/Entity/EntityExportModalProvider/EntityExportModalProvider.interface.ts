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

import { CSVExportResponse } from '../../../interface/entity/csv.interface';

export type CSVExportWebsocketResponse = {
  jobId: string;
  status: 'CANCELLED' | 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  data: string | null;
  error: string | null;
  progress?: number;
  total?: number;
  message?: string;
};

export type CSVExportJob = {
  fileName: string;
  statusUnavailable?: boolean;
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
  /**
   * Frames the content of a PNG capture. Called after `beforeCapture` with the
   * size the capture renders at, so the frame covers what `beforeCapture`
   * mounted; a frame fitted before that would shrink the content to a corner.
   */
  getViewport?: (imageWidth: number, imageHeight: number) => ExportViewport;
  exportConfig?: Partial<PDFLayoutConfig>;
  hideExportModal?: boolean;
  renderEdgesOverlay?: (
    imageWidth: number,
    imageHeight: number,
    padding: number,
    pixelRatio: number,
    viewport?: ExportViewport
  ) => HTMLCanvasElement | null;
  /**
   * Awaited before a PNG capture clones `documentSelector`, so the page can
   * mount content it normally leaves out of the DOM, such as off-screen nodes
   * of a virtualized canvas. `afterCapture` runs once the capture ends.
   */
  beforeCapture?: () => Promise<void>;
  afterCapture?: () => void;
  onExport: (
    name: string,
    params?: {
      recursive?: boolean;
    }
  ) => Promise<CSVExportResponse | string>;
  onError?: () => void;
};
export interface EntityExportModalContextProps {
  csvExportData?: string;
  csvExportError?: string;
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
