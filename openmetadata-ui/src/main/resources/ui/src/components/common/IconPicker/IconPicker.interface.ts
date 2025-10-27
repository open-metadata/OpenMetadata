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

import { FC, ReactNode } from 'react';

export interface IconDefinition {
  name: string;
  component: FC<{ size?: number; style?: React.CSSProperties }>;
  category?: string;
}

export type IconPickerTabValue = 'icons' | 'url';

export interface IconPickerValue {
  type: IconPickerTabValue;
  value: string;
}

export interface MUIIconPickerProps {
  value?: string | IconPickerValue;
  onChange?: (value: string | IconPickerValue) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  allowUrl?: boolean;
  backgroundColor?: string;
  toolTip?: ReactNode;
  defaultIcon?: IconDefinition;
  customStyles?: Record<string, string | number>;
}
