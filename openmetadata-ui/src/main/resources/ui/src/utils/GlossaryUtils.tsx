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
import { EntityType } from '../enums/entity.enum';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';

const CommonWidgets = withSuspenseFallback(
  lazy(() =>
    import('../components/DataAssets/CommonWidgets/CommonWidgets').then(
      (module) => ({ default: module.CommonWidgets })
    )
  )
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
