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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Row, Typography } from 'antd';
import classNames from 'classnames';
import { FC } from 'react';
import './header-card.less';
import { HeaderCardProps } from './HeaderCard.interface';

const { Title, Paragraph } = Typography;

const HeaderCard: FC<HeaderCardProps> = ({
  title,
  description,
  addLabel,
  onAdd,
  disabled = false,
  className,
  gradient,
  showAddButton = true,
}) => {
  const cardStyle = gradient ? { background: gradient } : undefined;

  return (
    <Row
      className={classNames('header-card', className)}
      data-testid="header-card"
      style={cardStyle}>
      <div className="header-card-content">
        <div className="header-card-text">
          <Title className="header-card-title" level={2}>
            {title}
          </Title>
          <Paragraph className="header-card-description">
            {description}
          </Paragraph>
        </div>
        {showAddButton && addLabel && onAdd && (
          <div className="header-card-actions">
            <Button
              data-testid="add-button"
              disabled={disabled}
              icon={<PlusOutlined />}
              type="primary"
              onClick={onAdd}>
              {addLabel}
            </Button>
          </div>
        )}
      </div>
    </Row>
  );
};

export default HeaderCard;
