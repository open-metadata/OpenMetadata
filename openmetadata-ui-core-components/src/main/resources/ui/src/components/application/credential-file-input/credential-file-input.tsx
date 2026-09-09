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

import { Trash01 } from '@untitledui/icons';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Box } from '@/components/base/box/box';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Divider } from '@/components/base/divider/divider';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { PasswordInput } from '@/components/base/input/password-input';
import { cx } from '@/utils/cx';
import type { FileIconProps } from '../file-upload/file-upload';
import {
  FileIcon,
  FileUploadDropZone,
  getReadableFileSize,
} from '../file-upload/file-upload';

/**
 * Ceiling for a credential file, in bytes.
 *
 * Credential material — PEM keys, X.509 certificates, GCP service-account JSON —
 * is measured in kilobytes. 1 MiB sits far above any legitimate payload while
 * staying small enough that reading it into memory and carrying it inside the
 * connection document costs nothing.
 */
export const DEFAULT_CREDENTIAL_FILE_MAX_SIZE = 1024 * 1024;

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
  /** Chip name for a credential that is already stored server-side. */
  savedValue?: string;
  /** Drop-zone hint. Receives the accepted extensions and the readable size cap. */
  formatHint?: (acceptedTypes: string, maxSize: string) => string;
}

export type CredentialFileValidationMessages = Partial<
  Record<CredentialFileErrorKind, string>
>;

const DEFAULT_LABELS: Required<CredentialFileInputLabels> = {
  clickToUpload: 'Click to upload',
  orDragAndDrop: 'or drag and drop',
  or: 'or',
  manualInput: 'Enter file content',
  remove: 'Remove',
  savedValue: 'Saved credential',
  formatHint: (acceptedTypes, maxSize) =>
    acceptedTypes ? `${acceptedTypes} (max. ${maxSize})` : `max. ${maxSize}`,
};

const DEFAULT_VALIDATION_MESSAGES: Required<CredentialFileValidationMessages> =
  {
    unacceptedType: 'That file type is not accepted',
    sizeLimit: 'That file exceeds the size limit',
    binary:
      'That file is not UTF-8 text. Upload the PEM or JSON text form of the credential',
    unreadable: 'That file could not be read',
  };

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

interface SelectedFile {
  name: string;
  size?: number;
}

const getFileIconType = (name: string): FileIconProps['type'] => {
  const parts = name.split('.');
  const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;

  return (extension || 'empty') as FileIconProps['type'];
};

/** Thrown when a file decodes to something other than UTF-8 text. */
class NonTextCredentialError extends Error {}

const decodeCredentialText = (buffer: ArrayBuffer): string => {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new NonTextCredentialError('Credential file is not UTF-8 text');
  }

  if (text.includes('\u0000')) {
    throw new NonTextCredentialError('Credential file contains NUL bytes');
  }

  return text;
};

/**
 * Read a credential file as UTF-8 text.
 *
 * The bytes are decoded strictly rather than through `File.text()`, which is
 * lenient: a DER or PKCS#12 payload comes back as replacement characters rather
 * than an error, and that mojibake would be saved as the secret only to fail
 * much later at connection time. `fatal: true` turns it into a rejection here
 * instead, and the NUL scan catches a binary payload that decodes cleanly.
 *
 * `FileReader` rather than `Blob.arrayBuffer()` because jsdom implements the
 * former and not the latter, and this path has to stay reachable from tests.
 */
const readCredentialText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.onload = () => {
      try {
        resolve(decodeCredentialText(reader.result as ArrayBuffer));
      } catch (error) {
        reject(error);
      }
    };

    reader.readAsArrayBuffer(file);
  });

const SelectedFileChip = ({
  file,
  isDisabled,
  removeLabel,
  onRemove,
}: {
  file: SelectedFile;
  isDisabled?: boolean;
  removeLabel: string;
  onRemove: () => void;
}) => (
  <Box
    align="center"
    className={cx(
      // Border drawn with outline, not a ring: WebKit does not pixel-snap
      // box-shadow, so a ring thins/vanishes in Safari when zoomed out.
      'tw:w-full tw:rounded-xl tw:bg-primary tw:p-4',
      'tw:outline-1 tw:-outline-offset-1 tw:outline-secondary'
    )}
    data-testid="credential-file-chip"
    gap={3}>
    <FileIcon
      className="tw:size-10 tw:shrink-0 dark:tw:hidden"
      theme="light"
      type={getFileIconType(file.name)}
      variant="default"
    />
    <FileIcon
      className="tw:size-10 tw:shrink-0 tw:not-dark:hidden"
      theme="dark"
      type={getFileIconType(file.name)}
      variant="default"
    />

    <div className="tw:min-w-0 tw:flex-1">
      <p
        className="tw:truncate tw:text-sm tw:font-medium tw:text-secondary"
        data-testid="credential-file-name">
        {file.name}
      </p>
      {typeof file.size === 'number' && (
        <p className="tw:text-sm tw:text-tertiary">
          {getReadableFileSize(file.size)}
        </p>
      )}
    </div>

    <ButtonUtility
      color="tertiary"
      data-testid="credential-file-remove"
      icon={Trash01}
      isDisabled={isDisabled}
      size="xs"
      tooltip={removeLabel}
      onClick={onRemove}
    />
  </Box>
);

/**
 * The single credential-file input behind every schema-annotated secret field.
 *
 * A `format: password` string annotated `uiFieldType: file | fileOrInput` takes
 * its content from a local file — picker, keyboard, or drag-and-drop — and
 * submits that content as the field value. Nothing is uploaded anywhere: the
 * file is read in the browser and its text becomes the secret, so the value
 * keeps the masking and secrets-manager handling every other password field
 * gets.
 */
export const CredentialFileInput = ({
  value,
  onChange,
  allowManualInput = false,
  hasStoredValue = false,
  acceptedFileTypes,
  maxSize = DEFAULT_CREDENTIAL_FILE_MAX_SIZE,
  label,
  hint,
  placeholder,
  id,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  rows = 6,
  className,
  labels,
  validationMessages,
  onValidationError,
  onBlur,
  onFocus,
  'data-testid': dataTestId,
}: CredentialFileInputProps) => {
  const [fileMeta, setFileMeta] = useState<SelectedFile | null>(null);
  const [errorKind, setErrorKind] = useState<CredentialFileErrorKind | null>(
    null
  );

  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const hasValue = typeof value === 'string' && value.length > 0;
  const isInteractionDisabled = isDisabled || isReadOnly;

  // A value cleared from outside (form reset, oneOf branch switch) must not
  // leave the chip behind still claiming a file is attached.
  useEffect(() => {
    if (!hasValue) {
      setFileMeta(null);
    }
  }, [hasValue]);

  // A stored credential is shown by its chip in both modes: `hasValue` covers a
  // value this form already holds, `hasStoredValue` the masked one it cannot read.
  const standsForStoredCredential =
    hasStoredValue || (hasValue && !allowManualInput);
  const selectedFile: SelectedFile | null =
    fileMeta ??
    (standsForStoredCredential ? { name: mergedLabels.savedValue } : null);

  const reject = (kind: CredentialFileErrorKind) => {
    setErrorKind(kind);
    onValidationError?.(
      validationMessages?.[kind] ?? DEFAULT_VALIDATION_MESSAGES[kind],
      kind
    );
  };

  const handleDropFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) {
      return;
    }

    setErrorKind(null);

    try {
      const content = await readCredentialText(file);
      setFileMeta({ name: file.name, size: file.size });
      onChange?.(content);
    } catch (error) {
      reject(error instanceof NonTextCredentialError ? 'binary' : 'unreadable');
    }
  };

  const handleRemove = () => {
    setFileMeta(null);
    setErrorKind(null);
    onChange?.(undefined);
  };

  const handleManualChange = (nextValue: string) => {
    setErrorKind(null);
    onChange?.(nextValue === '' ? undefined : nextValue);
  };

  const errorMessage = errorKind
    ? validationMessages?.[errorKind] ?? DEFAULT_VALIDATION_MESSAGES[errorKind]
    : undefined;
  const showAsInvalid = Boolean(isInvalid) || errorKind !== null;

  return (
    <Box
      className={cx('tw:w-full', className)}
      data-testid={dataTestId}
      direction="col"
      gap={2}>
      {label && <Label isRequired={isRequired}>{label}</Label>}

      {selectedFile ? (
        <SelectedFileChip
          file={selectedFile}
          isDisabled={isInteractionDisabled}
          removeLabel={mergedLabels.remove}
          onRemove={handleRemove}
        />
      ) : (
        <FileUploadDropZone
          accept={acceptedFileTypes?.join(',')}
          allowsMultiple={false}
          className="tw:w-full"
          clickToUploadLabel={mergedLabels.clickToUpload}
          data-testid="credential-file-dropzone"
          hint={mergedLabels.formatHint(
            acceptedFileTypes?.join(', ') ?? '',
            getReadableFileSize(maxSize)
          )}
          input-data-testid="credential-file-input"
          isDisabled={isInteractionDisabled}
          isInvalid={showAsInvalid}
          maxSize={maxSize}
          orDragAndDropLabel={mergedLabels.orDragAndDrop}
          onDropFiles={handleDropFiles}
          onDropUnacceptedFiles={() => reject('unacceptedType')}
          onSizeLimitExceed={() => reject('sizeLimit')}
        />
      )}

      {/*
        The drop zone and the textarea are two ways to supply one value, so only
        one is offered at a time. Once a file is attached its chip stands for the
        credential; showing the textarea too would render the same secret twice
        with an "or" between them, implying a choice that no longer exists.
        Removing the chip brings the choice back.
      */}
      {allowManualInput && !selectedFile && (
        <>
          <Divider label={mergedLabels.or} labelAlign="center" />
          <PasswordInput
            multiline
            aria-label={mergedLabels.manualInput}
            id={id}
            isDisabled={isDisabled}
            isInvalid={showAsInvalid}
            isReadOnly={isReadOnly}
            isRequired={isRequired}
            placeholder={placeholder}
            rows={rows}
            value={value ?? ''}
            onBlur={onBlur}
            onChange={handleManualChange}
            onFocus={onFocus}
          />
        </>
      )}

      {(errorMessage || hint) && (
        <HintText
          isInvalid={showAsInvalid}
          role={errorMessage ? 'alert' : undefined}>
          {errorMessage ?? hint}
        </HintText>
      )}
    </Box>
  );
};

CredentialFileInput.displayName = 'CredentialFileInput';
