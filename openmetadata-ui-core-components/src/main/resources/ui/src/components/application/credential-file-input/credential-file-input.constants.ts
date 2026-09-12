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

import { cx } from '@/utils/cx';
import type {
  CredentialFileInputLabels,
  CredentialFileValidationMessages,
} from './credential-file-input.types';

/**
 * Ceiling for a credential file, in bytes.
 *
 * Credential material — PEM keys, X.509 certificates, GCP service-account JSON —
 * is measured in kilobytes. 1 MiB sits far above any legitimate payload while
 * staying small enough that reading it into memory and carrying it inside the
 * connection document costs nothing.
 */
export const DEFAULT_CREDENTIAL_FILE_MAX_SIZE = 1024 * 1024;

export const DEFAULT_LABELS: Required<CredentialFileInputLabels> = {
  clickToUpload: 'Click to upload',
  orDragAndDrop: 'or drag and drop',
  or: 'or',
  manualInput: 'Enter file content',
  remove: 'Remove',
  savedValue: 'Saved credential',
  savedValueHint:
    'Hidden for security. Remove it to upload or paste a new one.',
  formatHint: (acceptedTypes, maxSize) =>
    acceptedTypes ? `${acceptedTypes} (max. ${maxSize})` : `max. ${maxSize}`,
};

export const DEFAULT_VALIDATION_MESSAGES: Required<CredentialFileValidationMessages> =
  {
    unacceptedType: 'That file type is not accepted',
    sizeLimit: 'That file exceeds the size limit',
    binary:
      'That file is not UTF-8 text. Upload the PEM or JSON text form of the credential',
    unreadable: 'That file could not be read',
  };

export const CREDENTIAL_ROW_CLASS = cx(
  // Border drawn with outline, not a ring: WebKit does not pixel-snap
  // box-shadow, so a ring thins/vanishes in Safari when zoomed out.
  'tw:w-full tw:rounded-xl tw:bg-primary tw:p-4',
  'tw:outline-1 tw:-outline-offset-1 tw:outline-secondary'
);
