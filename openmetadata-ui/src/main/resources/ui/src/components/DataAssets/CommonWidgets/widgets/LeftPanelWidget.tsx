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
import { noop } from 'lodash';
import { lazy } from 'react';
import { ENTITY_PAGE_TYPE_MAP } from '../../../../constants/Customize.constants';
import type { WidgetConfig } from '../../../../interface/customization.interface';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import { EntityDetailWidgetSkeleton } from '../../../common/Skeleton/EntityDetailWidgetSkeleton/EntityDetailWidgetSkeleton.component';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { CommonWidgetComponent, GenericEntity } from '../CommonWidgets.types';

const LeftPanelContainer = withSuspenseFallback(
  lazy(() =>
    import('../../../Customization/GenericTab/LeftPanelContainer').then(
      (m) => ({
        default: m.LeftPanelContainer,
      })
    )
  ),
  <EntityDetailWidgetSkeleton />
);

// Stable-identity fallback so LeftPanelContainer's `[layout, type, isEditView]`
// memo doesn't invalidate every render when children is undefined.
const EMPTY_LAYOUT: WidgetConfig[] = [];

export const LeftPanelWidget: CommonWidgetComponent = ({ widgetConfig }) => {
  const { type } = useGenericContext<GenericEntity>();

  return (
    <LeftPanelContainer
      isEditView={false}
      layout={widgetConfig.children ?? EMPTY_LAYOUT}
      type={ENTITY_PAGE_TYPE_MAP[type]}
      onUpdate={noop}
    />
  );
};
