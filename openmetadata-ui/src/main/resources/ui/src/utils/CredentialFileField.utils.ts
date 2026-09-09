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

import {
  CredentialFileInputLabels,
  CredentialFileValidationMessages,
  DEFAULT_CREDENTIAL_FILE_MAX_SIZE,
  getReadableFileSize,
} from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';

/**
 * Schema markers that turn a `format: password` string into a credential-file
 * field: `file` is upload-only, `fileOrInput` also accepts pasted content.
 *
 * Both JSON Schema form stacks read the same marker, so the mapping from schema
 * to `CredentialFileInput` props lives here rather than in either widget.
 */
export enum CredentialFileFieldType {
  FILE = 'file',
  FILE_OR_INPUT = 'fileOrInput',
}

export const isCredentialFileFieldType = (
  uiFieldType: unknown
): uiFieldType is CredentialFileFieldType =>
  uiFieldType === CredentialFileFieldType.FILE ||
  uiFieldType === CredentialFileFieldType.FILE_OR_INPUT;

export const getCredentialFileLabels = (
  t: TFunction
): CredentialFileInputLabels => ({
  clickToUpload: t('label.click-to-upload'),
  formatHint: (formats, size) =>
    t('message.file-format-size', {
      formats: formats || t('label.file'),
      size,
    }),
  manualInput: t('label.enter-file-content'),
  or: t('label.or'),
  orDragAndDrop: t('label.or-drag-and-drop'),
  remove: t('label.remove'),
  savedValue: t('label.saved-credential'),
});

export const getCredentialFileValidationMessages = (
  t: TFunction,
  acceptedFileTypes?: string[]
): CredentialFileValidationMessages => ({
  binary: t('message.credential-file-not-text'),
  sizeLimit: t('message.file-size-exceeded', {
    size: getReadableFileSize(DEFAULT_CREDENTIAL_FILE_MAX_SIZE),
  }),
  unacceptedType: t('message.invalid-file-format', {
    formats: acceptedFileTypes?.join(', ') ?? t('label.file'),
  }),
  unreadable: t('message.credential-file-unreadable'),
});
