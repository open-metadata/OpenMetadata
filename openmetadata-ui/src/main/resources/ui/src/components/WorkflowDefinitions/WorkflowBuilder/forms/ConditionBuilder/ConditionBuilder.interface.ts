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

export interface ConditionRow {
  id: string;
  field: string;
  values: string[];
}

export type ConditionRulesMap = Record<string, string[] | boolean>;

export interface CheckChangeDescConditionPayload {
  config: {
    condition: ConditionType;
    rules: ConditionRulesMap;
  };
}

export type ConditionBuilderPayload = CheckChangeDescConditionPayload;

export type ConditionType = 'AND' | 'OR';

export interface ConditionBuilderOption {
  value: string;
  label: string;
}

export type ConditionValueType = 'boolean' | 'dropdown' | 'text';
export interface ConditionFieldDefinition {
  value: string;
  label: string;
  values: ConditionBuilderOption[];
  valueType?: ConditionValueType;
  fetchOptions?: (search: string) => Promise<ConditionBuilderOption[]>;
  supportsSearch?: boolean;
}

export interface ConditionBuilderProps {
  showCondition?: boolean;
  value: ConditionBuilderPayload | null | undefined;
  onChange: (value: ConditionBuilderPayload) => void;
  fieldDefinitions?: ConditionFieldDefinition[];
  disabled?: boolean;
  'data-testid'?: string;
}
