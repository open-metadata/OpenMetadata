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
import { Box, Switch as MuiSwitch, SxProps, Theme } from '@mui/material';
import { FC, memo, useCallback } from 'react';
import MUIFormItemLabel from '../../common/MUIFormItemLabel/MUIFormItemLabel';
import { MUISwitchProps } from './MUISwitch.interface';

const LABEL_STYLES: SxProps<Theme> = {
  color: (theme) => theme.palette.grey[700],
  fontWeight: (theme) => theme.typography.subtitle2.fontWeight,
};

const MUISwitch: FC<MUISwitchProps> = ({
  checked = false,
  onChange,
  label,
  disabled = false,
  ...props
}) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!disabled) {
        onChange?.(event.target.checked);
      }
    },
    [onChange, disabled]
  );

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <MuiSwitch
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        {...props}
      />
      {label && <MUIFormItemLabel label={label} labelSx={LABEL_STYLES} />}
    </Box>
  );
};

export default memo(MUISwitch);
