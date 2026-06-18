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

import { CloseOutlined } from '@ant-design/icons';
import {
  Box,
  Button,
  Drawer,
  IconButton,
  Switch,
  Typography,
} from '@mui/material';
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../Loader/Loader';
import { MuiDrawerProps } from './MuiDrawer.interface';

const MuiDrawer: FC<MuiDrawerProps> = ({
  open,
  onClose,
  title,
  formRef,
  isLoading = false,
  isFormInvalid = false,
  submitBtnLabel,
  cancelBtnLabel,
  children,
  headerWidget,
  sidePanel,
  hasSidePanel = false,
}) => {
  const { t } = useTranslation();
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const [showSidePanel, setShowSidePanel] = useState<boolean>(false);

  return (
    <Drawer
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: showSidePanel ? '1200px' : '700px',
          backgroundColor: 'var(--color-bg-primary)',
          transition: 'width 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
        },
      }}
      anchor="right"
      open={open}
      sx={{
        zIndex: 1000,
      }}
      onClose={onClose}>
      <Box
        ref={drawerContentRef}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
        {/* Header */}
        <Box
          sx={{
            px: 6,
            py: 4,
            borderBottom: `1px solid var(--color-border-primary)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            bgcolor: 'var(--color-bg-primary)',
          }}>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          <Box alignItems="center" display="flex" gap={2}>
            {headerWidget}
            {hasSidePanel && (
              <Box alignItems="center" display="flex" gap={1}>
                <Switch
                  checked={showSidePanel}
                  data-testid="show-side-panel-switch"
                  onChange={(e) => setShowSidePanel(e.target.checked)}
                />
                <Typography variant="body2">
                  {t('label.show-help-text')}
                </Typography>
              </Box>
            )}
            <IconButton size="small" onClick={onClose}>
              <CloseOutlined />
            </IconButton>
          </Box>
        </Box>

        {/* Content Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
            bgcolor: 'var(--color-bg-primary)',
          }}>
          {/* Main Content Side */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 6,
              pt: 0,
              maxWidth: showSidePanel ? '60%' : '100%',
              transition: 'max-width 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
              borderRight: showSidePanel
                ? `1px solid var(--color-border-primary)`
                : 'none',
            }}>
            {children}
          </Box>

          {/* Side Panel */}
          {hasSidePanel && showSidePanel && (
            <Box
              sx={{
                width: '40%',
                overflowY: 'auto',
                bgcolor: 'var(--color-bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                pt: 0,
              }}>
              {sidePanel}
            </Box>
          )}
        </Box>

        {/* Footer */}
        {formRef && (
          <Box
            sx={{
              px: 3,
              py: 2,
              borderTop: `1px solid var(--color-border-primary)`,
              bgcolor: 'var(--color-bg-primary)',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 2,
            }}>
            <Button
              color="inherit"
              data-testid="cancel-button"
              disabled={isLoading}
              variant="text"
              onClick={onClose}>
              {cancelBtnLabel || t('label.cancel')}
            </Button>
            <Button
              data-testid="create-button"
              disabled={isLoading || isFormInvalid}
              startIcon={
                isLoading ? <Loader size="x-small" type="white" /> : null
              }
              sx={{
                px: 3,
                py: 1,
                fontSize: '14px',
                '&:disabled': {
                  backgroundColor: '#D1E9FF',
                  color: '#ffffff',
                  borderColor: '#D1E9FF',
                },
              }}
              variant="contained"
              onClick={() => formRef.submit()}>
              {submitBtnLabel || t('label.create')}
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default MuiDrawer;
