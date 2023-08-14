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
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import Loader from 'components/Loader/Loader';
import { t } from 'i18next';
import React, { useState } from 'react';
import { getTags } from 'rest/tagAPI';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';
import './tier-card.style.less';
import { CardWithListItems, TierCardProps } from './TierCard.interface';

const { Panel } = Collapse;
const TierCard = ({ currentTier, updateTier, children }: TierCardProps) => {
  const [tierData, setTierData] = useState<Array<CardWithListItems>>([]);
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

  const handleTierSelection = ({ target: { value } }: RadioChangeEvent) => {
    updateTier?.(value as string);
  };

  const clearTierSelection = () => {
    updateTier?.();
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
                onClick={clearTierSelection}>
                {t('label.clear')}
              </Typography.Text>
            </Space>
          }>
          <Radio.Group value={currentTier} onChange={handleTierSelection}>
            <Collapse
              accordion
              className="bg-white border-none"
              defaultActiveKey={currentTier}
              expandIconPosition="end">
              {tierData.map((card) => (
                <Panel
                  data-testid="card-list"
                  header={
                    <div className="flex self-start">
                      <Radio
                        className="radio-input"
                        data-testid={`radio-btn-${card.title}`}
                        value={card.id}
                      />
                      <Space direction="vertical" size={0}>
                        <Typography.Paragraph className="m-b-0 font-regular text-grey-body">
                          {card.title}
                        </Typography.Paragraph>
                        <Typography.Paragraph className="m-b-0 font-regular text-xs text-grey-muted">
                          {card.description.replace(/\*/g, '')}
                        </Typography.Paragraph>
                      </Space>
                    </div>
                  }
                  key={card.id}>
                  <RichTextEditorPreviewer
                    className="tier-card-description"
                    enableSeeMoreVariant={false}
                    markdown={card.data}
                  />
                </Panel>
              ))}
            </Collapse>
          </Radio.Group>
          {isLoadingTierData && <Loader />}
        </Card>
      }
      overlayClassName="tier-card-popover"
      placement="bottomRight"
      showArrow={false}
      trigger="click"
      onOpenChange={(visible) => visible && !tierData.length && getTierData()}>
      {children}
    </Popover>
  );
};

export default TierCard;
