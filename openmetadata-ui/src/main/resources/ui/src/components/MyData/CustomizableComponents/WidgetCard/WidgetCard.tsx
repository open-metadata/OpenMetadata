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
import { CheckOutlined } from '@ant-design/icons';
import { Card, Typography } from 'antd';
import React from 'react';
import { Document } from '../../../../generated/entity/docStore/document';
import './widget-card.less';

interface WidgetCardProps {
  widget: Document;
  isSelected: boolean;
  onSelect: () => void;
}

const WidgetCard = ({ widget, isSelected, onSelect }: WidgetCardProps) => {
  return (
    <Card
      hoverable
      className={`widget-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}>
      <div className="widget-card-content">
        <Typography.Text strong>{widget.name}</Typography.Text>
        {isSelected && <CheckOutlined className="check-icon" />}
      </div>
      <Typography.Paragraph className="widget-desc">
        {widget.description || 'No description available.'}
      </Typography.Paragraph>
    </Card>
  );
};

export default WidgetCard;
