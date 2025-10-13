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
  FormControl,
  FormLabel,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { RefreshCcw01, Trash01, UploadCloud01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { useSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showNotistackError } from '../../../utils/NotistackUtils';
import imageClassBase from '../../BlockEditor/Extensions/image/ImageClassBase';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Generate preview URL for display
  const previewUrl = useMemo(() => {
    if (!value) {
      return '';
    }

    // If it's a file, create blob URL for preview
    if ('file' in value && value.file) {
      return URL.createObjectURL(value.file);
    }

    // If it's a URL, use it directly
    if ('url' in value && value.url) {
      return value.url;
    }

    return '';
  }, [value]);

  // Get authenticated image hook for backend URLs
  const authenticatedImageUrl = imageClassBase.getAuthenticatedImageUrl();

  // For backend URLs, get authenticated blob URL
  const hasBackendUrl = value && 'url' in value && value.url;
  const authenticatedResult = authenticatedImageUrl?.(
    hasBackendUrl ? value.url : ''
  );
  const authenticatedSrc = authenticatedResult?.imageSrc;
  const imageLoading = authenticatedResult?.isLoading ?? false;

  // Final image source: use authenticated if available, otherwise preview URL
  const imageSrc = useMemo(() => {
    // For backend attachment URLs, use authenticated blob if ready
    if (
      hasBackendUrl &&
      value.url?.includes('/api/v1/attachments/') &&
      authenticatedSrc
    ) {
      return authenticatedSrc;
    }

    // Otherwise use preview URL (blob for files, direct URL for others)
    return previewUrl;
  }, [hasBackendUrl, value, authenticatedSrc, previewUrl]);

  // Check if image is ready to display
  const showImage = useMemo(() => {
    if (!imageSrc) {
      return false;
    }

    // For local files (blob URLs), always show
    if (value && 'file' in value) {
      return imageSrc.startsWith('blob:');
    }

    // For backend URLs, only show when authenticated blob is ready
    if (hasBackendUrl && value.url?.includes('/api/v1/attachments/')) {
      return imageSrc.startsWith('blob:');
    }

    // For regular URLs, show immediately
    return true;
  }, [imageSrc, value, hasBackendUrl]);

  // Cleanup blob URLs on unmount or when file changes
  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset error state when image source changes
  useEffect(() => {
    if (imageSrc) {
      setImageError(false);
    }
  }, [imageSrc]);

  // Reposition states
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [isRepositionDragging, setIsRepositionDragging] = useState(false);
  const [imageNaturalHeight, setImageNaturalHeight] = useState(0);
  const [imageNaturalWidth, setImageNaturalWidth] = useState(0);
  const [tempOffsetY, setTempOffsetY] = useState(0);

  const validateFile = useCallback(
    (file: File): { valid: boolean; error?: string } => {
      if (!acceptedFormats.includes(file.type)) {
        return {
          valid: false,
          error: t('message.invalid-file-format', {
            formats: acceptedFormats
              .map((f) => f.split('/')[1].toUpperCase())
              .join(', '),
          }),
        };
      }

      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        return {
          valid: false,
          error: t('message.file-size-exceeded', { size: `${maxSizeMB}MB` }),
        };
      }

      return { valid: true };
    },
    [acceptedFormats, maxSizeMB, t]
  );

  const validateImageDimensions = useCallback(
    (file: File): Promise<{ valid: boolean; error?: string }> => {
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

  const handleFileUpload = useCallback(
    async (file: File) => {
      const fileValidation = validateFile(file);
      if (!fileValidation.valid) {
        showNotistackError(
          enqueueSnackbar,
          fileValidation.error ?? t('message.invalid-file'),
          undefined,
          { vertical: 'top', horizontal: 'center' }
        );

        return;
      }

      const dimensionsValidation = await validateImageDimensions(file);
      if (!dimensionsValidation.valid) {
        showNotistackError(
          enqueueSnackbar,
          dimensionsValidation.error ?? t('message.invalid-dimensions'),
          undefined,
          { vertical: 'top', horizontal: 'center' }
        );

        return;
      }

      if (onUpload) {
        // Mode 1: Upload immediately (for editing existing entities)
        try {
          setIsUploading(true);
          setImageError(false);

          const url = await onUpload(file);

          if (onChange) {
            onChange({ url, position: value?.position });
          }
        } catch (error) {
          showNotistackError(
            enqueueSnackbar,
            error as AxiosError,
            t('label.failed-to-upload-file'),
            { vertical: 'top', horizontal: 'center' }
          );
        } finally {
          setIsUploading(false);
        }
      } else {
        // Mode 2: Store file locally (for creating new entities)
        if (onChange) {
          onChange({ file, position: value?.position });
        }
      }
    },
    [
      onUpload,
      onChange,
      value?.position,
      validateFile,
      validateImageDimensions,
      t,
      enqueueSnackbar,
    ]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) {
        dragCounterRef.current++;
        setIsDragging(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) {
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
          setIsDragging(false);
        }
      }
    },
    [disabled, isUploading]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (disabled || isUploading) {
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [disabled, isUploading, handleFileUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0]);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFileUpload]
  );

  const handleUploadClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  const handleRemoveClick = useCallback(() => {
    if (onChange) {
      // Clear completely by setting undefined to show initial upload view
      onChange(undefined);
    }
    setImageError(false);
    setImageNaturalHeight(0);
    setImageNaturalWidth(0);
  }, [onChange]);

  // Calculate scaled image height based on container width
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

  // Calculate bounds for repositioning
  const getBounds = useCallback(() => {
    const scaledHeight = getScaledImageHeight();
    const containerHeight = 103;
    const minY = Math.min(0, -(scaledHeight - containerHeight));
    const maxY = 0;

    return { minY, maxY };
  }, [getScaledImageHeight]);

  // Check if image is repositionable
  const isImageRepositionable = useMemo(() => {
    const scaledHeight = getScaledImageHeight();

    return scaledHeight > 103;
  }, [getScaledImageHeight]);

  // Handle image load to detect dimensions
  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setImageNaturalHeight(img.naturalHeight);
      setImageNaturalWidth(img.naturalWidth);
    },
    []
  );

  // Start reposition mode
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
    setTempOffsetY(value?.position?.y ?? 0);
  }, [isImageRepositionable, value, enqueueSnackbar, t]);

  // Mouse/Touch drag handlers for repositioning
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

  // Save reposition - works for both file and URL modes
  const handleSaveReposition = useCallback(() => {
    if (onChange && value) {
      const newPosition = { y: tempOffsetY };

      if ('file' in value) {
        // File mode: preserve file, update position
        onChange({ file: value.file, position: newPosition });
      } else if ('url' in value) {
        // URL mode: preserve URL, update position
        onChange({ url: value.url, position: newPosition });
      }
    }
    setIsRepositioning(false);
  }, [onChange, value, tempOffsetY]);

  // Cancel reposition
  const handleCancelReposition = useCallback(() => {
    setTempOffsetY(value?.position?.y ?? 0);
    setIsRepositioning(false);
  }, [value]);

  // Keyboard support for repositioning
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

  // Reset position to center
  const handleResetPosition = useCallback(() => {
    const { minY } = getBounds();
    const centerY = minY / 2;
    setTempOffsetY(centerY);
  }, [getBounds]);

  // Add/remove event listeners for repositioning
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

  const formatAcceptedTypes = acceptedFormats
    .map((format) => format.split('/')[1].toUpperCase())
    .join(', ');

  return (
    <FormControl fullWidth component="fieldset" disabled={disabled}>
      {label && <FormLabel error={error}>{label}</FormLabel>}

      <input
        hidden
        accept={acceptedFormats.join(',')}
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
      />

      {!value ? (
        <Box
          sx={{
            width: '100%',
            p: 0.5,
            border: '1px solid',
            borderColor: theme.palette.allShades?.blueGray?.[100],
            borderRadius: 1,
            backgroundColor: theme.palette.allShades?.gray?.[50],
          }}>
          <Box
            aria-label={t('label.upload-cover-image')}
            role="button"
            sx={{
              position: 'relative',
              width: '100%',
              height: 95,
              minHeight: 95,
              border: `1px solid ${
                isDragging
                  ? theme.palette.primary?.main
                  : error
                  ? theme.palette.error?.main
                  : theme.palette.allShades?.gray?.[200]
              }`,
              borderRadius: '8px',
              backgroundColor: isDragging
                ? theme.palette.action?.hover
                : theme.palette.background?.paper,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 2,
              gap: 1,
              cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: disabled ? 0.5 : 1,
            }}
            tabIndex={disabled || isUploading ? -1 : 0}
            onClick={handleUploadClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onKeyDown={(e) => {
              if (
                (e.key === 'Enter' || e.key === ' ') &&
                !disabled &&
                !isUploading
              ) {
                e.preventDefault();
                handleUploadClick();
              }
            }}>
            {isUploading ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}>
                <CircularProgress size={40} />
                <Typography
                  sx={{ color: theme.palette.grey?.[600] }}
                  variant="body2">
                  {t('label.uploading')}
                </Typography>
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '4px',
                    backgroundColor: theme.palette.background?.paper,
                    border: '1px solid',
                    borderColor: theme.palette.allShades?.blueGray?.[100],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                  <UploadCloud01
                    style={{
                      width: 14,
                      height: 14,
                      color: theme.palette.grey?.[600],
                    }}
                  />
                </Box>

                <Box sx={{ textAlign: 'center' }}>
                  <Box>
                    <Typography
                      sx={{
                        color: theme.palette.primary?.main,
                        fontWeight: 500,
                        display: 'inline',
                        fontSize: '14px',
                        lineHeight: '20px',
                      }}
                      variant="body2">
                      {t('label.click-to-upload')}
                    </Typography>
                    <Typography
                      sx={{
                        color: theme.palette.grey?.[700],
                        display: 'inline',
                        ml: 0.5,
                        fontSize: '14px',
                        lineHeight: '20px',
                      }}
                      variant="body2">
                      {t('label.or-drag-and-drop')}
                    </Typography>
                  </Box>

                  <Typography
                    sx={{
                      color: theme.palette.grey?.[600],
                      fontSize: '12px',
                      lineHeight: '18px',
                    }}
                    variant="caption">
                    {t('message.cover-image-format-dimensions', {
                      formats: formatAcceptedTypes,
                      width: maxDimensions.width,
                      height: maxDimensions.height,
                    })}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Box>
      ) : (
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
                  ? `translateY(${value.position.y}px)`
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

          {/* Reposition Mode Instruction */}
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

          {/* Buttons Overlay */}
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
                  disabled={disabled || isUploading}
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
                    handleUploadClick();
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
                    handleRemoveClick();
                  }}>
                  <Trash01 style={{ fontSize: 20 }} />
                </IconButton>
              </>
            )}
          </Box>

          {isUploading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <CircularProgress />
            </Box>
          )}
        </Box>
      )}

      {helperText && (
        <Typography
          sx={{
            color: error
              ? theme.palette.error?.main
              : theme.palette.grey?.[600],
            mt: 1,
            display: 'block',
          }}
          variant="caption">
          {helperText}
        </Typography>
      )}
    </FormControl>
  );
};

export default MUICoverImageUpload;
