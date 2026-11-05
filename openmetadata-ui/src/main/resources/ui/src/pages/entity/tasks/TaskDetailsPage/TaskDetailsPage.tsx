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

import { Card, PageLayout } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import DocumentTitle from '../../../../components/common/DocumentTitle/DocumentTitle';
import TaskDetailPanel from '../../../../components/discovery/personal-space/InboxPage/components/TaskDetailPanel';

const TaskDetailsPage = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const { t } = useTranslation();

  return (
    <PageLayout data-testid="task-details-page">
      <DocumentTitle title={t('label.task')} />
      <PageLayout.PageHeader title={t('label.task')} />
      <PageLayout.Content>
        <Card className="tw:h-full tw:min-h-0">
          {taskId && <TaskDetailPanel key={taskId} taskId={taskId} />}
        </Card>
      </PageLayout.Content>
    </PageLayout>
  );
};

export default TaskDetailsPage;
