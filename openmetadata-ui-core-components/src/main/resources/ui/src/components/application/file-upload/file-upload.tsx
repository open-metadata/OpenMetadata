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

import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import { cx } from '@/utils/cx';
import {
  CheckCircle,
  Trash01,
  UploadCloud02,
  XCircle,
} from '@untitledui/icons';
import type {
  ChangeEvent,
  ComponentPropsWithRef,
  DragEvent,
} from 'react';
import { useId, useRef, useState } from 'react';

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

export interface FileListItemProps {
  name: string;
  size: number;
  progress: number;
  failed?: boolean;
  className?: string;
  onDelete?: () => void;
  onRetry?: () => void;
}

export const FileListItemProgressBar = ({
  className,
  failed,
  name,
  onDelete,
  onRetry,
  progress,
  size,
}: FileListItemProps) => {
  const isComplete = progress === 100;

  return (
    <li
      className={cx(
        'tw:relative tw:flex tw:gap-3 tw:rounded-xl tw:bg-primary tw:p-4 tw:ring-1 tw:ring-secondary tw:transition-shadow tw:duration-100 tw:ease-linear tw:ring-inset',
        failed && 'tw:ring-2 tw:ring-error',
        className
      )}>
      <div className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-secondary">
        <UploadCloud02 className="tw:size-5 tw:text-tertiary" strokeWidth={1.5} />
      </div>

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:items-start">
        <div className="tw:flex tw:w-full tw:min-w-0 tw:max-w-full tw:flex-1">
          <div className="tw:min-w-0 tw:flex-1">
            <p className="tw:truncate tw:text-sm tw:font-medium tw:text-secondary">
              {name}
            </p>
            <div className="tw:mt-0.5 tw:flex tw:items-center tw:gap-2">
              <p className="tw:truncate tw:whitespace-nowrap tw:text-sm tw:text-tertiary">
                {getReadableFileSize(size)}
              </p>
              <hr className="tw:h-3 tw:w-px tw:rounded-full tw:border-none tw:bg-border-primary" />
              <div className="tw:flex tw:items-center tw:gap-1">
                {isComplete && !failed && (
                  <>
                    <CheckCircle className="tw:size-4 tw:stroke-[2.5px] tw:text-fg-success-primary" />
                    <p className="tw:text-sm tw:font-medium tw:text-success-primary">
                      Complete
                    </p>
                  </>
                )}
                {!isComplete && !failed && (
                  <>
                    <UploadCloud02 className="tw:size-4 tw:stroke-[2.5px] tw:text-fg-quaternary" />
                    <p className="tw:text-sm tw:font-medium tw:text-quaternary">
                      Uploading...
                    </p>
                  </>
                )}
                {failed && (
                  <>
                    <XCircle className="tw:size-4 tw:text-fg-error-primary" />
                    <p className="tw:text-sm tw:font-medium tw:text-error-primary">
                      Failed
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <ButtonUtility
            className="tw:-mr-2 tw:-mt-2 tw:self-start"
            color="tertiary"
            icon={Trash01}
            size="xs"
            tooltip="Delete"
            onClick={onDelete}
          />
        </div>

        {!failed && (
          <div className="tw:mt-1 tw:w-full">
            <ProgressBar
              labelPosition="right"
              max={100}
              min={0}
              value={progress}
            />
          </div>
        )}

        {failed && (
          <Button
            className="tw:mt-1.5"
            color="link-destructive"
            size="sm"
            onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </li>
  );
};

export const FileListItemProgressFill = ({
  className,
  failed,
  name,
  onDelete,
  onRetry,
  progress,
  size,
}: FileListItemProps) => {
  const isComplete = progress === 100;

  return (
    <li
      className={cx(
        'tw:relative tw:flex tw:gap-3 tw:overflow-hidden tw:rounded-xl tw:bg-primary tw:p-4',
        className
      )}>
      <div
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className={cx(
          'tw:absolute tw:inset-0 tw:size-full tw:bg-secondary tw:transition tw:duration-75 tw:ease-linear',
          isComplete && 'tw:opacity-0'
        )}
        role="progressbar"
        style={{ transform: `translateX(-${100 - progress}%)` }}
      />
      <div
        className={cx(
          'tw:absolute tw:inset-0 tw:size-full tw:rounded-[inherit] tw:ring-1 tw:ring-secondary tw:transition tw:duration-100 tw:ease-linear tw:ring-inset',
          failed && 'tw:ring-2 tw:ring-error'
        )}
      />
      <div className="tw:relative tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-secondary">
        <UploadCloud02 className="tw:size-5 tw:text-tertiary" strokeWidth={1.5} />
      </div>

      <div className="tw:relative tw:flex tw:min-w-0 tw:flex-1">
        <div className="tw:relative tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:items-start">
          <div className="tw:w-full tw:min-w-0 tw:flex-1">
            <p className="tw:truncate tw:text-sm tw:font-medium tw:text-secondary">
              {name}
            </p>
            <div className="tw:mt-0.5 tw:flex tw:items-center tw:gap-2">
              <p className="tw:text-sm tw:text-tertiary">
                {failed
                  ? 'Upload failed, please try again'
                  : getReadableFileSize(size)}
              </p>
              {!failed && (
                <>
                  <hr className="tw:h-3 tw:w-px tw:rounded-full tw:border-none tw:bg-border-primary" />
                  <div className="tw:flex tw:items-center tw:gap-1">
                    {isComplete ? (
                      <CheckCircle className="tw:size-4 tw:stroke-[2.5px] tw:text-fg-success-primary" />
                    ) : (
                      <UploadCloud02 className="tw:size-4 tw:stroke-[2.5px] tw:text-fg-quaternary" />
                    )}
                    <p className="tw:text-sm tw:text-tertiary">{progress}%</p>
                  </div>
                </>
              )}
            </div>
          </div>
          {failed && (
            <Button
              className="tw:mt-1.5"
              color="link-destructive"
              size="sm"
              onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
        <ButtonUtility
          className="tw:-mr-2 tw:-mt-2 tw:self-start"
          color="tertiary"
          icon={Trash01}
          size="xs"
          tooltip="Delete"
          onClick={onDelete}
        />
      </div>
    </li>
  );
};

const FileUploadRoot = (props: ComponentPropsWithRef<'div'>) => (
  <div
    {...props}
    className={cx('tw:flex tw:flex-col tw:gap-4', props.className)}
  />
);

const FileUploadList = (props: ComponentPropsWithRef<'ul'>) => (
  <ul {...props} className={cx('tw:flex tw:flex-col tw:gap-3', props.className)} />
);

export const FileUpload = {
  DropZone: FileUploadDropZone,
  List: FileUploadList,
  ListItemProgressBar: FileListItemProgressBar,
  ListItemProgressFill: FileListItemProgressFill,
  Root: FileUploadRoot,
};
