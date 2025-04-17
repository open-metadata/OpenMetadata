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
import { Card, Space, Typography } from 'antd';
import { isUndefined } from 'lodash';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as FollowingEmptyIcon } from '../../../assets/svg/following-no-data-placeholder.svg';
import { FOLLOW_DATA_ASSET } from '../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getUserPath } from '../../../utils/RouterUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { EntityListWithV1 } from '../../Entity/EntityList/EntityList';
import './following-widget.less';

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
  const { currentUser } = useApplicationStore();

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  return (
    <Card
      className="following-widget-container card-widget h-full"
      data-testid="following-widget">
      <EntityListWithV1
        entityList={followedData}
        headerText={
          <Space>
            {followedData.length ? (
              <Link
                className="view-all-btn text-grey-muted"
                data-testid="following-data"
                to={getUserPath(currentUser?.name ?? '', 'following')}>
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
                  data-testid="drag-widget-button"
                  size={14}
                />
                <CloseOutlined
                  data-testid="remove-widget-button"
                  size={14}
                  onClick={handleCloseClick}
                />
              </>
            )}
          </Space>
        }
        headerTextLabel={t('label.following')}
        loading={isLoadingOwnedData}
        noDataPlaceholder={
          <div className="flex-center h-full">
            <ErrorPlaceHolder
              className="border-none"
              icon={
                <FollowingEmptyIcon
                  height={SIZE.X_SMALL}
                  width={SIZE.X_SMALL}
                />
              }
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <Typography.Paragraph>
                {t('message.not-followed-anything')}
              </Typography.Paragraph>
              <a
                className="link-title"
                href={FOLLOW_DATA_ASSET}
                rel="noreferrer"
                target="_blank">
                {t('label.learn-more')}
              </a>
            </ErrorPlaceHolder>
          </div>
        }
        testIDText="following"
      />
    </Card>
  );
}

export default FollowingWidget;
