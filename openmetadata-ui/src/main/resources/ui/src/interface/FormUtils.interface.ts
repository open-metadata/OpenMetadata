/*
 *  Copyright 2022 Collate.
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

import { FormItemProps, FormRule } from 'antd';
import { NamePath } from 'antd/lib/form/interface';
import { ReactNode } from 'react';
import { FormValidationRulesType } from '../enums/form.enum';

export type FormValidationRules = Record<
  FormValidationRulesType,
  Array<string>
>;

export enum FormItemLayout {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
}

export enum FieldTypes {
  TEXT = 'text',
  PASSWORD = 'password',
  FILTER_PATTERN = 'filter_pattern',
  SWITCH = 'switch',
  SELECT = 'select',
  ASYNC_SELECT_LIST = 'async_select_list',
  NUMBER = 'number',
  CHECK_BOX = 'check_box',
  SLIDER_INPUT = 'slider_input',
  DESCRIPTION = 'description',
  TAG_SUGGESTION = 'tag_suggestion',
  USER_TEAM_SELECT = 'user_team_select',
  USER_TEAM_SELECT_SEARCH_INPUT = 'user_team_select_search_input',
  USER_MULTI_SELECT = 'user_multi_select',
  COLOR_PICKER = 'color_picker',
  DOMAIN_SELECT = 'domain_select',
  CRON_EDITOR = 'cron_editor',
  TREE_ASYNC_SELECT_LIST = 'tree_async_select_list',
}

export enum HelperTextType {
  ALERT = 'alert',
  Tooltip = 'tooltip',
}

export interface FieldProp {
  label: ReactNode;
  name: NamePath;
  type: FieldTypes;
  required: boolean;
  id: string;
  props?: Record<string, unknown> & { children?: ReactNode };
  formItemProps?: FormItemProps;
  rules?: FormRule[];
  helperText?: ReactNode;
  helperTextType?: HelperTextType;
  showHelperText?: boolean;
  placeholder?: string;
  hasSeparator?: boolean;
  formItemLayout?: FormItemLayout;
  isBeta?: boolean;
  newLook?: boolean;
}
