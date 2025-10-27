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
/*
 *  Copyright 2025 Collate.
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
  CircularProgress,
  FormControl,
  FormLabel,
  Typography,
  useTheme,
} from '@mui/material';
import { UploadCloud01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { useSnackbar } from 'notistack';
import { FC, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showNotistackError } from '../../../utils/NotistackUtils';
import { MUIFileUploadProps } from './MUIFileUpload.interface';

const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_ACCEPTED_FORMATS = ['*/*'];
const DEFAULT_UPLOAD_ZONE_HEIGHT = 95;

const MUIFileUpload: FC<MUIFileUploadProps> = ({
  value,
  onChange,
  onUpload,
  label,
  disabled = false,
  error = false,
  helperText,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
  validateFile,
  renderPreview,
  uploadZoneHeight = DEFAULT_UPLOAD_ZONE_HEIGHT,
  showFileName = true,
  uploadZoneSubtext,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const validateFileBasic = useCallback(
    (file: File): { valid: boolean; error?: string } => {
      if (
        acceptedFormats[0] !== '*/*' &&
        !acceptedFormats.includes(file.type)
      ) {
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

  const handleFileUpload = useCallback(
    async (file: File) => {
      const basicValidation = validateFileBasic(file);
      if (!basicValidation.valid) {
        showNotistackError(
          enqueueSnackbar,
          basicValidation.error ?? t('message.invalid-file'),
          undefined,
          { vertical: 'top', horizontal: 'center' }
        );

        return;
      }

      if (validateFile) {
        const customValidation = await validateFile(file);
        if (!customValidation.valid) {
          showNotistackError(
            enqueueSnackbar,
            customValidation.error ?? t('message.invalid-file'),
            undefined,
            { vertical: 'top', horizontal: 'center' }
          );

          return;
        }
      }

      if (onUpload) {
        try {
          setIsUploading(true);

          const url = await onUpload(file);

          if (onChange) {
            onChange({ url });
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
        if (onChange) {
          onChange({ file });
        }
      }
    },
    [onUpload, onChange, validateFileBasic, validateFile, t, enqueueSnackbar]
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
      onChange(undefined);
    }
  }, [onChange]);

  const formatAcceptedTypes =
    acceptedFormats[0] === '*/*'
      ? t('label.all-files')
      : acceptedFormats
          .map((format) => format.split('/')[1].toUpperCase())
          .join(', ');

  const fileName = value && 'file' in value ? value.file.name : '';

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
            aria-label={t('label.upload-file')}
            data-testid="file-upload-zone"
            role="button"
            sx={{
              position: 'relative',
              width: '100%',
              height: uploadZoneHeight,
              minHeight: uploadZoneHeight,
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
                    {uploadZoneSubtext ||
                      t('message.file-format-size', {
                        formats: formatAcceptedTypes,
                        size: `${maxSizeMB}MB`,
                      })}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Box>
      ) : (
        <>
          {renderPreview ? (
            renderPreview(value, handleRemoveClick, handleUploadClick)
          ) : (
            <Box
              data-testid="file-upload-preview"
              sx={{
                width: '100%',
                p: 2,
                border: '1px solid',
                borderColor: error
                  ? theme.palette.error?.main
                  : theme.palette.allShades?.gray?.[200],
                borderRadius: 1,
                backgroundColor: theme.palette.background?.paper,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              {showFileName && (
                <Typography
                  sx={{
                    color: theme.palette.grey?.[900],
                    fontSize: '14px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  variant="body2">
                  {fileName || t('label.file-uploaded')}
                </Typography>
              )}
              <Typography
                sx={{
                  color: theme.palette.primary?.main,
                  fontSize: '14px',
                  cursor: 'pointer',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
                variant="body2"
                onClick={handleRemoveClick}>
                {t('label.remove')}
              </Typography>
            </Box>
          )}
        </>
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

export default MUIFileUpload;
