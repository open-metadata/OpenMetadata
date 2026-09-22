/*
 *  Copyright 2026 Collate.
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
    LabelType,
    State,
    TagLabel,
    TagSource
} from '../../../generated/type/tagLabel';

export interface RawTagResult {
  label: string;
  value: string;
  data: unknown;
}

interface RawTagData {
  displayName?: string;
  name?: string;
  style?: { color?: string; iconURL?: string };
}

const getRawTagData = (data: unknown): RawTagData => (data as RawTagData) ?? {};

export const getTagDisplayLabel = (result: RawTagResult): string => {
  const data = getRawTagData(result.data);

  return data.displayName || data.name || result.label;
};

export const getTagStyle = (
  result: RawTagResult
): { color?: string; iconURL?: string } | undefined => {
  return getRawTagData(result.data).style;
};

export const buildTagLabelFromResult = (result: RawTagResult): TagLabel => {
  const data = getRawTagData(result.data);

  return {
    tagFQN: result.value,
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
    name: data.name,
    displayName: data.displayName,
    style: data.style,
  };
};

export const buildTagLabelFromFqn = (fqn: string): TagLabel => ({
  tagFQN: fqn,
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
});
