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

import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Button,
  Card,
  Col,
  Collapse,
  Popover,
  Row,
  Space,
  Typography,
} from 'antd';
import { ReactComponent as IconRemove } from 'assets/svg/ic-remove.svg';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import Loader from 'components/Loader/Loader';
import { t } from 'i18next';
import { LoadingState } from 'Models';
import React, { useCallback, useEffect, useState } from 'react';
import { getTags } from 'rest/tagAPI';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';
import './tier-card.style.less';
import { CardWithListItems, TierCardProps } from './TierCard.interface';

const { Panel } = Collapse;
const TierCard = ({ currentTier, updateTier, children }: TierCardProps) => {
  const [tierData, setTierData] = useState<Array<CardWithListItems>>([]);
  const [activeTier, setActiveTier] = useState(currentTier);
  const [statusTier, setStatusTier] = useState<LoadingState>('initial');
  const [isLoadingTierData, setIsLoadingTierData] = useState<boolean>(false);

  const handleCardSelection = (cardId: string) => {
    setActiveTier(cardId);
  };

  const setInitialTierLoadingState = () => {
    setStatusTier('initial');
  };

  const getTierData = () => {
    setIsLoadingTierData(true);
    getTags({
      parent: 'Tier',
    })
      .then(({ data }) => {
        if (data) {
          const tierData: CardWithListItems[] =
            data.map((tier: { name: string; description: string }) => ({
              id: `Tier${FQN_SEPARATOR_CHAR}${tier.name}`,
              title: tier.name,
              description: tier.description.substring(
                0,
                tier.description.indexOf('\n\n')
              ),
              data: tier.description.substring(
                tier.description.indexOf('\n\n') + 1
              ),
            })) ?? [];
          setTierData(tierData);
        } else {
          setTierData([]);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.tier-plural-lowercase'),
          })
        );
      })
      .finally(() => {
        setIsLoadingTierData(false);
      });
  };

  const prepareTier = (updatedTier: string) => {
    return updatedTier !== currentTier ? updatedTier : undefined;
  };

  const handleTierSave = (updatedTier: string) => {
    setStatusTier('waiting');

    const newTier = prepareTier(updatedTier);
    updateTier?.(newTier as string);
  };

  const getTierSelectButton = (tier: string) => {
    switch (statusTier) {
      case 'waiting':
        return (
          <Loader
            className="d-inline-block"
            size="small"
            style={{ marginBottom: '-4px' }}
            type="default"
          />
        );

      case 'success':
        return (
          <Icon
            className="text-xl"
            component={IconRemove}
            data-testid="remove-tier"
            onClick={() => updateTier?.()}
          />
        );

      default:
        return (
          <Button
            data-testid="select-tier-button"
            size="small"
            type="primary"
            onClick={() => handleTierSave(tier)}>
            {t('label.select')}
          </Button>
        );
    }
  };

  const getCardIcon = useCallback(
    (cardId: string) => {
      const isSelected = currentTier === cardId;
      const isActive = activeTier === cardId;

      if ((isSelected && isActive) || isSelected) {
        return (
          <Icon
            className="text-xl"
            component={IconRemove}
            data-testid="remove-tier"
            onClick={() => updateTier?.()}
          />
        );
      } else if (isActive) {
        return getTierSelectButton(cardId);
      } else {
        return (
          <Button
            ghost
            data-testid="select-tier-button"
            size="small"
            type="primary"
            onClick={() => handleTierSave(cardId)}>
            {t('label.select')}
          </Button>
        );
      }
    },
    [currentTier, activeTier]
  );

  useEffect(() => {
    setActiveTier(currentTier);
    if (statusTier === 'waiting') {
      setStatusTier('success');
      setTimeout(() => {
        setInitialTierLoadingState();
      }, 300);
    }
  }, [currentTier]);

  return (
    <Popover
      content={
        <Card
          className="tier-card"
          data-testid="cards"
          headStyle={{
            borderBottom: 'none',
            paddingLeft: '16px',
            paddingTop: '12px',
          }}
          title={
            <Row>
              <Col span={21}>
                <Typography.Title className="m-b-0" level={5}>
                  {t('label.edit-entity', { entity: t('label.tier') })}
                </Typography.Title>
              </Col>
            </Row>
          }>
          <Collapse
            accordion
            className="collapse-container"
            defaultActiveKey={currentTier}
            onChange={(key) => handleCardSelection(key as string)}>
            {tierData.map((card) => (
              <Panel
                className={classNames('collapse-tier-panel', {
                  selected: currentTier === card.id,
                })}
                data-testid="card-list"
                extra={<div data-testid="icon">{getCardIcon(card.id)}</div>}
                header={
                  <Space direction="vertical" size={0}>
                    <Typography.Paragraph className="m-b-0 text-color-inherit text-base font-semibold">
                      {card.title}
                    </Typography.Paragraph>
                    <Typography.Paragraph className="m-b-0 text-color-inherit font-medium">
                      {card.description.replace(/\*/g, '')}
                    </Typography.Paragraph>
                  </Space>
                }
                key={card.id}>
                <RichTextEditorPreviewer
                  enableSeeMoreVariant={false}
                  markdown={card.data}
                />
              </Panel>
            ))}
          </Collapse>
          {isLoadingTierData && <Loader />}
        </Card>
      }
      data-testid="tier-card-container"
      overlayClassName="tier-card-container"
      placement="bottomRight"
      showArrow={false}
      trigger="click"
      onOpenChange={(visible) => visible && !tierData.length && getTierData()}>
      {children}
    </Popover>
  );
};

export default TierCard;
