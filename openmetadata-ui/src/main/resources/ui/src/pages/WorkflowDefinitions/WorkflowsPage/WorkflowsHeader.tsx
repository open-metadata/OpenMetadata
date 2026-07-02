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

import { Button } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';

export interface WorkflowsHeaderProps {
  allowCreateWorkflow: boolean;
  onNewWorkflow: () => void;
}

/**
 * Default (OSS) Workflows page header: the `bg-primary` rounded card with the
 * title + "New workflow" action. Collate swaps this for the gradient header
 * via `WorkflowClassCollate`. Must stay OSS-neutral.
 */
const WorkflowsHeader: FC<WorkflowsHeaderProps> = ({
  allowCreateWorkflow,
  onNewWorkflow,
}) => {
  const { t } = useTranslation();

  return (
    <div className="tw:px-6 tw:py-4 tw:bg-primary tw:rounded-xl tw:border tw:border-border-secondary tw:mb-4">
      <div className="tw:flex tw:items-center tw:justify-between">
        <PageHeader
          data={{
            header: t('label.workflow-plural'),
            subHeader: t('message.workflow-subtitle'),
          }}
          learningPageId={LEARNING_PAGE_IDS.WORKFLOWS}
          title={t('label.workflow-plural')}
        />
        {allowCreateWorkflow && (
          <Button
            data-testid="create-workflow-button"
            iconLeading={Plus}
            size="sm"
            onPress={onNewWorkflow}>
            {t('label.new-workflow')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default WorkflowsHeader;
