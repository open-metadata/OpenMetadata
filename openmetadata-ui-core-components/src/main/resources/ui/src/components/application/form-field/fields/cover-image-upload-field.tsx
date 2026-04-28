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

import { RefreshCcw01, Trash01, UploadCloud01 } from '@untitledui/icons';
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  TouchEvent as ReactTouchEvent,
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@/components/base/box/box';
import { Button } from '@/components/base/buttons/button';
import { Typography } from '@/components/foundations/typography';
import { cx } from '@/utils/cx';
import { FileUploadDropZone } from '../../file-upload/file-upload';

export type CoverImagePosition = { y: string };

export type CoverImageUploadValue =
  | { file: File; position?: CoverImagePosition }
  | { url: string; position?: CoverImagePosition }
  | null
  | undefined;

export interface CoverImageUploadRenderPreviewContext {
  src: string;
  value:
    | { file: File; position?: CoverImagePosition }
    | { url: string; position?: CoverImagePosition };
  onChange: (next: CoverImageUploadValue) => void;
  onReplace: () => void;
  onRemove: () => void;
}

export interface CoverImageUploadValidationMessages {
  sizeExceeded?: (maxSizeMB: number) => string;
  dimensionsExceeded?: (maxWidth: number, maxHeight: number) => string;
  failedToLoad?: string;
}

export interface CoverImageUploadLabels {
  clickToUpload?: string;
  orDragAndDrop?: string;
  formatHint?: (formats: string, maxSizeMB?: number) => string;
  replace?: string;
  remove?: string;
  reposition?: string;
  savePosition?: string;
  cancel?: string;
  resetPosition?: string;
  dragHint?: string;
  imageTooSmallToReposition?: string;
}

export interface CoverImageUploadFieldProps {
  value: CoverImageUploadValue;
  onChange: (next: CoverImageUploadValue) => void;
  onBlur?: () => void;
  acceptedFileTypes?: string[];
  isInvalid?: boolean;
  ariaLabel?: string;
  placeholder?: ReactNode;
  previewClassName?: string;
  previewHeight?: number;
  maxSizeMB?: number;
  maxDimensions?: { width: number; height: number };
  validationMessages?: CoverImageUploadValidationMessages;
  onValidationError?: (message: string) => void;
  repositionable?: boolean;
  labels?: CoverImageUploadLabels;
  renderPreview?: (ctx: CoverImageUploadRenderPreviewContext) => ReactNode;
  'data-testid'?: string;
}

const DEFAULT_LABELS: Required<
  Omit<CoverImageUploadLabels, 'formatHint'>
> & { formatHint: NonNullable<CoverImageUploadLabels['formatHint']> } = {
  clickToUpload: 'Click to upload',
  orDragAndDrop: 'or drag and drop',
  formatHint: (formats, maxSizeMB) =>
    maxSizeMB
      ? `${formats} (max. ${maxSizeMB}MB)`
      : formats || 'SVG, PNG, JPG or GIF',
  replace: 'Replace',
  remove: 'Remove cover image',
  reposition: 'Reposition',
  savePosition: 'Save position',
  cancel: 'Cancel',
  resetPosition: 'Reset position',
  dragHint: 'Drag to adjust position',
  imageTooSmallToReposition:
    'Image is too small to be repositioned within the preview area',
};

const DEFAULT_VALIDATION_MESSAGES: Required<CoverImageUploadValidationMessages> =
  {
    sizeExceeded: (maxSizeMB) => `File exceeds the ${maxSizeMB}MB size limit`,
    dimensionsExceeded: (maxWidth, maxHeight) =>
      `Image dimensions exceed the ${maxWidth}x${maxHeight} pixel limit`,
    failedToLoad: 'Failed to load image',
  };

const DEFAULT_PREVIEW_HEIGHT = 160;

const hasFile = (
  value: CoverImageUploadValue
): value is { file: File; position?: CoverImagePosition } =>
  Boolean(value && typeof value === 'object' && 'file' in value && value.file);

const hasUrl = (
  value: CoverImageUploadValue
): value is { url: string; position?: CoverImagePosition } =>
  Boolean(value && typeof value === 'object' && 'url' in value && value.url);

const formatAcceptedTypes = (types: string[] | undefined): string => {
  if (!types || types.length === 0) {
    return '';
  }

  return types
    .map((mime) => {
      const parts = mime.split('/');

      return (parts[1] ?? mime).toUpperCase();
    })
    .join(', ');
};

const measureImage = (
  file: File
): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('failed to load image'));
    };

    img.src = url;
  });

export const CoverImageUploadField = ({
  value,
  onChange,
  onBlur,
  acceptedFileTypes,
  isInvalid,
  ariaLabel,
  placeholder,
  previewClassName,
  previewHeight = DEFAULT_PREVIEW_HEIGHT,
  maxSizeMB,
  maxDimensions,
  validationMessages,
  onValidationError,
  repositionable = true,
  labels,
  renderPreview,
  'data-testid': dataTestId,
}: CoverImageUploadFieldProps) => {
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const dragStartYRef = useRef(0);
  const dragStartOffsetRef = useRef(0);

  const [imageError, setImageError] = useState(false);
  const [imageNaturalHeight, setImageNaturalHeight] = useState(0);
  const [imageNaturalWidth, setImageNaturalWidth] = useState(0);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [isRepositionDragging, setIsRepositionDragging] = useState(false);
  const [tempOffsetY, setTempOffsetY] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const setContainerNode = useCallback((node: HTMLDivElement | null) => {
    setContainerWidth(node?.offsetWidth ?? 0);
  }, []);

  const mergedLabels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...labels }),
    [labels]
  );
  const mergedValidationMessages = useMemo(
    () => ({ ...DEFAULT_VALIDATION_MESSAGES, ...validationMessages }),
    [validationMessages]
  );

  const [previewSrc, setPreviewSrc] = useState('');

  useEffect(() => {
    if (hasFile(value)) {
      const url = URL.createObjectURL(value.file);
      setPreviewSrc(url);

      return () => URL.revokeObjectURL(url);
    }

    if (hasUrl(value)) {
      setPreviewSrc(value.url);

      return undefined;
    }

    setPreviewSrc('');

    return undefined;
  }, [value]);

  useEffect(() => {
    setImageError(false);
  }, [previewSrc]);

  const reportValidationError = useCallback(
    (message: string) => {
      if (message && onValidationError) {
        onValidationError(message);
      }
    },
    [onValidationError]
  );

  const acceptFile = useCallback(
    async (file: File) => {
      let dims: { width: number; height: number };
      try {
        dims = await measureImage(file);
      } catch {
        reportValidationError(mergedValidationMessages.failedToLoad);

        return;
      }

      if (
        maxDimensions &&
        (dims.width > maxDimensions.width || dims.height > maxDimensions.height)
      ) {
        reportValidationError(
          mergedValidationMessages.dimensionsExceeded(
            maxDimensions.width,
            maxDimensions.height
          )
        );

        return;
      }

      setImageNaturalWidth(dims.width);
      setImageNaturalHeight(dims.height);
      onChange({ file, position: undefined });
    },
    [maxDimensions, mergedValidationMessages, reportValidationError, onChange]
  );

  const handleDropFiles = useCallback(
    (files: FileList) => {
      if (files.length === 0) {
        return;
      }

      void acceptFile(files[0]);
    },
    [acceptFile]
  );

  const handleSizeLimitExceed = useCallback(() => {
    if (maxSizeMB !== undefined) {
      reportValidationError(mergedValidationMessages.sizeExceeded(maxSizeMB));
    }
  }, [maxSizeMB, mergedValidationMessages, reportValidationError]);

  const openReplacePicker = useCallback(() => {
    if (!replaceInputRef.current) {
      return;
    }

    replaceInputRef.current.value = '';
    replaceInputRef.current.click();
  }, []);

  const handleReplaceInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }

      const file = files[0];
      if (maxSizeMB !== undefined && file.size > maxSizeMB * 1024 * 1024) {
        reportValidationError(mergedValidationMessages.sizeExceeded(maxSizeMB));

        return;
      }

      void acceptFile(file);
    },
    [maxSizeMB, mergedValidationMessages, reportValidationError, acceptFile]
  );

  const handleRemove = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const getScaledImageHeight = useCallback(() => {
    if (!containerWidth || !imageNaturalWidth || !imageNaturalHeight) {
      return 0;
    }

    return (imageNaturalHeight / imageNaturalWidth) * containerWidth;
  }, [imageNaturalHeight, imageNaturalWidth, containerWidth]);

  const getBounds = useCallback(() => {
    const scaledHeight = getScaledImageHeight();
    const minY = Math.min(0, -(scaledHeight - previewHeight));

    return { minY, maxY: 0 };
  }, [getScaledImageHeight, previewHeight]);

  const isImageRepositionable = useMemo(() => {
    return getScaledImageHeight() > previewHeight;
  }, [getScaledImageHeight, previewHeight]);

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      setImageNaturalHeight(img.naturalHeight);
      setImageNaturalWidth(img.naturalWidth);
    },
    []
  );

  const handleRepositionStart = useCallback(() => {
    if (!isImageRepositionable) {
      reportValidationError(mergedLabels.imageTooSmallToReposition);

      return;
    }

    setIsRepositioning(true);
    const scaledHeight = getScaledImageHeight();
    const currentPercentage = value?.position?.y
      ? parseFloat(value.position.y)
      : 0;
    setTempOffsetY((currentPercentage / 100) * scaledHeight);
  }, [
    isImageRepositionable,
    reportValidationError,
    mergedLabels.imageTooSmallToReposition,
    getScaledImageHeight,
    value,
  ]);

  const handleRepositionMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      dragStartYRef.current = event.clientY;
      dragStartOffsetRef.current = tempOffsetY;
      setIsRepositionDragging(true);
    },
    [tempOffsetY]
  );

  const handleRepositionTouchStart = useCallback(
    (event: ReactTouchEvent) => {
      event.preventDefault();
      dragStartYRef.current = event.touches[0].clientY;
      dragStartOffsetRef.current = tempOffsetY;
      setIsRepositionDragging(true);
    },
    [tempOffsetY]
  );

  const moveReposition = useCallback(
    (clientY: number) => {
      const deltaY = clientY - dragStartYRef.current;
      const newOffset = dragStartOffsetRef.current + deltaY;
      const { minY, maxY } = getBounds();
      setTempOffsetY(Math.max(minY, Math.min(maxY, newOffset)));
    },
    [getBounds]
  );

  const handleSaveReposition = useCallback(() => {
    if (!value) {
      setIsRepositioning(false);

      return;
    }

    const scaledHeight = getScaledImageHeight();
    const percentage =
      scaledHeight > 0 ? (tempOffsetY / scaledHeight) * 100 : 0;
    const newPosition: CoverImagePosition = {
      y: `${percentage.toFixed(2)}%`,
    };

    if (hasFile(value)) {
      onChange({ file: value.file, position: newPosition });
    } else if (hasUrl(value)) {
      onChange({ url: value.url, position: newPosition });
    }
    setIsRepositioning(false);
  }, [value, getScaledImageHeight, tempOffsetY, onChange]);

  const handleCancelReposition = useCallback(() => {
    const scaledHeight = getScaledImageHeight();
    const currentPercentage = value?.position?.y
      ? parseFloat(value.position.y)
      : 0;
    setTempOffsetY((currentPercentage / 100) * scaledHeight);
    setIsRepositioning(false);
  }, [value, getScaledImageHeight]);

  const handleResetPosition = useCallback(() => {
    const { minY } = getBounds();
    setTempOffsetY(minY / 2);
  }, [getBounds]);

  const handleRepositionKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (!isRepositioning) {
        return;
      }

      const step = event.shiftKey ? 1 : 5;
      const { minY, maxY } = getBounds();

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setTempOffsetY((prev) => Math.min(maxY, prev + step));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setTempOffsetY((prev) => Math.max(minY, prev - step));
      } else if (event.key === 'Escape') {
        handleCancelReposition();
      } else if (event.key === 'Enter') {
        handleSaveReposition();
      }
    },
    [isRepositioning, getBounds, handleCancelReposition, handleSaveReposition]
  );

  useEffect(() => {
    if (!isRepositionDragging) {
      return undefined;
    }

    const onMouseMove = (event: MouseEvent) => moveReposition(event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      moveReposition(event.touches[0].clientY);
    };
    const onEnd = () => setIsRepositionDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isRepositionDragging, moveReposition]);

  const isFilled = hasFile(value) || hasUrl(value);
  const showDefaultPreview = isFilled && Boolean(previewSrc) && !imageError;

  const acceptString = acceptedFileTypes?.join(',');
  const formattedTypes = formatAcceptedTypes(acceptedFileTypes);
  const formatHint = mergedLabels.formatHint(formattedTypes, maxSizeMB);

  const imageTransform: CSSProperties['transform'] = isRepositioning
    ? `translateY(${tempOffsetY}px)`
    : value?.position?.y
    ? `translateY(${value.position.y})`
    : undefined;

  return (
    <Box
      data-testid={dataTestId}
      direction="col"
      gap={2}
      onBlur={onBlur}>
      <input
        accept={acceptString}
        ref={replaceInputRef}
        style={{ display: 'none' }}
        type="file"
        onChange={handleReplaceInputChange}
      />

      {isFilled && renderPreview ? (
        renderPreview({
          src: previewSrc,
          value: value as
            | { file: File; position?: CoverImagePosition }
            | { url: string; position?: CoverImagePosition },
          onChange,
          onReplace: openReplacePicker,
          onRemove: handleRemove,
        })
      ) : showDefaultPreview ? (
        <div
          aria-invalid={isInvalid || undefined}
          className={cx(
            'tw:group tw:relative tw:w-full tw:overflow-hidden tw:rounded-lg tw:ring-1 tw:ring-secondary',
            isInvalid && 'tw:ring-2 tw:ring-error',
            previewClassName
          )}
          data-testid="cover-image-upload-preview-container"
          ref={setContainerNode}
          style={{ height: previewHeight }}
          tabIndex={isRepositioning ? 0 : -1}
          onKeyDown={handleRepositionKeyDown}>
          <img
            alt={ariaLabel ?? 'Cover image preview'}
            className="tw:block tw:h-auto tw:w-full tw:object-cover tw:object-top tw:select-none"
            data-testid="cover-image-upload-preview"
            src={previewSrc}
            style={{
              minHeight: previewHeight,
              transform: imageTransform,
              transition: isRepositionDragging
                ? 'none'
                : 'transform 0.2s ease',
              cursor: isRepositioning ? 'ns-resize' : 'default',
              touchAction: isRepositioning ? 'none' : 'auto',
            }}
            onError={() => setImageError(true)}
            onLoad={handleImageLoad}
            onMouseDown={
              isRepositioning ? handleRepositionMouseDown : undefined
            }
            onTouchStart={
              isRepositioning ? handleRepositionTouchStart : undefined
            }
          />

          {isRepositioning && (
            <div className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-1/2 tw:-translate-x-1/2 tw:-translate-y-1/2 tw:rounded tw:bg-black/60 tw:px-2 tw:py-1">
              <Typography
                className="tw:text-white"
                size="text-xs"
                weight="medium">
                {mergedLabels.dragHint}
              </Typography>
            </div>
          )}

          <div
            className={cx(
              'tw:pointer-events-none tw:absolute tw:inset-x-0 tw:bottom-0 tw:flex tw:items-center tw:gap-2 tw:p-3 tw:transition tw:duration-150',
              isRepositioning
                ? 'tw:justify-between'
                : 'tw:justify-end tw:bg-gradient-to-t tw:from-black/60 tw:to-transparent tw:opacity-0 tw:group-hover:opacity-100 tw:group-focus-within:opacity-100'
            )}>
            {isRepositioning ? (
              <>
                <Button
                  className="tw:pointer-events-auto"
                  color="secondary"
                  data-testid="cover-image-upload-reset-position"
                  iconLeading={RefreshCcw01}
                  size="sm"
                  onPress={handleResetPosition}>
                  {mergedLabels.resetPosition}
                </Button>
                <div className="tw:flex tw:gap-2">
                  <Button
                    className="tw:pointer-events-auto"
                    color="secondary"
                    data-testid="cover-image-upload-save-position"
                    size="sm"
                    onPress={handleSaveReposition}>
                    {mergedLabels.savePosition}
                  </Button>
                  <Button
                    className="tw:pointer-events-auto"
                    color="secondary"
                    data-testid="cover-image-upload-cancel-position"
                    size="sm"
                    onPress={handleCancelReposition}>
                    {mergedLabels.cancel}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button
                  className="tw:pointer-events-auto"
                  color="secondary"
                  data-testid="cover-image-upload-replace"
                  iconLeading={UploadCloud01}
                  size="sm"
                  onPress={openReplacePicker}>
                  {mergedLabels.replace}
                </Button>
                {repositionable && (
                  <Button
                    className="tw:pointer-events-auto"
                    color="secondary"
                    data-testid="cover-image-upload-reposition"
                    isDisabled={!isImageRepositionable}
                    size="sm"
                    onPress={handleRepositionStart}>
                    {mergedLabels.reposition}
                  </Button>
                )}
                <Button
                  aria-label={mergedLabels.remove}
                  className="tw:pointer-events-auto"
                  color="secondary-destructive"
                  data-testid="cover-image-upload-remove"
                  iconLeading={Trash01}
                  size="sm"
                  onPress={handleRemove}
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <FileUploadDropZone
          accept={acceptString}
          allowsMultiple={false}
          clickToUploadLabel={
            typeof placeholder === 'string'
              ? placeholder
              : mergedLabels.clickToUpload
          }
          data-testid="cover-image-upload-empty-zone"
          hint={formatHint}
          isInvalid={isInvalid}
          maxSize={maxSizeMB ? maxSizeMB * 1024 * 1024 : undefined}
          orDragAndDropLabel={mergedLabels.orDragAndDrop}
          onDropFiles={handleDropFiles}
          onSizeLimitExceed={handleSizeLimitExceed}
        />
      )}
    </Box>
  );
};

CoverImageUploadField.displayName = 'CoverImageUploadField';
