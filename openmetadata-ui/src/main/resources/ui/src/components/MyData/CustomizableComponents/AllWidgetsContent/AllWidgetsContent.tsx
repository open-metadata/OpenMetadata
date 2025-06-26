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
import React, { forwardRef } from 'react';
import { Document } from '../../../../generated/entity/docStore/document';
import WidgetCard from '../WidgetCard/WidgetCard';
import './all-widgets-content.less';

interface AllWidgetsContentProps {
  widgets: Document[];
  selectedWidgets: string[];
  onSelectWidget: (id: string) => void;
}

const AllWidgetsContent = forwardRef<HTMLDivElement, AllWidgetsContentProps>(
  ({ widgets, selectedWidgets, onSelectWidget }, ref) => {
    return (
      <Row className="all-widgets-grid" gutter={[20, 20]} ref={ref}>
        {widgets.map((widget) => (
          <Col
            data-widget-key={widget.fullyQualifiedName}
            key={widget.id}
            lg={8}
            md={12}
            sm={24}>
            <WidgetCard
              isSelected={selectedWidgets.includes(widget.id ?? '')}
              widget={widget}
              onSelect={() => onSelectWidget(widget.id ?? '')}
            />
          </Col>
        ))}
      </Row>
    );
  }
);

export default AllWidgetsContent;
