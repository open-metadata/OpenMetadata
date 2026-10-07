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
          <div
            className="tw:flex"
            data-widget-key={widget.fullyQualifiedName}
            key={widget.id}>
            <WidgetCard
              isSelected={isAlreadyAdded || isSelected}
              widget={widget}
              onSelectWidget={onSelectWidget}
            />
          </div>
        );
      });
    }, [widgets, addedWidgetsList, selectedWidgets, onSelectWidget]);

    return (
      <div
        className="all-widgets-grid tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5 tw:overflow-y-auto tw:pr-1"
        ref={ref}>
        {widgetsList}
      </div>
    );
  }
);

export default AllWidgetsContent;
