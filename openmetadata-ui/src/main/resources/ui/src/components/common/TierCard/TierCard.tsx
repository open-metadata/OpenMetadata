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
  Col,
  Collapse,
  Popover,
  Radio,
  RadioChangeEvent,
  Row,
  Space,
  Typography,
} from 'antd';
import classNames from 'classnames';
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
        err,
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
      content={
        <Card
          className="tier-card"
          data-testid="cards"
          title={
            <Row style={{ padding: '10px 8px' }}>
              <Col span={21}>
                <Typography.Title className="m-b-0" level={5}>
                  {t('label.edit-entity', { entity: t('label.tier') })}
                </Typography.Title>
              </Col>
              <Col span={2}>
                <Typography.Title
                  className="m-b-0 clear-tier-selection"
                  level={5}
                  onClick={clearTierSelection}>
                  {t('Clear')}
                </Typography.Title>
              </Col>
            </Row>
          }>
          <Radio.Group value={currentTier} onChange={handleTierSelection}>
            <Collapse
              accordion
              className="collapse-container"
              defaultActiveKey={currentTier}
              expandIconPosition="end">
              {tierData.map((card) => (
                <Panel
                  className={classNames('collapse-tier-panel', {
                    selected: currentTier === card.id,
                  })}
                  data-testid="card-list"
                  header={
                    <Space direction="horizontal">
                      <Radio data-testid="radio-btn" value={card.id} />
                      <Space direction="vertical" size={0}>
                        <Typography.Paragraph className="m-b-0 text-color-inherit font-semibold">
                          {card.title}
                        </Typography.Paragraph>
                        <Typography.Paragraph className="m-b-0 font-small">
                          {card.description.replace(/\*/g, '')}
                        </Typography.Paragraph>
                      </Space>
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
          </Radio.Group>
          {isLoadingTierData && <Loader />}
        </Card>
      }
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
