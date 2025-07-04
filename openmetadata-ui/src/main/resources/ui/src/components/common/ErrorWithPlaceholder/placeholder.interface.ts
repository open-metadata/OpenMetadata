/*
 *  Copyright 2023 Collate.
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

import { ReactElement, ReactNode } from 'react';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';

export interface ErrorPlaceholderProps {
  children?: React.ReactNode;
  type?: ERROR_PLACEHOLDER_TYPE;
  buttonId?: string;
  heading?: string;
  doc?: string;
  button?: React.ReactNode;
  className?: string;
  size?: SIZE;
  icon?: ReactElement;
  onClick?: () => void;
  permission?: boolean;
  placeholderText?: ReactNode;
  permissionValue?: string;
}

export interface NoDataPlaceholderProps {
  size?: SIZE;
  className?: string;
  children?: React.ReactNode;
  icon?: ReactElement;
  placeholderText?: ReactNode;
}

export interface CreatePlaceholderProps {
  size?: SIZE;
  className?: string;
  children?: React.ReactNode;
  heading?: string;
  doc?: string;
  permission?: boolean;
  buttonId?: string;
  placeholderText?: ReactNode;
  permissionValue?: string;
  onClick?: () => void;
}

export interface AssignPlaceholderProps {
  size?: SIZE;
  className?: string;
  heading?: string;
  permission?: boolean;
  children?: React.ReactNode;
  button?: React.ReactNode;
  permissionValue?: string;
}

export interface PermissionPlaceholderProps {
  size?: SIZE;
  className?: string;
  permissionValue?: string;
}

export interface FilterPlaceholderProps {
  size?: SIZE;
  className?: string;
  doc?: string;
  placeholderText?: ReactNode;
}

export interface FilterTablePlaceHolderProps {
  placeholderText?: ReactNode;
}
