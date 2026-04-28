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

import { Trash01, UploadCloud01 } from '@untitledui/icons';
import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@/components/base/box/box';
import { Button } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';

export type CoverImageUploadValue =
  | { file: File }
  | { url: string }
  | null
  | undefined;

export interface CoverImageUploadRenderPreviewContext {
  src: string;
  value: { file: File } | { url: string };
  onChange: (next: CoverImageUploadValue) => void;
  onReplace: () => void;
  onRemove: () => void;
}

export interface CoverImageUploadFieldProps {
  value: CoverImageUploadValue;
  onChange: (next: CoverImageUploadValue) => void;
  onBlur?: () => void;
  acceptedFileTypes?: string[];
  acceptDirectory?: boolean;
  defaultCamera?: 'environment' | 'user';
  isInvalid?: boolean;
  ariaLabel?: string;
  placeholder?: ReactNode;
  previewClassName?: string;
  renderPreview?: (ctx: CoverImageUploadRenderPreviewContext) => ReactNode;
  'data-testid'?: string;
}

const hasFile = (value: CoverImageUploadValue): value is { file: File } =>
  Boolean(value && typeof value === 'object' && 'file' in value && value.file);

const hasUrl = (value: CoverImageUploadValue): value is { url: string } =>
  Boolean(value && typeof value === 'object' && 'url' in value && value.url);

export const CoverImageUploadField = ({
  value,
  onChange,
  onBlur,
  acceptedFileTypes,
  acceptDirectory,
  defaultCamera,
  isInvalid,
  ariaLabel,
  placeholder,
  previewClassName,
  renderPreview,
  'data-testid': dataTestId,
}: CoverImageUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [imageError, setImageError] = useState(false);

  const previewSrc = useMemo(() => {
    if (hasFile(value)) {
      return URL.createObjectURL(value.file);
    }

    if (hasUrl(value)) {
      return value.url;
    }

    return '';
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewSrc.startsWith('blob:')) {
        URL.revokeObjectURL(previewSrc);
      }
    };
  }, [previewSrc]);

  useEffect(() => {
    setImageError(false);
  }, [previewSrc]);

  const openFilePicker = () => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.value = '';
    inputRef.current.click();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    onChange({ file: files[0] });
  };

  const handleRemove = () => {
    onChange(null);
  };

  const isFilled = hasFile(value) || hasUrl(value);
  const showDefaultPreview = isFilled && Boolean(previewSrc) && !imageError;

  return (
    <Box
      data-testid={dataTestId}
      direction="col"
      gap={2}
      onBlur={onBlur}>
      <input
        accept={acceptedFileTypes?.join(',')}
        capture={defaultCamera}
        ref={inputRef}
        style={{ display: 'none' }}
        type="file"
        // @ts-expect-error - webkitdirectory is a non-standard HTML attribute not in React's type definitions
        webkitdirectory={acceptDirectory ? '' : undefined}
        onChange={handleInputChange}
      />

      {isFilled && renderPreview
        ? renderPreview({
            src: previewSrc,
            value: value as { file: File } | { url: string },
            onChange,
            onReplace: openFilePicker,
            onRemove: handleRemove,
          })
        : showDefaultPreview
        ? (
            <div
              aria-invalid={isInvalid || undefined}
              className={cx(
                'tw:group tw:relative tw:w-full tw:overflow-hidden tw:rounded-lg tw:ring-1 tw:ring-secondary',
                isInvalid && 'tw:ring-2 tw:ring-error',
                previewClassName
              )}
              data-testid="cover-image-upload-preview-container">
              <img
                alt={ariaLabel ?? 'Cover image preview'}
                className="tw:block tw:h-auto tw:max-h-64 tw:w-full tw:object-cover"
                data-testid="cover-image-upload-preview"
                src={previewSrc}
                onError={() => setImageError(true)}
              />

              <div className="tw:absolute tw:inset-x-0 tw:bottom-0 tw:flex tw:items-center tw:justify-end tw:gap-2 tw:bg-gradient-to-t tw:from-black/60 tw:to-transparent tw:p-3 tw:opacity-0 tw:transition tw:duration-150 tw:group-hover:opacity-100 tw:group-focus-within:opacity-100">
                <Button
                  color="secondary"
                  data-testid="cover-image-upload-replace"
                  iconLeading={UploadCloud01}
                  size="sm"
                  onPress={openFilePicker}>
                  Replace
                </Button>
                <Button
                  aria-label="Remove cover image"
                  color="secondary-destructive"
                  data-testid="cover-image-upload-remove"
                  iconLeading={Trash01}
                  size="sm"
                  onPress={handleRemove}
                />
              </div>
            </div>
          )
        : (
            <Button
              color="secondary"
              data-testid="cover-image-upload-empty-trigger"
              iconLeading={UploadCloud01}
              size="sm"
              onPress={openFilePicker}>
              {typeof placeholder === 'string' ? placeholder : 'Upload image'}
            </Button>
          )}
    </Box>
  );
};

CoverImageUploadField.displayName = 'CoverImageUploadField';
