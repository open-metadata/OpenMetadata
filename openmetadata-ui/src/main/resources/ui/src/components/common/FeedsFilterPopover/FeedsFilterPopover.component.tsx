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
import {
  Button,
  Checkbox,
  List,
  Popover,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FilterIcon } from '../../../assets/svg/ic-feeds-filter.svg';
import { FeedFilter } from '../../../enums/mydata.enum';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import './feeds-filter-popover.less';
import { FeedsFilterPopoverProps } from './FeedsFilterPopover.interface';

const FeedsFilterPopover = ({
  defaultFilter,
  onUpdate,
}: FeedsFilterPopoverProps) => {
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] =
    useState<FeedFilter>(defaultFilter);

  const items = useMemo(
    () => [
      {
        title: t('label.all'),
        key: currentUser?.isAdmin
          ? FeedFilter.ALL
          : FeedFilter.OWNER_OR_FOLLOWS,
        description: t('message.feed-filter-all'),
      },
      {
        title: t('label.my-data'),
        key: FeedFilter.OWNER,
        description: t('message.feed-filter-owner'),
      },
      {
        title: t('label.following'),
        key: FeedFilter.FOLLOWS,
        description: t('message.feed-filter-following'),
      },
    ],
    [currentUser]
  );

  const onFilterUpdate = useCallback(() => {
    setPopupVisible(false);
    onUpdate(selectedFilter);
  }, [selectedFilter, onUpdate, setPopupVisible]);

  const listElement = useMemo(
    () => (
      <List
        bordered
        dataSource={items}
        footer={
          <Space className="w-full justify-end">
            <Button
              color="primary"
              data-testid="cancel-button"
              size="small"
              onClick={() => setPopupVisible(false)}>
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
                <Typography.Text className="font-medium">
                  {item.title}
                </Typography.Text>
                <Typography.Text className="text-muted text-xs">
                  {item.description}
                </Typography.Text>
              </Space>
            </Space>
          </List.Item>
        )}
      />
    ),
    [items, onFilterUpdate, selectedFilter, setSelectedFilter]
  );

  useEffect(() => {
    setSelectedFilter(defaultFilter);
  }, [defaultFilter]);

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
      <Tooltip title={t('label.feed-filter-plural')}>
        <Button
          className="flex-center"
          data-testid="filter-button"
          icon={<FilterIcon height={16} />}
        />
      </Tooltip>
    </Popover>
  );
};

export default FeedsFilterPopover;
