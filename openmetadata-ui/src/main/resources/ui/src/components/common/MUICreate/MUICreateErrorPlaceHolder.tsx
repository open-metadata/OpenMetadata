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
import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Typography } from '@mui/material';
import classNames from 'classnames';
import { ReactNode } from 'react';

export interface MUICreateErrorPlaceHolderProps {
  buttonId?: string;
  children?: ReactNode;
  className?: string;
  heading?: string;
  icon?: ReactNode;
  permission?: boolean;
  buttonTitle?: string;
  onClick?: () => void;
  contentMaxWidth?: string;
}

const MUICreateErrorPlaceHolder = ({
  children,
  buttonId,
  className,
  heading,
  icon,
  buttonTitle,
  permission = false,
  onClick,
  contentMaxWidth,
}: MUICreateErrorPlaceHolderProps) => {
  return (
    <div
      className={classNames(
        className,
        'h-full flex-center border-default border-radius-sm bg-white w-full p-8'
      )}
      data-testid="no-data-placeholder"
      style={{ paddingTop: 0 }}>
      <Box sx={{ textAlign: 'center' }}>
        {icon && <div className="m-b-xs">{icon}</div>}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column',
            maxWidth: contentMaxWidth ?? '16rem',
          }}>
          {heading && <Typography>{heading}</Typography>}
          {children}
          {permission && onClick && (
            <Button
              color="primary"
              data-testid={buttonId}
              startIcon={<AddIcon />}
              sx={{ mt: 3, minWidth: '10rem' }}
              variant="contained"
              onClick={onClick}>
              {buttonTitle}
            </Button>
          )}
        </Box>
      </Box>
    </div>
  );
};

export default MUICreateErrorPlaceHolder;
