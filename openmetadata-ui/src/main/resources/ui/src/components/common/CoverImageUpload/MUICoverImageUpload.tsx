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

import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { RefreshCcw01, Trash01, UploadCloud01 } from '@untitledui/icons';
import { useSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showNotistackError } from '../../../utils/NotistackUtils';
import imageClassBase from '../../BlockEditor/Extensions/image/ImageClassBase';
import MUIFileUpload from '../FileUpload/MUIFileUpload';
import {
  FileUploadValue,
  FileValidationResult,
} from '../FileUpload/MUIFileUpload.interface';
import { MUICoverImageUploadProps } from './CoverImageUpload.interface';

const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_ACCEPTED_FORMATS = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/gif',
];
const DEFAULT_MAX_DIMENSIONS = { width: 800, height: 400 };

const MUICoverImageUpload: FC<MUICoverImageUploadProps> = ({
  value,
  onChange,
  onUpload,
  label,
  disabled = false,
  error = false,
  helperText,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
  maxDimensions = DEFAULT_MAX_DIMENSIONS,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const [imageError, setImageError] = useState(false);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [isRepositionDragging, setIsRepositionDragging] = useState(false);
  const [imageNaturalHeight, setImageNaturalHeight] = useState(0);
  const [imageNaturalWidth, setImageNaturalWidth] = useState(0);
  const [tempOffsetY, setTempOffsetY] = useState(0);

  const previewUrl = useMemo(() => {
    if (!value) {
      return '';
    }

    if ('file' in value && value.file) {
      return URL.createObjectURL(value.file);
    }

    if ('url' in value && value.url) {
      return value.url;
    }

    return '';
  }, [value]);

  const authenticatedImageUrl = imageClassBase.getAuthenticatedImageUrl();
  const hasBackendUrl = value && 'url' in value && value.url;
  const authenticatedResult = authenticatedImageUrl?.(
    hasBackendUrl ? value.url : ''
  );
  const authenticatedSrc = authenticatedResult?.imageSrc;
  const imageLoading = authenticatedResult?.isLoading ?? false;

  const imageSrc = useMemo(() => {
    if (
      hasBackendUrl &&
      value.url?.includes('/api/v1/attachments/') &&
      authenticatedSrc
    ) {
      return authenticatedSrc;
    }

    return previewUrl;
  }, [hasBackendUrl, value, authenticatedSrc, previewUrl]);

  const showImage = useMemo(() => {
    if (!imageSrc) {
      return false;
    }

    if (value && 'file' in value) {
      return imageSrc.startsWith('blob:');
    }

    if (hasBackendUrl && value.url?.includes('/api/v1/attachments/')) {
      return imageSrc.startsWith('blob:');
    }

    return true;
  }, [imageSrc, value, hasBackendUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (imageSrc) {
      setImageError(false);
    }
  }, [imageSrc]);

  const validateImageDimensions = useCallback(
    (file: File): Promise<FileValidationResult> => {
      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(url);

          if (
            img.width > maxDimensions.width ||
            img.height > maxDimensions.height
          ) {
            resolve({
              valid: false,
              error: t('message.image-dimensions-exceeded', {
                maxWidth: maxDimensions.width,
                maxHeight: maxDimensions.height,
              }),
            });
          } else {
            resolve({ valid: true });
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({
            valid: false,
            error: t('message.failed-to-load-image'),
          });
        };

        img.src = url;
      });
    },
    [maxDimensions, t]
  );

  const handleFileUploadChange = useCallback(
    (newValue: FileUploadValue | undefined) => {
      if (!newValue) {
        onChange?.(undefined);
        setImageError(false);
        setImageNaturalHeight(0);
        setImageNaturalWidth(0);

        return;
      }

      if ('file' in newValue) {
        onChange?.({ file: newValue.file, position: value?.position });
      } else if ('url' in newValue) {
        onChange?.({ url: newValue.url, position: value?.position });
      }
    },
    [onChange, value?.position]
  );

  const getScaledImageHeight = useCallback(() => {
    if (
      !imageContainerRef.current ||
      !imageNaturalWidth ||
      !imageNaturalHeight
    ) {
      return 0;
    }
    const containerWidth = imageContainerRef.current.offsetWidth;

    return (imageNaturalHeight / imageNaturalWidth) * containerWidth;
  }, [imageNaturalWidth, imageNaturalHeight]);

  const getBounds = useCallback(() => {
    const scaledHeight = getScaledImageHeight();
    const containerHeight = 103;
    const minY = Math.min(0, -(scaledHeight - containerHeight));
    const maxY = 0;

    return { minY, maxY };
  }, [getScaledImageHeight]);

  const isImageRepositionable = useMemo(() => {
    const scaledHeight = getScaledImageHeight();

    return scaledHeight > 103;
  }, [getScaledImageHeight]);

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setImageNaturalHeight(img.naturalHeight);
      setImageNaturalWidth(img.naturalWidth);
    },
    []
  );

  const handleRepositionClick = useCallback(() => {
    if (!isImageRepositionable) {
      showNotistackError(
        enqueueSnackbar,
        t('message.image-too-small-to-reposition'),
        undefined,
        { vertical: 'top', horizontal: 'center' }
      );

      return;
    }
    setIsRepositioning(true);
    const scaledHeight = getScaledImageHeight();
    const currentPercentage = value?.position?.y
      ? parseFloat(value.position.y)
      : 0;
    const pixelOffset = (currentPercentage / 100) * scaledHeight;
    setTempOffsetY(pixelOffset);
  }, [isImageRepositionable, value, enqueueSnackbar, t, getScaledImageHeight]);

  const dragStartYRef = useRef(0);
  const dragStartOffsetRef = useRef(0);

  const handleRepositionMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartYRef.current = e.clientY;
      dragStartOffsetRef.current = tempOffsetY;
      setIsRepositionDragging(true);
    },
    [tempOffsetY]
  );

  const handleRepositionTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      dragStartYRef.current = e.touches[0].clientY;
      dragStartOffsetRef.current = tempOffsetY;
      setIsRepositionDragging(true);
    },
    [tempOffsetY]
  );

  const handleRepositionMove = useCallback(
    (clientY: number) => {
      const deltaY = clientY - dragStartYRef.current;
      const newOffset = dragStartOffsetRef.current + deltaY;

      const { minY, maxY } = getBounds();
      const clampedOffset = Math.max(minY, Math.min(maxY, newOffset));

      setTempOffsetY(clampedOffset);
    },
    [getBounds]
  );

  const handleRepositionMouseMove = useCallback(
    (e: MouseEvent) => {
      handleRepositionMove(e.clientY);
    },
    [handleRepositionMove]
  );

  const handleRepositionTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      handleRepositionMove(e.touches[0].clientY);
    },
    [handleRepositionMove]
  );

  const handleRepositionEnd = useCallback(() => {
    setIsRepositionDragging(false);
  }, []);

  const handleSaveReposition = useCallback(() => {
    if (onChange && value) {
      const scaledHeight = getScaledImageHeight();
      const percentage = (tempOffsetY / scaledHeight) * 100;
      const newPosition = { y: `${percentage.toFixed(2)}%` };

      if ('file' in value) {
        onChange({ file: value.file, position: newPosition });
      } else if ('url' in value) {
        onChange({ url: value.url, position: newPosition });
      }
    }
    setIsRepositioning(false);
  }, [onChange, value, tempOffsetY, getScaledImageHeight]);

  const handleCancelReposition = useCallback(() => {
    const scaledHeight = getScaledImageHeight();
    const currentPercentage = value?.position?.y
      ? parseFloat(value.position.y)
      : 0;
    const pixelOffset = (currentPercentage / 100) * scaledHeight;
    setTempOffsetY(pixelOffset);
    setIsRepositioning(false);
  }, [value, getScaledImageHeight]);

  const handleRepositionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isRepositioning) {
        return;
      }

      const step = e.shiftKey ? 1 : 5;
      const { minY, maxY } = getBounds();

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setTempOffsetY((prev) => Math.min(maxY, prev + step));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setTempOffsetY((prev) => Math.max(minY, prev - step));
      } else if (e.key === 'Escape') {
        handleCancelReposition();
      } else if (e.key === 'Enter') {
        handleSaveReposition();
      }
    },
    [isRepositioning, getBounds, handleCancelReposition, handleSaveReposition]
  );

  const handleResetPosition = useCallback(() => {
    const { minY } = getBounds();
    const centerY = minY / 2;
    setTempOffsetY(centerY);
  }, [getBounds]);

  useEffect(() => {
    if (isRepositionDragging) {
      window.addEventListener('mousemove', handleRepositionMouseMove);
      window.addEventListener('mouseup', handleRepositionEnd);
      window.addEventListener('touchmove', handleRepositionTouchMove, {
        passive: false,
      });
      window.addEventListener('touchend', handleRepositionEnd);

      return () => {
        window.removeEventListener('mousemove', handleRepositionMouseMove);
        window.removeEventListener('mouseup', handleRepositionEnd);
        window.removeEventListener('touchmove', handleRepositionTouchMove);
        window.removeEventListener('touchend', handleRepositionEnd);
      };
    }

    return undefined;
  }, [
    isRepositionDragging,
    handleRepositionMouseMove,
    handleRepositionTouchMove,
    handleRepositionEnd,
  ]);

  const renderCoverImagePreview = useCallback(
    (
      _fileValue: FileUploadValue,
      onRemove: () => void,
      onReUpload: () => void
    ) => {
      return (
        <Box
          data-testid="cover-image-upload-preview-container"
          ref={imageContainerRef}
          sx={{
            position: 'relative',
            width: '100%',
            height: 103,
            minHeight: 103,
            borderRadius: '8px',
            overflow: 'hidden',
            border: error
              ? `2px solid ${theme.palette.error?.main}`
              : `1px solid ${theme.palette.grey?.[300]}`,
          }}
          tabIndex={isRepositioning ? 0 : -1}
          onKeyDown={handleRepositionKeyDown}>
          {showImage ? (
            <Box
              alt="Cover"
              component="img"
              data-testid="cover-image-upload-preview"
              src={imageSrc}
              sx={{
                width: '100%',
                height: 'auto',
                minHeight: 103,
                objectFit: 'cover',
                objectPosition: 'center top',
                transform: isRepositioning
                  ? `translateY(${tempOffsetY}px)`
                  : value?.position?.y
                  ? `translateY(${value.position.y})`
                  : 'none',
                display: imageError ? 'none' : 'block',
                cursor: isRepositioning ? 'ns-resize' : 'default',
                transition: isRepositionDragging
                  ? 'none'
                  : 'transform 0.2s ease',
                userSelect: 'none',
                WebkitUserDrag: 'none',
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
          ) : imageLoading ? (
            <Box
              data-testid="cover-image-upload-loading"
              sx={{
                width: '100%',
                height: 103,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.palette.grey?.[100],
              }}>
              <CircularProgress
                data-testid="cover-image-upload-loading-spinner"
                size={24}
              />
            </Box>
          ) : null}

          {imageError && (
            <Box
              data-testid="cover-image-upload-error"
              sx={{
                width: '100%',
                height: 103,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.palette.grey?.[100],
              }}>
              <Typography
                sx={{ color: theme.palette.error?.main }}
                variant="body2">
                {t('message.failed-to-load-image')}
              </Typography>
            </Box>
          )}

          {isRepositioning && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 1,
              }}>
              <Typography
                sx={{
                  color: 'white',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}
                variant="caption">
                {t('message.drag-to-adjust-position')}
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: isRepositioning
                ? 'none'
                : 'linear-gradient(0deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 100%)',
              display: 'flex',
              justifyContent: isRepositioning ? 'space-between' : 'flex-end',
              alignItems: 'flex-end',
              padding: 2,
              gap: 1,
              pointerEvents: 'none',
            }}>
            {isRepositioning ? (
              <>
                <Button
                  color="secondary"
                  size="small"
                  startIcon={<RefreshCcw01 style={{ fontSize: 16 }} />}
                  sx={{
                    pointerEvents: 'auto',
                    color: theme.palette.primary?.main,
                    '&:hover': {
                      color: theme.palette.primary?.main,
                    },
                  }}
                  variant="contained"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetPosition();
                  }}>
                  {t('label.reset-position')}
                </Button>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    color="secondary"
                    size="small"
                    sx={{
                      pointerEvents: 'auto',
                      color: theme.palette.primary?.main,
                      '&:hover': {
                        color: theme.palette.primary?.main,
                      },
                    }}
                    variant="contained"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveReposition();
                    }}>
                    {t('label.save-position')}
                  </Button>
                  <Button
                    color="secondary"
                    size="small"
                    sx={{
                      pointerEvents: 'auto',
                      color: theme.palette.primary?.main,
                      '&:hover': {
                        color: theme.palette.primary?.main,
                      },
                    }}
                    variant="contained"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelReposition();
                    }}>
                    {t('label.cancel')}
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Button
                  color="secondary"
                  disabled={disabled}
                  size="small"
                  startIcon={<UploadCloud01 style={{ fontSize: 16 }} />}
                  sx={{
                    pointerEvents: 'auto',
                    color: theme.palette.primary?.main,
                    '&:hover': {
                      color: theme.palette.primary?.main,
                    },
                  }}
                  variant="contained"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReUpload();
                  }}>
                  {t('label.upload')}
                </Button>

                <Button
                  color="secondary"
                  disabled={disabled || !isImageRepositionable}
                  size="small"
                  sx={{
                    pointerEvents: 'auto',
                    color: theme.palette.primary?.main,
                    '&:hover': {
                      color: theme.palette.primary?.main,
                    },
                  }}
                  variant="contained"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRepositionClick();
                  }}>
                  {t('label.reposition')}
                </Button>

                <IconButton
                  color="secondary"
                  disabled={disabled}
                  size="medium"
                  sx={{
                    height: 36,
                    width: 36,
                    pointerEvents: 'auto',
                    color: theme.palette.primary?.main,
                    '&:hover': {
                      color: theme.palette.primary?.main,
                    },
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}>
                  <Trash01 style={{ fontSize: 20 }} />
                </IconButton>
              </>
            )}
          </Box>
        </Box>
      );
    },
    [
      error,
      theme,
      isRepositioning,
      handleRepositionKeyDown,
      showImage,
      imageSrc,
      tempOffsetY,
      value,
      imageError,
      isRepositionDragging,
      imageLoading,
      t,
      handleImageLoad,
      handleRepositionMouseDown,
      handleRepositionTouchStart,
      handleResetPosition,
      handleSaveReposition,
      handleCancelReposition,
      disabled,
      isImageRepositionable,
      handleRepositionClick,
    ]
  );

  const formatAcceptedTypes = acceptedFormats
    .map((format) => format.split('/')[1].toUpperCase())
    .join(', ');

  return (
    <MUIFileUpload
      acceptedFormats={acceptedFormats}
      disabled={disabled}
      error={error}
      helperText={helperText}
      label={label}
      maxSizeMB={maxSizeMB}
      renderPreview={renderCoverImagePreview}
      showFileName={false}
      uploadZoneHeight={97}
      uploadZoneSubtext={t('message.cover-image-format-dimensions', {
        formats: formatAcceptedTypes,
        width: maxDimensions.width,
        height: maxDimensions.height,
      })}
      validateFile={validateImageDimensions}
      value={value}
      onChange={handleFileUploadChange}
      onUpload={onUpload}
    />
  );
};

export default MUICoverImageUpload;
