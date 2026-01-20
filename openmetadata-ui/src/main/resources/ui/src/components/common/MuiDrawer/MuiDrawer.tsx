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
  CircularProgress,
  Drawer,
  IconButton,
  Switch,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const theme = useTheme();
  const { t } = useTranslation();
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const [showSidePanel, setShowSidePanel] = useState<boolean>(false);

  return (
    <Drawer
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: showSidePanel ? '1200px' : '700px',
          backgroundColor: theme.palette.background.default,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      }}
      anchor="right"
      open={open}
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
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            bgcolor: theme.palette.background.paper,
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
            bgcolor: theme.palette.background.default,
          }}>
          {/* Main Content Side */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 6,
              pt: 0,
              maxWidth: showSidePanel ? '60%' : '100%',
              transition: theme.transitions.create('max-width'),
              borderRight: showSidePanel
                ? `1px solid ${theme.palette.divider}`
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
                bgcolor: theme.palette.background.paper,
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
              borderTop: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.background.paper,
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
                isLoading ? (
                  <CircularProgress color="inherit" size={16} />
                ) : null
              }
              sx={{
                px: 3,
                py: 1,
                fontSize: theme.typography.body2.fontSize,
                '&:disabled': {
                  backgroundColor: theme.palette.allShades.blue['100'],
                  color: theme.palette.allShades.white,
                  borderColor: theme.palette.allShades.blue['100'],
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
