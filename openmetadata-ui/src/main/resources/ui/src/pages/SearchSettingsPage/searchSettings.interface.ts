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
import {
  AssetTypeConfiguration,
  FieldValueBoost,
  GlobalSettings,
  TermBoost,
} from '../../generated/configuration/searchSettings';

export interface EntitySearchSettingsState
  extends Partial<AssetTypeConfiguration> {
  isUpdated?: boolean;
}

type PropertyKey = keyof Pick<
  GlobalSettings,
  'maxAggregateSize' | 'maxResultHits' | 'maxAnalyzedOffset'
>;

export interface Property {
  key: PropertyKey;
  label: string;
  min?: number;
  max?: number;
}

export interface SettingCategoryData {
  key: string;
  isProtected: boolean;
  label: string;
  description: string;
  icon: SvgComponent;
}

export interface UpdateConfigParams {
  enabled?: boolean;
  field?:
    | 'maxAggregateSize'
    | 'maxResultHits'
    | 'maxAnalyzedOffset'
    | 'enableAccessControl'
    | 'termBoosts'
    | 'fieldValueBoosts';
  value?: number | TermBoost[] | FieldValueBoost[];
}
