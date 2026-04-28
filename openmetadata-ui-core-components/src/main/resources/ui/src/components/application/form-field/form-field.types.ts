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

import type { FC, FocusEventHandler, ReactNode } from 'react';
import type { Key } from 'react-aria-components';
import type { RegisterOptions } from 'react-hook-form';
import type { SelectItemType } from '@/components/base/select/select';

export enum HelperTextType {
  ALERT = 'alert',
  TOOLTIP = 'tooltip',
}

export enum FormItemLayout {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
}

export enum FieldTypes {
  TEXT = 'text',
  PASSWORD = 'password',
  NUMBER = 'number',
  SELECT = 'select',
  AUTOCOMPLETE = 'autocomplete',
  MULTI_SELECT = 'multi_select',
  SWITCH = 'switch',
  CHECKBOX = 'checkbox',
  TEXTAREA = 'textarea',
  DESCRIPTION = 'description',
  FILTER_PATTERN = 'filter_pattern',
  SLIDER = 'slider',
  ASYNC_SELECT = 'async_select',
  TREE_ASYNC_SELECT = 'tree_async_select',
  TAG_SUGGESTION = 'tag_suggestion',
  UT_TAG_SUGGESTION = 'ut_tag_suggestion',
  GLOSSARY_TAG_SUGGESTION = 'glossary_tag_suggestion',
  USER_TEAM_SELECT = 'user_team_select',
  USER_MULTI_SELECT = 'user_multi_select',
  USER_TEAM_SELECT_INPUT = 'user_team_select_input',
  COLOR_PICKER = 'color_picker',
  ICON_PICKER = 'icon_picker',
  COVER_IMAGE_UPLOAD = 'cover_image_upload',
  DOMAIN_SELECT = 'domain_select',
  CRON_EDITOR = 'cron_editor',
  SELECT_NATIVE = 'select_native',
  COMPONENT = 'component',
}

export type FormSelectItem = SelectItemType;

export interface IconPickerFieldLabels {
  customIconUrl?: string;
  emptyState?: string;
  enterIconUrl?: string;
  iconsTab?: string;
  urlTab?: string;
}

export interface FieldPropsMap {
  acceptDirectory?: boolean;
  acceptedFileTypes?: string[];
  allowsMultiple?: boolean;
  allowUrl?: boolean;
  backgroundColor?: string;
  children?: ReactNode;
  colors?: string[];
  'data-testid'?: string;
  defaultCamera?: 'environment' | 'user';
  defaultIcon?: { component: FC };
  disabled?: boolean;
  filterOption?: (option: FormSelectItem, searchText: string) => boolean;
  fontSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  emptyStateLabel?: string;
  initialValue?: string;
  items?: FormSelectItem[];
  labels?: IconPickerFieldLabels;
  multiple?: boolean;
  onBlur?: () => void;
  onFocus?: FocusEventHandler;
  onChange?: (value: string) => void;
  onItemCleared?: (key: Key) => void;
  onItemInserted?: (key: Key) => void;
  onSearchChange?: (value: string) => void;
  onSelect?: (files: FileList | null) => void;
  onSelectionChange?: (key: Key | null) => void;
  options?: FormSelectItem[];
  renderItem?: (item: FormSelectItem) => ReactNode;
  selectedItems?: FormSelectItem[];
  size?: 'sm' | 'md';
}

export interface FieldProp {
  name: string;
  label: ReactNode;
  type: FieldTypes;
  required?: boolean;
  rules?: RegisterOptions;
  id?: string;
  placeholder?: string;
  props?: FieldPropsMap;
  helperText?: ReactNode;
  helperTextType?: HelperTextType;
  showHelperText?: boolean;
  hasSeparator?: boolean;
  formItemLayout?: FormItemLayout;
}
