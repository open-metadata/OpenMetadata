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
import { lazy } from 'react';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import { EntityDetailWidgetSkeleton } from '../../../common/Skeleton/EntityDetailWidgetSkeleton/EntityDetailWidgetSkeleton.component';
import { CommonWidgetComponent } from '../CommonWidgets.types';

const TierWidgetLazy = withSuspenseFallback(
  lazy(() => import('../../../common/TierWidget/TierWidget')),
  <EntityDetailWidgetSkeleton />
);

export const TierWidget: CommonWidgetComponent = () => <TierWidgetLazy />;
