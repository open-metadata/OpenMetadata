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

import { Button, Card } from '@openmetadata/ui-core-components';
import { Plus, XClose } from '@untitledui/icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { QueryBuilderSection } from './QueryBuilderSection';

interface EventTriggerFilterSectionProps {
  triggerFilter?: string;
  onTriggerFilterChange?: (filter: string) => void;
  entityType?: EntityType;
  lockFields?: boolean;
}

export const EventTriggerFilterSection: React.FC<
  EventTriggerFilterSectionProps
> = ({
  triggerFilter = '',
  onTriggerFilterChange,
  entityType = EntityType.ALL,
  lockFields = false,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const controlsDisabled = isFormDisabled || lockFields;
  const [showFilter, setShowFilter] = useState(
    triggerFilter && triggerFilter.trim() !== ''
  );

  const hasFilter = triggerFilter && triggerFilter.trim() !== '';

  useEffect(() => {
    if (hasFilter) {
      setShowFilter(true);
    }
  }, [hasFilter]);

  const handleClearFilter = () => {
    onTriggerFilterChange?.('');
    setShowFilter(false);
  };

  const handleAddFilter = () => {
    setShowFilter(true);
  };

  if (!showFilter && !hasFilter) {
    return (
      <div className="tw:mt-6">
        <Button
          className="tw:w-full"
          color="secondary"
          data-testid="add-event-filter-button"
          iconLeading={Plus}
          isDisabled={controlsDisabled}
          size="sm"
          onPress={handleAddFilter}>
          {t('label.add-asset-filter')}
        </Button>
      </div>
    );
  }

  return (
    <div className="tw:mt-6">
      <Card className="tw:p-4">
        <div className="tw:flex tw:items-center tw:gap-1.5 tw:mb-3">
          <Button
            color="tertiary"
            iconLeading={XClose}
            isDisabled={controlsDisabled}
            size="sm"
            onPress={handleClearFilter}
          />
        </div>

        <div className="tw:mt-4">
          <QueryBuilderSection
            entityTypes={entityType}
            forceReadOnly={lockFields}
            label="Filter"
            outputType={SearchOutputType.ElasticSearch}
            value={triggerFilter}
            onChange={(value: string) => {
              onTriggerFilterChange?.(value || '');
            }}
          />
        </div>
      </Card>
    </div>
  );
};
