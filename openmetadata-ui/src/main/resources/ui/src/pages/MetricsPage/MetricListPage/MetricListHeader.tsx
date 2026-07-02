/*
 *  Copyright 2024 Collate.
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

import { Button, Dropdown } from '@openmetadata/ui-core-components';
import {
  Download01,
  File06,
  Plus,
  Trash01,
  UploadCloud01,
} from '@untitledui/icons';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import LimitWrapper from '../../../hoc/LimitWrapper';

export interface MetricListHeaderProps {
  permission: OperationPermission;
  isActionsOpen: boolean;
  onActionsOpenChange: (open: boolean) => void;
  isExporting: boolean;
  onExport: () => void;
  onImport: () => void;
  onAddMetric: () => void;
}

const MetricListHeader: FC<MetricListHeaderProps> = ({
  permission,
  isActionsOpen,
  onActionsOpenChange,
  isExporting,
  onExport,
  onImport,
  onAddMetric,
}) => {
  const { t } = useTranslation();

  return (
    <div className="d-flex justify-between">
      <PageHeader
        data={{
          header: t('label.metric-plural'),
          subHeader: t('message.metric-description'),
        }}
        learningPageId={LEARNING_PAGE_IDS.METRICS}
        title={t('label.metric')}
      />
      <div className="d-flex gap-2 metric-list-actions">
        {permission.Create && (
          <LimitWrapper resource="metric">
            <Button
              className="metric-list-add-button"
              color="primary"
              data-testid="create-metric"
              iconLeading={Plus}
              size="sm"
              onPress={onAddMetric}>
              {t('label.add-entity', { entity: t('label.metric') })}
            </Button>
          </LimitWrapper>
        )}
        {permission.EditAll && (
          <Dropdown.Root isOpen={isActionsOpen} onOpenChange={onActionsOpenChange}>
            <Dropdown.DotsButton
              className="metric-list-kebab"
              data-testid="metric-actions"
            />
            <Dropdown.Popover className="metric-actions-menu">
              <div className="metric-actions-menu-content">
                <button
                  aria-busy={isExporting}
                  className="metric-actions-menu-item"
                  disabled={isExporting}
                  type="button"
                  onClick={onExport}>
                  <span className="metric-actions-icon">
                    <Download01 size={18} />
                  </span>
                  <span>
                    <span className="metric-actions-title">
                      {t('label.export')}
                    </span>
                    <span className="metric-actions-description">
                      {t('message.metrics-export-description')}
                    </span>
                  </span>
                </button>
                <button
                  className="metric-actions-menu-item"
                  type="button"
                  onClick={onImport}>
                  <span className="metric-actions-icon">
                    <UploadCloud01 size={18} />
                  </span>
                  <span>
                    <span className="metric-actions-title">
                      {t('label.import')}
                    </span>
                    <span className="metric-actions-description">
                      {t('message.metrics-import-description')}
                    </span>
                  </span>
                </button>
                <span className="metric-actions-separator" />
                <button className="metric-actions-menu-item" type="button">
                  <span className="metric-actions-icon">
                    <File06 size={18} />
                  </span>
                  <span>
                    <span className="metric-actions-title">
                      {t('label.rename')}
                    </span>
                    <span className="metric-actions-description">
                      {t('message.metrics-rename-collection-description')}
                    </span>
                  </span>
                </button>
                <button
                  className="metric-actions-menu-item metric-actions-menu-item-danger"
                  type="button">
                  <span className="metric-actions-icon">
                    <Trash01 size={18} />
                  </span>
                  <span>
                    <span className="metric-actions-title">
                      {t('label.delete')}
                    </span>
                    <span className="metric-actions-description">
                      {t('message.metrics-delete-collection-description')}
                    </span>
                  </span>
                </button>
              </div>
            </Dropdown.Popover>
          </Dropdown.Root>
        )}
      </div>
    </div>
  );
};

export default MetricListHeader;
