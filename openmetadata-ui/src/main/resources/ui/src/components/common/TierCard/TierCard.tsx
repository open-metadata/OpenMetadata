import { Card, Popover, Typography } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { TableDetail } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { getCategory } from '../../../axiosAPIs/tagAPI';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import jsonData from '../../../jsons/en';
import { showErrorToast } from '../../../utils/ToastUtils';
import CardListItem from '../../cardlist/CardListItem/CardWithListItem';
import { CardWithListItems } from '../../cardlist/CardListItem/CardWithListItem.interface';
import Loader from '../../Loader/Loader';
import { Status } from '../../ManageTab/ManageTab.interface';
import NonAdminAction from '../non-admin-action/NonAdminAction';
import './tier-card.css';

export interface TierCardProps {
  currentUser?: EntityReference;
  currentTier?: string;
  hideTier?: boolean;
  updateTier?: (value: string) => void;
  onSave?: (
    owner?: EntityReference,
    tier?: TableDetail['tier'],
    isJoinable?: boolean
  ) => Promise<void>;
}

const TierCard = ({
  currentUser,
  currentTier,
  hideTier,
  updateTier,
}: TierCardProps) => {
  const [tierData, setTierData] = useState<Array<CardWithListItems>>([]);
  const [owner, setOwner] = useState(currentUser);
  const [activeTier, setActiveTier] = useState(currentTier);
  const [statusTier, setStatusTier] = useState<Status>('initial');
  const [isLoadingTierData, setIsLoadingTierData] = useState<boolean>(false);

  const handleCardSelection = (cardId: string) => {
    setActiveTier(cardId);
  };

  const setInitialTierLoadingState = () => {
    setStatusTier('initial');
  };

  const getTierData = () => {
    setIsLoadingTierData(true);
    getCategory('Tier')
      .then((res: AxiosResponse) => {
        if (res.data) {
          const tierData = res.data.children.map(
            (tier: { name: string; description: string }) => ({
              id: `Tier${FQN_SEPARATOR_CHAR}${tier.name}`,
              title: tier.name,
              description: tier.description.substring(
                0,
                tier.description.indexOf('\n\n')
              ),
              data: tier.description.substring(
                tier.description.indexOf('\n\n') + 1
              ),
            })
          );

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
        title={<Typography.Title level={5}>Edit Tier</Typography.Title>}>
        {tierData.map((card, i) => (
          <NonAdminAction
            html={
              <Fragment>
                <p>You need to be owner to perform this action</p>
                <p>Claim ownership from above </p>
              </Fragment>
            }
            isOwner={Boolean(owner && !currentUser)}
            key={i}
            permission={Operation.EditTags}
            position="left">
            <CardListItem
              card={card}
              className={classNames(
                'tw-mb-0 tw-shadow tw-rounded-t-none pl-[16px]',
                {
                  'tw-rounded-t-md': i === 0,
                },
                {
                  'tw-rounded-b-md ': i === tierData.length - 1,
                }
              )}
              isActive={activeTier === card.id}
              isSelected={card.id === currentTier}
              tierStatus={statusTier}
              onCardSelect={handleCardSelection}
              onSave={handleTierSave}
            />
          </NonAdminAction>
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
    setOwner(currentUser);
    setActiveTier(currentTier);
    if (statusTier === 'waiting') {
      setStatusTier('success');
      setTimeout(() => {
        setInitialTierLoadingState();
      }, 300);
    }
  }, [currentTier]);

  return <Popover trigger="click">{getTierWidget()}</Popover>;
};

export default TierCard;
