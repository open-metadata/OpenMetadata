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
  Card,
  Collapse,
  Popover,
  Radio,
  RadioChangeEvent,
  Space,
  Spin,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import React, { useState } from 'react';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { Tag } from '../../../generated/entity/classification/tag';
import { getTags } from '../../../rest/tagAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import RichTextEditorPreviewer from '../RichTextEditor/RichTextEditorPreviewer';
import './tier-card.style.less';
import { CardWithListItems, TierCardProps } from './TierCard.interface';

const { Panel } = Collapse;
const TierCard = ({ currentTier, updateTier, children }: TierCardProps) => {
  const [tiers, setTiers] = useState<Array<Tag>>([]);
  const [tierCardData, setTierCardData] = useState<Array<CardWithListItems>>(
    []
  );
  const [isLoadingTierData, setIsLoadingTierData] = useState<boolean>(false);

  const getTierData = async () => {
    setIsLoadingTierData(true);
    try {
      const { data } = await getTags({
        parent: 'Tier',
      });

      if (data) {
        const tierData: CardWithListItems[] =
          data.map((tier: { name: string; description: string }) => ({
            id: `Tier${FQN_SEPARATOR_CHAR}${tier.name}`,
            title: getEntityName(tier),
            description: tier.description.substring(
              0,
              tier.description.indexOf('\n\n')
            ),
            data: tier.description.substring(
              tier.description.indexOf('\n\n') + 1
            ),
          })) ?? [];
        setTierCardData(tierData);
        setTiers(data);
      } else {
        setTierCardData([]);
      }
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.tier-plural-lowercase'),
        })
      );
    } finally {
      setIsLoadingTierData(false);
    }
  };

  const updateTierData = async (value?: string) => {
    setIsLoadingTierData(true);
    const tier = tiers.find((tier) => tier.fullyQualifiedName === value);
    await updateTier?.(tier);
    setIsLoadingTierData(false);
  };

  const handleTierSelection = async ({
    target: { value },
  }: RadioChangeEvent) => {
    updateTierData(value);
  };

  return (
    <Popover
      className="p-0"
      content={
        <Card
          className="tier-card"
          data-testid="cards"
          title={
            <Space className="w-full p-xs justify-between">
              <Typography.Text className="m-b-0 font-medium text-md">
                {t('label.edit-entity', { entity: t('label.tier') })}
              </Typography.Text>
              <Typography.Text
                className="m-b-0 font-normal text-primary cursor-pointer"
                data-testid="clear-tier"
                // we need to pass undefined to clear the tier
                onClick={() => updateTierData()}>
                {t('label.clear')}
              </Typography.Text>
            </Space>
          }>
          <Spin
            indicator={<Loader size="small" />}
            spinning={isLoadingTierData}>
            <Radio.Group value={currentTier} onChange={handleTierSelection}>
              <Collapse
                accordion
                className="bg-white border-none"
                collapsible="icon"
                defaultActiveKey={currentTier}
                expandIconPosition="end">
                {tierCardData.map((card) => (
                  <Panel
                    data-testid="card-list"
                    header={
                      <Radio
                        className="radio-input"
                        data-testid={`radio-btn-${card.title}`}
                        value={card.id}>
                        <Space direction="vertical" size={0}>
                          <Typography.Paragraph className="m-b-0 font-regular text-grey-body">
                            {card.title}
                          </Typography.Paragraph>
                          <Typography.Paragraph className="m-b-0 font-regular text-xs text-grey-muted">
                            {card.description.replace(/\*/g, '')}
                          </Typography.Paragraph>
                        </Space>
                      </Radio>
                    }
                    key={card.id}>
                    <div className="m-l-md">
                      <RichTextEditorPreviewer
                        className="tier-card-description"
                        enableSeeMoreVariant={false}
                        markdown={card.data}
                      />
                    </div>
                  </Panel>
                ))}
              </Collapse>
            </Radio.Group>
          </Spin>
        </Card>
      }
      overlayClassName="tier-card-popover"
      placement="bottomRight"
      showArrow={false}
      trigger="click"
      onOpenChange={(visible) =>
        visible && !tierCardData.length && getTierData()
      }>
      {children}
    </Popover>
  );
};

export default TierCard;
