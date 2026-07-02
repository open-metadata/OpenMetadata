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

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Lineage from '../../../components/Lineage/Lineage.component';
import { SourceType } from '../../../components/SearchedData/SearchedData.interface';
import LineageProvider from '../../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../../enums/entity.enum';
import { Card, Typography } from '../components/AIGovUntitled.component';
import './asset-detail.less';
import { AIAssetEntityType, AIAssetView } from './AssetDetail.types';

interface LineageTabProps {
  view: AIAssetView;
}

const ENTITY_TYPE_MAP: Record<AIAssetEntityType, EntityType> = {
  aiApplication: EntityType.AI_APPLICATION,
  llmModel: EntityType.LLM_MODEL,
  mcpServer: EntityType.MCP_SERVER,
};

const LineageTab = ({ view }: LineageTabProps) => {
  const { t } = useTranslation();
  const entityType = ENTITY_TYPE_MAP[view.entityType];
  const sourceEntity = useMemo(
    () => view.source.entity as unknown as SourceType,
    [view.source.entity]
  );

  return (
    <Card bodyStyle={{ padding: 0 }}>
      <div className="ai-gov-lineage-head">
        <Typography.Text strong>{t('label.lineage')}</Typography.Text>
        <Typography.Text className="tw:block" type="secondary">
          {t('message.ai-asset-lineage-hint')}
        </Typography.Text>
      </div>
      <div className="ai-gov-lineage-canvas">
        <LineageProvider>
          <Lineage
            entity={sourceEntity}
            entityType={entityType}
            hasEditAccess={false}
          />
        </LineageProvider>
      </div>
    </Card>
  );
};

export default LineageTab;
