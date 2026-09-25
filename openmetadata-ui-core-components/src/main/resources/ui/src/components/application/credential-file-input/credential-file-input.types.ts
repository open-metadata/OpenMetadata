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

import type { ReactNode } from 'react';

/** Why a chosen file was rejected. The field value is never touched on rejection. */
export type CredentialFileErrorKind =
  | 'unacceptedType'
  | 'sizeLimit'
  | 'binary'
  | 'unreadable';

export interface CredentialFileInputLabels {
  clickToUpload?: string;
  orDragAndDrop?: string;
  /** Divider between the drop zone and the manual-input textarea. */
  or?: string;
  /** Accessible name of the manual-input textarea. */
  manualInput?: string;
  remove?: string;
  /** Title of the row standing for a credential already stored server-side. */
  savedValue?: string;
  /** Secondary line on that row, explaining why no file name is shown. */
  savedValueHint?: string;
  /** Drop-zone hint. Receives the accepted extensions and the readable size cap. */
  formatHint?: (acceptedTypes: string, maxSize: string) => string;
}

export type CredentialFileValidationMessages = Partial<
  Record<CredentialFileErrorKind, string>
>;

/** A credential attached in this session, which therefore has provenance to show. */
export interface SelectedFile {
  name: string;
  size?: number;
}

export interface CredentialFileInputProps {
  /** The credential content itself — this is the value submitted with the form. */
  value?: string;
  /** Called with the file's text content, or `undefined` when the value is cleared. */
  onChange?: (value: string | undefined) => void;
  /**
   * Whether the credential may also be typed or pasted directly.
   *
   * Mirrors the schema contract: `uiFieldType: 'fileOrInput'` passes `true`;
   * `uiFieldType: 'file'` passes `false` and the value becomes upload-only.
   */
  allowManualInput?: boolean;
  /**
   * A credential is already stored for this field, but its value is not
   * readable — the API returns a mask rather than the secret.
   *
   * The field then stands for it with a chip instead of showing an empty drop
   * zone, so the state is visible and removable. Without this the control would
   * claim nothing is set, and there would be no way to clear what is.
   */
  hasStoredValue?: boolean;
  /** Accepted file extensions, e.g. `['.pem', '.key']`. */
  acceptedFileTypes?: string[];
  /** Maximum accepted file size in bytes. @default DEFAULT_CREDENTIAL_FILE_MAX_SIZE */
  maxSize?: number;
  label?: string;
  /** Helper text under the control. The active validation error replaces it. */
  hint?: ReactNode;
  /** Placeholder for the manual-input textarea. */
  placeholder?: string;
  id?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  /** Visible rows of the manual-input textarea. @default 6 */
  rows?: number;
  className?: string;
  labels?: CredentialFileInputLabels;
  validationMessages?: CredentialFileValidationMessages;
  /** Fired on rejection so the host form can surface the failure too. */
  onValidationError?: (message: string, kind: CredentialFileErrorKind) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  'data-testid'?: string;
}
