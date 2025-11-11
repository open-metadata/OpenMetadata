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
  AllowedFieldField,
  FieldValueBoost,
} from '../../../generated/configuration/searchSettings';
import { MatchType } from '../../../generated/settings/settings';
import { EntitySearchSettingsState } from '../../../pages/SearchSettingsPage/searchSettings.interface';

export interface FieldConfigurationProps {
  field: {
    fieldName: string;
    weight: number;
    matchType?: MatchType;
  };
  searchSettings: EntitySearchSettingsState;
  index: number;
  entityFields: AllowedFieldField[];
  initialOpen?: boolean;
  onHighlightFieldsChange: (fieldName: string) => void;
  onFieldWeightChange: (fieldName: string, value: number) => void;
  onMatchTypeChange: (fieldName: string, matchType: MatchType) => void;
  onValueBoostChange?: (fieldName: string, boost: FieldValueBoost) => void;
  onDeleteBoost?: (fieldName: string) => void;
  onDeleteSearchField: (fieldName: string) => void;
}
