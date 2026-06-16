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

import { lazy, Suspense } from 'react';
import { DomainLabelProps } from '../components/common/DomainLabel/DomainLabel.interface';
import { EntityType } from '../enums/entity.enum';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';

const CommonWidgets = lazy(() =>
  import('../components/DataAssets/CommonWidgets/CommonWidgets').then((m) => ({
    default: m.CommonWidgets,
  }))
);

const DomainLabelV2 = lazy(() =>
  import('../components/DataAssets/DomainLabelV2/DomainLabelV2').then((m) => ({
    default: m.DomainLabelV2,
  }))
);

const OwnerLabelV2 = lazy(() =>
  import('../components/DataAssets/OwnerLabelV2/OwnerLabelV2').then((m) => ({
    default: m.OwnerLabelV2,
  }))
);

interface LazyCommonWidgetsProps {
  widgetConfig: WidgetConfig;
  entityType: EntityType;
  showTaskHandler?: boolean;
}

interface LazyOwnerLabelV2Props {
  dataTestId?: string;
  hasPermission?: boolean;
}

export const LazyCommonWidgets = (props: LazyCommonWidgetsProps) => (
  <Suspense fallback={null}>
    <CommonWidgets {...props} />
  </Suspense>
);

export const LazyDomainLabelV2 = (props: Partial<DomainLabelProps>) => (
  <Suspense fallback={null}>
    <DomainLabelV2 {...props} />
  </Suspense>
);

export const LazyOwnerLabelV2 = (props: LazyOwnerLabelV2Props) => (
  <Suspense fallback={null}>
    <OwnerLabelV2 {...props} />
  </Suspense>
);
