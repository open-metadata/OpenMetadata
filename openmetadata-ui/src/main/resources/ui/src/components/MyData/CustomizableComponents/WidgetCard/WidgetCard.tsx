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
import Icon from '@ant-design/icons';
import { Card, Typography } from 'antd';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/ic-check-circle-new.svg';
import { Document as DocStoreDocument } from '../../../../generated/entity/docStore/document';
import './widget-card.less';

interface WidgetCardProps {
  widget: DocStoreDocument;
  isSelected: boolean;
  onSelectWidget?: (id: string) => void;
}

const WidgetCard = ({
  widget,
  isSelected,
  onSelectWidget,
}: WidgetCardProps) => {
  const handleClick = () => {
    onSelectWidget?.(widget.id ?? '');
  };

  return (
    <Card
      className={`widget-card ${isSelected ? 'selected' : ''}`}
      data-testid="widget-card"
      onClick={handleClick}>
      <div className="widget-card-content">
        <Typography.Text strong>{widget.name}</Typography.Text>
        {isSelected && (
          <div className="check-box bg-white">
            <Icon className="check-icon" component={CheckIcon} />
          </div>
        )}
      </div>
      <Typography.Paragraph
        className="widget-desc"
        data-testid="widget-description">
        {widget.description ?? 'No description available.'}
      </Typography.Paragraph>
    </Card>
  );
};

export default WidgetCard;
