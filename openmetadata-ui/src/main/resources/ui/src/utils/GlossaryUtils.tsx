/*
 *  Copyright 2022 Collate.
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
import { Card } from '@openmetadata/ui-core-components';
import { lazy } from 'react';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import { GlossaryTermDetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import type { DetailsTabItem } from './CustomizePage/CustomizePageEntityTabUtils';
import { t } from './i18next/LocalUtil';

const CommonWidgets = withSuspenseFallback(
  lazy(() =>
    import('../components/DataAssets/CommonWidgets/CommonWidgets').then(
      (module) => ({ default: module.CommonWidgets })
    )
  )
);

const TasksTab = withSuspenseFallback(
  lazy(
    () =>
      import('../components/discovery/personal-space/InboxPage/tabs/TasksTab')
  )
);

const TabsLabel = withSuspenseFallback(
  lazy(() => import('../components/common/TabsLabel/TabsLabel.component'))
);

const GlossaryTermTab = withSuspenseFallback(
  lazy(
    () =>
      import('../components/Glossary/GlossaryTermTab/GlossaryTermTab.component')
  )
);

export const getGlossaryWidgetFromKey = (widget: WidgetConfig) => {
  if (widget.i.startsWith(GlossaryTermDetailPageWidgetKeys.TERMS_TABLE)) {
    return <GlossaryTermTab isGlossary />;
  }

  return (
    <CommonWidgets
      showTaskHandler
      entityType={EntityType.GLOSSARY}
      widgetConfig={widget}
    />
  );
};

/**
 * The glossary's Review tab: the Inbox's task list, scoped to the tasks about this glossary and its
 * terms, where reviewers decide proposed terms. A system tab like Activity Feed, so a persona can
 * rename, move or hide it. Its badge counts the open tasks; `onTasksChange` runs when a decision
 * changes the list, to recount them.
 */
export const getReviewTab = ({
  activeTab,
  entityFqn,
  name,
  openTaskCount,
  onTasksChange,
}: {
  activeTab?: string;
  entityFqn: string;
  name?: string;
  openTaskCount?: number;
  onTasksChange?: () => void;
}): DetailsTabItem => ({
  key: EntityTabs.REVIEW,
  label: (
    <TabsLabel
      count={openTaskCount}
      id={EntityTabs.REVIEW}
      isActive={activeTab === EntityTabs.REVIEW}
      name={name ?? t('label.review')}
    />
  ),
  children: (
    <Card className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
      <TasksTab aboutEntity={entityFqn} onCountChange={onTasksChange} />
    </Card>
  ),
});
