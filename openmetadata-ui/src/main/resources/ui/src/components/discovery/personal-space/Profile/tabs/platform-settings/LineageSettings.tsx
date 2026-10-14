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

import { useTranslation } from 'react-i18next';
import {
  LineageLayer,
  LineageSettings as LineageSettingsConfig,
  PipelineViewMode,
} from '../../../../../../generated/configuration/lineageSettings';
import { SettingType } from '../../../../../../generated/settings/settings';
import { getSettingsByType } from '../../../../../../rest/settingConfigAPI';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';
import SettingValue from './SettingValue';
import { useEditHeaderAction } from './useEditHeaderAction';
import { useSettingsFetch } from './useSettingsFetch';

export const LINEAGE_LAYER_LABELS: Record<LineageLayer, string> = {
  [LineageLayer.EntityLineage]: 'label.entity-lineage',
  [LineageLayer.ColumnLevelLineage]: 'label.column-level-lineage',
  [LineageLayer.DataObservability]: 'label.data-observability',
};

export const PIPELINE_VIEW_MODE_LABELS: Record<PipelineViewMode, string> = {
  [PipelineViewMode.Edge]: 'label.edge',
  [PipelineViewMode.Node]: 'label.node',
};

export const fetchLineageSettings = async () =>
  (await getSettingsByType(
    SettingType.LineageSettings
  )) as LineageSettingsConfig;

const LineageSettings = (props: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSettingsFetch(fetchLineageSettings);
  useEditHeaderAction('lineage', isLoading, props);

  if (isLoading) {
    return <SettingsSkeleton rows={4} />;
  }

  return (
    <SettingsSection testId="lineage-settings" title={t('label.lineage')}>
      <ReadOnlyRow title={t('label.upstream-depth')}>
        <SettingValue
          testId="upstream-depth-value"
          value={config?.upstreamDepth?.toString()}
        />
      </ReadOnlyRow>
      <ReadOnlyRow title={t('label.downstream-depth')}>
        <SettingValue
          testId="downstream-depth-value"
          value={config?.downstreamDepth?.toString()}
        />
      </ReadOnlyRow>
      <ReadOnlyRow title={t('label.lineage-layer')}>
        <SettingValue
          testId="lineage-layer-value"
          value={
            config?.lineageLayer && t(LINEAGE_LAYER_LABELS[config.lineageLayer])
          }
        />
      </ReadOnlyRow>
      <ReadOnlyRow title={t('label.pipeline-view-mode')}>
        <SettingValue
          testId="pipeline-view-mode-value"
          value={
            config?.pipelineViewMode &&
            t(PIPELINE_VIEW_MODE_LABELS[config.pipelineViewMode])
          }
        />
      </ReadOnlyRow>
    </SettingsSection>
  );
};

export default LineageSettings;
