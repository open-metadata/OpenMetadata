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
import { TextField, TextFieldProps } from '@mui/material';
import { FC, memo } from 'react';

interface MUITextFieldProps extends Omit<TextFieldProps, 'variant' | 'size'> {
  variant?: 'outlined' | 'filled' | 'standard';
  size?: 'small' | 'medium';
}

const MUITextField: FC<MUITextFieldProps> = ({
  size = 'small',
  ...props
}) => {
  return (
    <TextField
      fullWidth
      size={size}
      {...props}
    />
  );
};

export default memo(MUITextField);
