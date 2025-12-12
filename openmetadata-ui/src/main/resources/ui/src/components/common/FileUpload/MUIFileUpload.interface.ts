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

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface FileUploadUrlValue {
  url: string;
}

export interface FileUploadFileValue {
  file: File;
}

export type FileUploadValue = FileUploadUrlValue | FileUploadFileValue;

export interface MUIFileUploadProps {
  value?: FileUploadValue;
  onChange?: (value: FileUploadValue | undefined) => void;
  onUpload?: (file: File) => Promise<string>;
  label?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  validateFile?: (file: File) => Promise<FileValidationResult>;
  renderPreview?: (
    value: FileUploadValue,
    onRemove: () => void,
    onReUpload: () => void
  ) => ReactNode;
  uploadZoneHeight?: number;
  showFileName?: boolean;
  uploadZoneSubtext?: string;
}
