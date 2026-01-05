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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useTheme,
} from '@mui/material';
import { Trash01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { DeleteModalMUIProps } from './DeleteModalMUI.interface';

/**
 * Reusable MUI Delete Confirmation Modal
 */
export const DeleteModalMUI = ({
  open,
  entityTitle,
  message,
  isDeleting = false,
  onCancel,
  onDelete,
  additionalStyle,
}: DeleteModalMUIProps) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            width: 400,
            maxWidth: '100%',
            ...additionalStyle,
          },
        },
      }}
      onClose={isDeleting ? undefined : onCancel}>
      <Box sx={{ p: 6 }}>
        <Box
          sx={{
            alignItems: 'center',
            backgroundColor: theme.palette.allShades?.error?.[50],
            borderRadius: '50%',
            display: 'flex',
            height: 48,
            justifyContent: 'center',
            mb: 4,
            width: 48,
          }}>
          <Trash01 color={theme.palette.allShades?.error?.[600]} size={24} />
        </Box>

        <DialogTitle
          sx={{
            mb: 0.5,
            p: 0,
            fontWeight: 600,
            fontSize: '16px',
            lineHeight: 1.5,
            '&.MuiDialogTitle-root': {
              padding: 0,
              fontWeight: 600,
              fontSize: '16px',
              lineHeight: 1.5,
            },
          }}>
          {t('label.delete')} {entityTitle}
        </DialogTitle>

        <DialogContent
          sx={{
            mb: 8,
            p: 0,
            '&.MuiDialogContent-root': { padding: 0 },
          }}>
          <Typography
            color="text.secondary"
            sx={{
              fontWeight: 400,
              fontSize: '14px',
              lineHeight: 1.43,
            }}>
            {message}
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            display: 'flex',
            gap: 1,
            p: 0,
            '&.MuiDialogActions-root': {
              padding: 0,
            },
          }}>
          <Button
            data-testid="cancel-button"
            disabled={isDeleting}
            size="large"
            sx={{
              flex: 1,
              textTransform: 'none',
            }}
            variant="outlined"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            color="error"
            data-testid="confirm-button"
            disabled={isDeleting}
            size="large"
            sx={{
              flex: 1,
              textTransform: 'none',
            }}
            variant="contained"
            onClick={onDelete}>
            {isDeleting ? (
              <CircularProgress color="inherit" size={20} />
            ) : (
              t('label.delete')
            )}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default DeleteModalMUI;
