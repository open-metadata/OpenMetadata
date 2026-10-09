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
import { Grid } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';

import { forwardRef, useMemo } from 'react';
import { LandingPageWidgetKeys } from '../../../../enums/CustomizablePage.enum';
import { Document as DocStoreDocument } from '../../../../generated/entity/docStore/document';
import WidgetCard from '../WidgetCard/WidgetCard';
import './all-widgets-content.less';

interface AllWidgetsContentProps {
  addedWidgetsList?: string[];
  widgets: DocStoreDocument[];
  selectedWidgets: string[];
  onSelectWidget?: (id: string) => void;
}

const AllWidgetsContent = forwardRef<HTMLDivElement, AllWidgetsContentProps>(
  ({ widgets, addedWidgetsList, selectedWidgets, onSelectWidget }, ref) => {
    const widgetsList = useMemo(() => {
      return widgets.map((widget) => {
        const isAlreadyAdded = addedWidgetsList?.some(
          (addedWidgetId) =>
            addedWidgetId.startsWith(widget.fullyQualifiedName ?? '') &&
            !addedWidgetId.includes(LandingPageWidgetKeys.CURATED_ASSETS)
        );
        const isSelected = selectedWidgets.includes(widget.id ?? '');

        return (
          <Grid.Item
            className="layout-column tw:col-span-24 tw:min-[576px]:col-span-24 tw:min-[768px]:col-span-12 tw:min-[992px]:col-span-8 d-flex"
            data-widget-key={widget.fullyQualifiedName}
            key={widget.id}>
            <WidgetCard
              isSelected={isAlreadyAdded || isSelected}
              widget={widget}
              onSelectWidget={onSelectWidget}
            />
          </Grid.Item>
        );
      });
    }, [widgets, addedWidgetsList, selectedWidgets, onSelectWidget]);

    return (
      <Grid
        className="layout-row layout-grid all-widgets-grid p-r-xs overflow-y-auto"
        ref={ref}
        style={getLayoutGutter(20, 20)}>
        {widgetsList}
      </Grid>
    );
  }
);

export default AllWidgetsContent;
