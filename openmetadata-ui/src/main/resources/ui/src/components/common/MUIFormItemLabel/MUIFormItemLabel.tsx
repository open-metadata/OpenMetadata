/*
 *  Copyright 2024 Collate.
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

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { TooltipProps } from '@mui/material/Tooltip';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelperTextType } from '../../../interface/FormUtils.interface';

export interface MUIFormItemLabelProps {
  label: ReactNode;
  helperText?: ReactNode;
  helperTextType?: HelperTextType;
  showHelperText?: boolean;
  placement?: TooltipProps['placement'];
  overlayClassName?: string;
  overlayInnerStyle?: React.CSSProperties;
  align?: TooltipProps['placement'];
  isBeta?: boolean;
  slotProps?: Partial<TooltipProps>;
}

const MUIFormItemLabel: FC<MUIFormItemLabelProps> = ({
  helperText,
  helperTextType = HelperTextType.Tooltip,
  isBeta = false,
  label,
  placement = 'top',
  showHelperText = true,
  slotProps,
}) => {
  const { t } = useTranslation();

  return (
    <Box alignItems="center" display="inline-flex" gap={0.5}>
      <Typography
        component="span"
        data-testid="mui-form-item-label"
        variant="body2">
        {label}
      </Typography>
      {helperTextType === HelperTextType.Tooltip &&
        helperText &&
        showHelperText && (
          <Box>
            <Tooltip
              arrow
              placement={placement || 'top'}
              slotProps={slotProps}
              title={helperText || ''}>
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'help',
                  lineHeight: 0,
                  pointerEvents: 'auto',
                }}>
                <InfoOutlinedIcon
                  data-testid="mui-helper-icon"
                  sx={{
                    fontSize: 16,
                    color: 'text.secondary',
                    pointerEvents: 'auto',
                  }}
                />
              </Box>
            </Tooltip>
          </Box>
        )}
      {isBeta && (
        <Chip
          color="primary"
          data-testid="mui-beta-badge"
          label={t('label.beta')}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.75rem',
            '& .MuiChip-label': {
              px: 1,
              py: 0,
            },
          }}
        />
      )}
    </Box>
  );
};

export default MUIFormItemLabel;
