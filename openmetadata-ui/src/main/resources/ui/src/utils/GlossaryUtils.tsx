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

const GlossaryReviewTab = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/governance/glossary/GlossaryReview/GlossaryReviewTab'
      )
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
 * Adds the Review tab after `afterKey`. It is added after a persona's tab customization so every
 * persona reaches the review queue.
 */
export const withReviewTab = <T extends DetailsTabItem>(
  tabs: T[],
  {
    activeTab,
    afterKey,
    pendingCount,
  }: { activeTab?: string; afterKey: EntityTabs; pendingCount: number }
): T[] => {
  const reviewTab = {
    key: EntityTabs.REVIEW,
    label: (
      <TabsLabel
        id={EntityTabs.REVIEW}
        isActive={activeTab === EntityTabs.REVIEW}
        name={t('label.review')}
        proposedCount={pendingCount}
      />
    ),
    children: <GlossaryReviewTab />,
  } as T;
  const index = tabs.findIndex((tab) => tab.key === afterKey) + 1;

  return [...tabs.slice(0, index), reviewTab, ...tabs.slice(index)];
};
