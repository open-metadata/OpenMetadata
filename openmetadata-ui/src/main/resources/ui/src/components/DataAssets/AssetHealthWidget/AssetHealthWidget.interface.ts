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
import { FC } from 'react';

export enum AssetHealthCategory {
  Pipeline = 'pipeline',
  DataQuality = 'dataQuality',
  DataObservability = 'dataObservability',
  Contract = 'contract',
}

export enum AssetHealthTone {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Info = 'info',
  Neutral = 'neutral',
}

export enum AssetHealthCTAType {
  LinkPipeline = 'linkPipeline',
  AddTests = 'addTests',
  EnableObservability = 'enableObservability',
  CreateContract = 'createContract',
}

export interface AssetHealthCTA {
  labelKey: string;
  type: AssetHealthCTAType;
}

export interface AssetHealthRow {
  category: AssetHealthCategory;
  icon: FC<{ className?: string }>;
  title: string;
  subtitle: string;
  tone: AssetHealthTone;
  badgeLabel?: string;
  cta?: AssetHealthCTA;
}

export interface AssetHealthHeader {
  tone: AssetHealthTone;
  labelKey: string;
}

export interface AssetHealthTonePresentation {
  tone: AssetHealthTone;
  badgeKey: string;
  subtitleKey?: string;
}

export interface AssetHealthRowItemProps {
  row: AssetHealthRow;
  onCtaClick: (type: AssetHealthCTAType) => void;
}

export interface UseAssetHealthResult {
  rows: AssetHealthRow[];
  isLoading: boolean;
}
