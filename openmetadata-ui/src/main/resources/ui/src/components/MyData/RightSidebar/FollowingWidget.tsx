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
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import { Space } from 'antd';
import { isUndefined } from 'lodash';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AppState from '../../../AppState';
import { getUserPath } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { WidgetCommonProps } from '../../../pages/CustomisablePages/CustomisablePage.interface';
import { EntityListWithV1 } from '../../Entity/EntityList/EntityList';

export interface FollowingWidgetProps extends WidgetCommonProps {
  followedData: EntityReference[];
  followedDataCount: number;
  isLoadingOwnedData: boolean;
}

function FollowingWidget({
  isEditView,
  followedData,
  followedDataCount,
  isLoadingOwnedData,
  handleRemoveWidget,
  widgetKey,
}: Readonly<FollowingWidgetProps>) {
  const { t } = useTranslation();
  const currentUserDetails = AppState.getCurrentUserDetails();

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  return (
    <div data-testid="following-data-container">
      <EntityListWithV1
        entityList={followedData}
        headerText={
          <Space>
            {followedData.length ? (
              <Link
                className="view-all-btn text-grey-muted"
                data-testid="following-data"
                to={getUserPath(currentUserDetails?.name ?? '', 'following')}>
                <span className="font-normal text-xs">
                  {t('label.view-all')}{' '}
                  <span data-testid="following-data-total-count">
                    {`(${followedDataCount})`}
                  </span>
                </span>
              </Link>
            ) : null}
            {isEditView && (
              <>
                <DragOutlined
                  className="drag-widget-icon cursor-pointer"
                  size={14}
                />
                <CloseOutlined size={14} onClick={handleCloseClick} />
              </>
            )}
          </Space>
        }
        headerTextLabel={t('label.following')}
        loading={isLoadingOwnedData}
        noDataPlaceholder={t('message.not-followed-anything')}
        testIDText="following"
      />
    </div>
  );
}

export default FollowingWidget;
