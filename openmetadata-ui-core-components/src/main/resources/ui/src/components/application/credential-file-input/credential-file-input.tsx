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

import { Key01, Trash01 } from '@untitledui/icons';
import { useEffect, useState } from 'react';
import { Box } from '@/components/base/box/box';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Divider } from '@/components/base/divider/divider';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { PasswordInput } from '@/components/base/input/password-input';
import { cx } from '@/utils/cx';
import {
  FileIcon,
  FileUploadDropZone,
  getReadableFileSize,
} from '../file-upload/file-upload';
import {
  CREDENTIAL_ROW_CLASS,
  DEFAULT_CREDENTIAL_FILE_MAX_SIZE,
  DEFAULT_LABELS,
  DEFAULT_VALIDATION_MESSAGES,
} from './credential-file-input.constants';
import type {
  CredentialFileErrorKind,
  CredentialFileInputProps,
  SelectedFile,
} from './credential-file-input.types';
import {
  getFileIconType,
  NonTextCredentialError,
  readCredentialText,
} from './credential-file-input.utils';

/**
 * Stands for a credential the form cannot read — the API returns a mask, so
 * there is no file name and no size to show.
 *
 * Deliberately not the file chip: a file icon above an invented name reads as
 * "you attached a file called Saved credential", which is not what happened.
 */
const StoredCredentialRow = ({
  isDisabled,
  removeLabel,
  title,
  hint,
  onRemove,
}: {
  isDisabled?: boolean;
  removeLabel: string;
  title: string;
  hint: string;
  onRemove: () => void;
}) => (
  <Box
    align="center"
    className={CREDENTIAL_ROW_CLASS}
    data-testid="credential-stored-value"
    gap={3}>
    <Key01 className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />

    <div className="tw:min-w-0 tw:flex-1">
      <p className="tw:truncate tw:text-sm tw:font-medium tw:text-secondary">
        {title}
      </p>
      <p className="tw:text-sm tw:text-tertiary">{hint}</p>
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
    className={CREDENTIAL_ROW_CLASS}
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

  // Only a file attached in this session has a name to show. A masked value, or
  // one restored into an upload-only field, is a credential without provenance —
  // it gets the stored row instead of a chip wearing an invented file name.
  const standsForStoredCredential =
    !fileMeta && (hasStoredValue || (hasValue && !allowManualInput));
  const hasCredential = Boolean(fileMeta) || standsForStoredCredential;

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

      {fileMeta && (
        <SelectedFileChip
          file={fileMeta}
          isDisabled={isInteractionDisabled}
          removeLabel={mergedLabels.remove}
          onRemove={handleRemove}
        />
      )}

      {standsForStoredCredential && (
        <StoredCredentialRow
          hint={mergedLabels.savedValueHint}
          isDisabled={isInteractionDisabled}
          removeLabel={mergedLabels.remove}
          title={mergedLabels.savedValue}
          onRemove={handleRemove}
        />
      )}

      {!hasCredential && (
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
      {allowManualInput && !hasCredential && (
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
