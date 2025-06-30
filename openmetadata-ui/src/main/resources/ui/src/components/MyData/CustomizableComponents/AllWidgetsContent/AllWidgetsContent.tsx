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
import { Col, Row } from 'antd';
import { forwardRef, useMemo } from 'react';
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
        const isAlreadyAdded = addedWidgetsList?.some((addedWidgetId) =>
          addedWidgetId.startsWith(widget.fullyQualifiedName ?? '')
        );
        const isSelected = selectedWidgets.includes(widget.id ?? '');

        return (
          <Col
            className="d-flex"
            data-widget-key={widget.fullyQualifiedName}
            key={widget.id}
            lg={8}
            md={12}
            sm={24}>
            <WidgetCard
              isSelected={isAlreadyAdded || isSelected}
              widget={widget}
              onSelectWidget={onSelectWidget}
            />
          </Col>
        );
      });
    }, [widgets, addedWidgetsList, selectedWidgets, onSelectWidget]);

    return (
      <Row
        className="all-widgets-grid p-r-xs overflow-y-auto"
        gutter={[20, 20]}
        ref={ref}>
        {widgetsList}
      </Row>
    );
  }
);

export default AllWidgetsContent;
