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
import { Activity, AlertTriangle, File04, Shield01 } from '@untitledui/icons';
import { FC } from 'react';
import { ContractExecutionStatus } from '../../../generated/entity/data/dataContract';
import { PipelineState } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  AssetHealthCategory,
  AssetHealthTone,
  AssetHealthTonePresentation,
} from './AssetHealthWidget.interface';

export const ASSET_HEALTH_CATEGORY_ICON: Record<
  AssetHealthCategory,
  FC<{ className?: string }>
> = {
  [AssetHealthCategory.Pipeline]: Activity,
  [AssetHealthCategory.DataQuality]: Shield01,
  [AssetHealthCategory.DataObservability]: AlertTriangle,
  [AssetHealthCategory.Contract]: File04,
};

export const ASSET_HEALTH_CATEGORY_TITLE_KEY: Record<
  AssetHealthCategory,
  string
> = {
  [AssetHealthCategory.Pipeline]: 'label.pipeline',
  [AssetHealthCategory.DataQuality]: 'label.data-quality',
  [AssetHealthCategory.DataObservability]: 'label.data-observability',
  [AssetHealthCategory.Contract]: 'label.contract',
};

export const ASSET_HEALTH_TONE_COLOR: Record<
  AssetHealthTone,
  'success' | 'warning' | 'error' | 'brand' | 'gray'
> = {
  [AssetHealthTone.Success]: 'success',
  [AssetHealthTone.Warning]: 'warning',
  [AssetHealthTone.Error]: 'error',
  [AssetHealthTone.Info]: 'brand',
  [AssetHealthTone.Neutral]: 'gray',
};

export const PIPELINE_STATE_PRESENTATION: Partial<
  Record<PipelineState, AssetHealthTonePresentation>
> = {
  [PipelineState.Success]: {
    tone: AssetHealthTone.Success,
    badgeKey: 'label.healthy',
  },
  [PipelineState.Running]: {
    tone: AssetHealthTone.Info,
    badgeKey: 'label.running',
    subtitleKey: 'message.started-time',
  },
  [PipelineState.Queued]: {
    tone: AssetHealthTone.Info,
    badgeKey: 'label.queued',
  },
  [PipelineState.PartialSuccess]: {
    tone: AssetHealthTone.Warning,
    badgeKey: 'label.partial-success',
  },
  [PipelineState.Stopped]: {
    tone: AssetHealthTone.Warning,
    badgeKey: 'label.paused',
  },
};

export const DEFAULT_PIPELINE_PRESENTATION: AssetHealthTonePresentation = {
  tone: AssetHealthTone.Error,
  badgeKey: 'label.failed',
};

export const CONTRACT_STATUS_PRESENTATION: Partial<
  Record<ContractExecutionStatus, AssetHealthTonePresentation>
> = {
  [ContractExecutionStatus.Success]: {
    tone: AssetHealthTone.Success,
    badgeKey: 'label.passing',
  },
  [ContractExecutionStatus.Running]: {
    tone: AssetHealthTone.Info,
    badgeKey: 'label.running',
  },
  [ContractExecutionStatus.Queued]: {
    tone: AssetHealthTone.Info,
    badgeKey: 'label.queued',
  },
  [ContractExecutionStatus.PartialSuccess]: {
    tone: AssetHealthTone.Warning,
    badgeKey: 'label.partial-success',
  },
  [ContractExecutionStatus.Aborted]: {
    tone: AssetHealthTone.Error,
    badgeKey: 'label.failed-to-run',
  },
};

export const DEFAULT_CONTRACT_PRESENTATION: AssetHealthTonePresentation = {
  tone: AssetHealthTone.Error,
  badgeKey: 'label.breach',
};

export const PIPELINE_SUBTITLE_KEY = 'message.last-run-time';
