/*
 *  Copyright 2022 Collate.
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

import {
  CheckCircleOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Button, Space } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import React, { FunctionComponent } from 'react';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../../Loader/Loader';
import { Props } from './CardWithListItem.interface';
import { cardStyle } from './CardWithListItem.style';

const CardListItem: FunctionComponent<Props> = ({
  card,
  index,
  isActive,
  isSelected,
  onCardSelect,
  onSave,
  tierStatus,
  className,
  onRemove,
}: Props) => {
  const getCardBodyStyle = () => {
    const activeStyle = isActive ? cardStyle.active : cardStyle.default;

    return isSelected ? cardStyle.selected : activeStyle;
  };

  const getCardHeaderStyle = () => {
    const activeHeaderStyle = isActive
      ? cardStyle.header.active
      : cardStyle.header.default;

    return isSelected ? cardStyle.header.selected : activeHeaderStyle;
  };

  const getTierSelectButton = (tier: string) => {
    switch (tierStatus) {
      case 'waiting':
        return (
          <Loader
            className="tw-inline-block"
            size="small"
            style={{ marginBottom: '-4px' }}
            type="default"
          />
        );

      case 'success':
        return <CheckCircleOutlined className="tw-text-h4" />;

      default:
        return (
          <Button
            data-testid="select-tier-button"
            size="small"
            type="primary"
            onClick={() => onSave(tier)}>
            {t('label.select')}
          </Button>
        );
    }
  };

  const getCardIcon = (cardId: string) => {
    if (isSelected && isActive) {
      return (
        <Space align="center">
          <Button danger size="small" type="primary" onClick={onRemove}>
            {t('label.remove')}
          </Button>
          <CheckCircleOutlined className="tw-text-h4" />
        </Space>
      );
    } else if (isSelected) {
      return <CheckCircleOutlined className="tw-text-h4" />;
    } else if (isActive) {
      return getTierSelectButton(cardId);
    } else {
      return (
        <Button
          data-testid="select-tier-button"
          size="small"
          type="text"
          onClick={() => onSave(cardId)}>
          {t('label.select')}
        </Button>
      );
    }
  };

  const handleCardSelect = () => {
    onCardSelect(card.id);
  };

  return (
    <div
      className={classNames(cardStyle.base, getCardBodyStyle(), className)}
      data-testid="card-list"
      onClick={handleCardSelect}>
      <div
        className={classNames(
          cardStyle.header.base,
          getCardHeaderStyle(),
          index === 0 ? (isActive ? 'tw-rounded-t-md' : 'tw-rounded-t') : null
        )}>
        <div className="tw-flex">
          <div className="tw-self-start tw-mr-2">
            {isActive ? (
              <DownOutlined className="tw-text-xs" />
            ) : (
              <RightOutlined className="tw-text-xs" />
            )}
          </div>
          <div className="tw-flex tw-flex-col">
            <p className={cardStyle.header.title}>{card.title}</p>
            <p className={cardStyle.header.description}>
              {card.description.replace(/\*/g, '')}
            </p>
          </div>
        </div>
        <div data-testid="icon">{getCardIcon(card.id)}</div>
      </div>
      <div
        className={classNames(
          cardStyle.body.base,
          isActive ? cardStyle.body.active : cardStyle.body.default
        )}>
        <RichTextEditorPreviewer
          enableSeeMoreVariant={false}
          markdown={card.data}
        />
      </div>
    </div>
  );
};

export default CardListItem;
