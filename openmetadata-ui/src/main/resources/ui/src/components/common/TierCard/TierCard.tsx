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

import { Button, Card, Col, Popover, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import { LoadingState, TableDetail } from 'Models';
import React, { useEffect, useState } from 'react';
import { getTags } from 'rest/tagAPI';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { EntityReference } from '../../../generated/type/entityReference';
import jsonData from '../../../jsons/en';
import { showErrorToast } from '../../../utils/ToastUtils';
import CardListItem from '../../cardlist/CardListItem/CardWithListItem';
import { CardWithListItems } from '../../cardlist/CardListItem/CardWithListItem.interface';
import Loader from '../../Loader/Loader';
import './tier-card.css';

export interface TierCardProps {
  currentTier?: string;
  hideTier?: boolean;
  updateTier?: (value: string) => void;
  onSave?: (
    owner?: EntityReference,
    tier?: TableDetail['tier'],
    isJoinable?: boolean
  ) => Promise<void>;
  removeTier?: () => void;
}

const TierCard = ({
  currentTier,
  hideTier,
  updateTier,
  removeTier,
}: TierCardProps) => {
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
          jsonData['api-error-messages']['fetch-tiers-error']
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
  const getTierCards = () => {
    return (
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
            <Col span={3}>
              {currentTier ? (
                <Button
                  className="font-medium"
                  data-testid="remove-tier"
                  type="link"
                  onClick={removeTier}>
                  {t('label.clear-entity', { entity: t('label.tier') })}
                </Button>
              ) : (
                ''
              )}
            </Col>
          </Row>
        }>
        {tierData.map((card, i) => (
          <CardListItem
            card={card}
            className={classNames(
              'tw-mb-0 tw-rounded-t-none pl-[16px]',
              {
                'tw-rounded-t-md': i === 0,
              },
              {
                'tw-rounded-b-md ': i === tierData.length - 1,
              }
            )}
            index={i}
            isActive={activeTier === card.id}
            isSelected={card.id === currentTier}
            key={i}
            tierStatus={statusTier}
            onCardSelect={handleCardSelection}
            onSave={handleTierSave}
          />
        ))}
      </Card>
    );
  };

  const getTierWidget = () => {
    if (hideTier) {
      return null;
    } else {
      return isLoadingTierData ? <Loader /> : getTierCards();
    }
  };

  useEffect(() => {
    if (!hideTier) {
      getTierData();
    }
  }, []);

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
    <Popover data-testid="tier-card-container" trigger="click">
      {getTierWidget()}
    </Popover>
  );
};

export default TierCard;
