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
import { FormControl, FormHelperText } from '@mui/material';
import { FC, ReactNode } from 'react';

interface MUIFormItemProps {
  label?: ReactNode;
  error?: boolean;
  helperText?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
  fullWidth?: boolean;
}

const MUIFormItem: FC<MUIFormItemProps> = ({
  label,
  error,
  helperText,
  required,
  children,
  className,
  id,
  fullWidth = true,
}) => {
  return (
    <FormControl
      fullWidth={fullWidth}
      error={error}
      required={required}
      className={className}
      id={id}
    >
      {label}
      {children}
      {helperText && (
        <FormHelperText>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
};

export default MUIFormItem;
