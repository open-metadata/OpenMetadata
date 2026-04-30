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
 *
 *  Portions of this file are derived from UntitledUI's open-source React
 *  components, licensed under MIT.
 *  Source: https://github.com/untitleduico/react/blob/main/components/application/file-upload/file-upload-base.tsx
 */

import { UploadCloud02 } from '@untitledui/icons';
import type { DragEvent, ChangeEvent } from 'react';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import { cx } from '@/utils/cx';

export const getReadableFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return '0 KB';
  }

  const suffixes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${Math.floor(bytes / Math.pow(1024, i))} ${suffixes[i]}`;
};

export interface FileUploadDropZoneProps {
  className?: string;
  hint?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  accept?: string;
  allowsMultiple?: boolean;
  maxSize?: number;
  clickToUploadLabel?: string;
  orDragAndDropLabel?: string;
  'data-testid'?: string;
  onDropFiles?: (files: FileList) => void;
  onDropUnacceptedFiles?: (files: FileList) => void;
  onSizeLimitExceed?: (files: FileList) => void;
}

const isFileTypeAccepted = (file: File, accept?: string): boolean => {
  if (!accept) {
    return true;
  }

  const acceptedTypes = accept.split(',').map((type) => type.trim());

  return acceptedTypes.some((acceptedType) => {
    if (acceptedType.startsWith('.')) {
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;

      return extension === acceptedType.toLowerCase();
    }

    if (acceptedType.endsWith('/*')) {
      const typePrefix = acceptedType.split('/')[0];

      return file.type.startsWith(`${typePrefix}/`);
    }

    return file.type === acceptedType;
  });
};

const filesToFileList = (files: File[]): FileList => {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));

  return dataTransfer.files;
};

export const FileUploadDropZone = ({
  className,
  hint,
  isDisabled,
  isInvalid: isInvalidProp,
  accept,
  allowsMultiple = true,
  maxSize,
  clickToUploadLabel = 'Click to upload',
  orDragAndDropLabel = 'or drag and drop',
  'data-testid': dataTestId,
  onDropFiles,
  onDropUnacceptedFiles,
  onSizeLimitExceed,
}: FileUploadDropZoneProps) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isInternalInvalid, setIsInternalInvalid] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const isInvalid = isInvalidProp ?? isInternalInvalid;

  const handleDragIn = (event: DragEvent<HTMLDivElement>) => {
    if (isDisabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragOut = (event: DragEvent<HTMLDivElement>) => {
    if (isDisabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const processFiles = (files: File[]): void => {
    setIsInternalInvalid(false);

    const acceptedFiles: File[] = [];
    const unacceptedFiles: File[] = [];
    const oversizedFiles: File[] = [];

    const filesToProcess = allowsMultiple ? files : files.slice(0, 1);

    filesToProcess.forEach((file) => {
      if (maxSize && file.size > maxSize) {
        oversizedFiles.push(file);

        return;
      }

      if (isFileTypeAccepted(file, accept)) {
        acceptedFiles.push(file);
      } else {
        unacceptedFiles.push(file);
      }
    });

    if (oversizedFiles.length > 0 && typeof onSizeLimitExceed === 'function') {
      setIsInternalInvalid(true);
      onSizeLimitExceed(filesToFileList(oversizedFiles));
    }

    if (acceptedFiles.length > 0 && typeof onDropFiles === 'function') {
      onDropFiles(filesToFileList(acceptedFiles));
    }

    if (
      unacceptedFiles.length > 0 &&
      typeof onDropUnacceptedFiles === 'function'
    ) {
      setIsInternalInvalid(true);
      onDropUnacceptedFiles(filesToFileList(unacceptedFiles));
    }

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (isDisabled) {
      return;
    }

    handleDragOut(event);
    processFiles(Array.from(event.dataTransfer.files));
  };

  const handleInputFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(event.target.files || []));
  };

  return (
    <div
      data-dropzone
      className={cx(
        'tw:relative tw:flex tw:flex-col tw:items-center tw:gap-3 tw:rounded-xl tw:bg-primary tw:px-6 tw:py-4 tw:text-tertiary tw:ring-1 tw:ring-secondary tw:transition tw:duration-100 tw:ease-linear tw:ring-inset',
        isDraggingOver && 'tw:ring-2 tw:ring-brand',
        isDisabled && 'tw:cursor-not-allowed tw:bg-secondary',
        className
      )}
      data-testid={dataTestId}
      onDragEnd={handleDragOut}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDragIn}
      onDrop={handleDrop}>
      <FeaturedIcon
        className={cx(isDisabled && 'tw:opacity-50')}
        color="gray"
        icon={UploadCloud02}
        size="md"
        theme="modern"
      />

      <div className="tw:flex tw:flex-col tw:gap-1 tw:text-center">
        <div className="tw:flex tw:justify-center tw:gap-1 tw:text-center">
          <input
            accept={accept}
            className="tw:peer tw:sr-only"
            disabled={isDisabled}
            id={id}
            multiple={allowsMultiple}
            ref={inputRef}
            type="file"
            onChange={handleInputFileChange}
          />
          <label className="tw:flex tw:cursor-pointer" htmlFor={id}>
            <Button
              color="link-color"
              isDisabled={isDisabled}
              size="md"
              onClick={() => inputRef.current?.click()}>
              {clickToUploadLabel}
            </Button>
          </label>
          <span className="tw:text-sm">{orDragAndDropLabel}</span>
        </div>
        {hint && (
          <p
            className={cx(
              'tw:text-xs tw:transition tw:duration-100 tw:ease-linear',
              isInvalid && 'tw:text-error-primary'
            )}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
};

FileUploadDropZone.displayName = 'FileUploadDropZone';
