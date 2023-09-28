/*
 *  Copyright 2023 Collate.
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
import { FilterOutlined } from '@ant-design/icons';
import { Button, Checkbox, List, Popover, Space, Typography } from 'antd';
import { FeedFilter } from 'enums/mydata.enum';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './feeds-filter-popover.less';
import { FeedsFilterPopoverProps } from './FeedsFilterPopover.interface';

const FeedsFilterPopover = ({ onUpdate }: FeedsFilterPopoverProps) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FeedFilter>(
    FeedFilter.ALL
  );

  const items = [
    {
      title: t('label.all'),
      key: FeedFilter.OWNER_OR_FOLLOWS,
      description: 'All feeds',
    },
    {
      title: t('label.my-data'),
      key: FeedFilter.OWNER,
      description: 'Owner',
    },
    {
      title: t('label.following'),
      key: FeedFilter.FOLLOWS,
      description: t('label.following'),
    },
  ];

  const onFilterUpdate = useCallback(() => {
    setPopupVisible(false);
    onUpdate(selectedFilter);
  }, [selectedFilter, onUpdate, setPopupVisible]);

  const listElement = (
    <List
      bordered
      dataSource={items}
      footer={
        <div className="d-flex justify-between">
          <Button
            color="primary"
            data-testid="clear-all-button"
            size="small"
            type="text">
            {t('label.clear-entity', { entity: t('label.all-lowercase') })}
          </Button>
          <Space className="m-l-auto text-right">
            <Button color="primary" data-testid="cancel-button" size="small">
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="selectable-list-update-btn"
              size="small"
              type="primary"
              onClick={onFilterUpdate}>
              {t('label.update')}
            </Button>
          </Space>
        </div>
      }
      header={
        <Typography.Text className="font-medium">
          {t('label.feed-filter-plural')}
        </Typography.Text>
      }
      renderItem={(item) => (
        <List.Item
          className="selectable-list-item cursor-pointer"
          key={item.key}
          title="All"
          onClick={() => setSelectedFilter(item.key)}>
          <Space align="start">
            <Checkbox checked={selectedFilter === item.key} />
            <Space direction="vertical" size={0}>
              <Typography.Text>{item.title}</Typography.Text>
              <Typography.Text className="text-muted text-xs">
                {item.description}
              </Typography.Text>
            </Space>
          </Space>
        </List.Item>
      )}
    />
  );

  return (
    <Popover
      destroyTooltipOnHide
      content={listElement}
      open={popupVisible}
      overlayClassName="feeds-filter-popover"
      placement="bottomRight"
      showArrow={false}
      trigger="click"
      onOpenChange={setPopupVisible}>
      <Button icon={<FilterOutlined />}>{t('label.filter-plural')}</Button>
    </Popover>
  );
};

export default FeedsFilterPopover;
