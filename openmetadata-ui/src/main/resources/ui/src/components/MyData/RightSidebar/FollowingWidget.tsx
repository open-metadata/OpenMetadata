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
import { Button, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { ExtraInfo } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as FollowingAssetsIcon } from '../../../assets/svg/ic-following-assets.svg';
import { ReactComponent as NoDataAssetsPlaceholder } from '../../../assets/svg/no-notifications.svg';
import { KNOWLEDGE_LIST_LENGTH, ROUTES } from '../../../constants/constants';
import {
  applySortToData,
  FOLLOWING_WIDGET_FILTER_OPTIONS,
  getSortField,
  getSortOrder,
} from '../../../constants/Widgets.constant';
import { SIZE } from '../../../enums/common.enum';
import { EntityTabs } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { SearchSourceAlias } from '../../../interface/search.interface';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDomainPath, getUserPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import EntitySummaryDetails from '../../common/EntitySummaryDetails/EntitySummaryDetails';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import WidgetEmptyState from '../Widgets/Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Widgets/Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Widgets/Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Widgets/Common/WidgetWrapper/WidgetWrapper';
import { CURATED_ASSETS_SORT_BY_KEYS } from '../Widgets/CuratedAssetsWidget/CuratedAssetsWidget.constants';
import './following-widget.less';

function FollowingWidget({
  isEditView,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: Readonly<WidgetCommonProps>) {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>(
    CURATED_ASSETS_SORT_BY_KEYS.LATEST
  );
  const [followedData, setFollowedData] = useState<SourceType[]>([]);
  const [isLoadingOwnedData, setIsLoadingOwnedData] = useState<boolean>(true);

  const fetchUserFollowedData = async () => {
    if (!currentUser?.id) {
      return;
    }
    setIsLoadingOwnedData(true);
    try {
      const sortField = getSortField(selectedEntityFilter);
      const sortOrder = getSortOrder(selectedEntityFilter);

      const res = await searchQuery({
        pageSize: KNOWLEDGE_LIST_LENGTH,
        searchIndex: SearchIndex.ALL,
        query: '*',
        filters: `followers:${currentUser.id}`,
        sortField,
        sortOrder,
      });

      const sourceData = res.hits.hits.map((hit) => hit._source);
      // Apply client-side sorting as well to ensure consistent results
      const sortedData = applySortToData(sourceData, selectedEntityFilter);
      setFollowedData(sortedData);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoadingOwnedData(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchUserFollowedData();
    }
  }, [currentUser, selectedEntityFilter]);
  // Check if widget is in expanded form (full size)
  const isExpanded = useMemo(() => {
    const currentWidget = currentLayout?.find(
      (layout: WidgetConfig) => layout.i === widgetKey
    );

    return currentWidget?.w === 2;
  }, [currentLayout, widgetKey]);

  const handleEntityFilterChange = useCallback(({ key }: { key: string }) => {
    setSelectedEntityFilter(key);
  }, []);

  const getEntityExtraInfo = (item: SourceType): ExtraInfo[] => {
    const extraInfo: ExtraInfo[] = [];
    // Add domain info
    if (item.domain) {
      extraInfo.push({
        key: 'Domain',
        value: getDomainPath(item.domain.fullyQualifiedName),
        placeholderText: getEntityName(item.domain),
        isLink: true,
        openInNewTab: false,
      });
    }

    // Add owner info
    if (item.owners && item.owners.length > 0) {
      extraInfo.push({
        key: 'Owner',
        value: (
          <OwnerLabel
            isCompactView={false}
            owners={(item.owners as EntityReference[]) ?? []}
            showLabel={false}
          />
        ),
      });
    }

    return extraInfo;
  };

  const getEntityIcon = (item: any) => {
    if (item.serviceType) {
      return (
        <img
          alt={item.name}
          className="w-8 h-8"
          src={serviceUtilClassBase.getServiceTypeLogo({
            serviceType: item.serviceType,
          } as SearchSourceAlias)}
        />
      );
    } else {
      return searchClassBase.getEntityIcon(item.type ?? '');
    }
  };

  const widgetData = useMemo(
    () => currentLayout?.find((w) => w.i === widgetKey),
    [currentLayout, widgetKey]
  );
  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        actionButtonLink={ROUTES.EXPLORE}
        actionButtonText={t('label.browse-assets')}
        description={t('message.not-followed-anything')}
        icon={
          <NoDataAssetsPlaceholder height={SIZE.LARGE} width={SIZE.LARGE} />
        }
        title={t('message.not-following-any-assets-yet')}
      />
    ),
    []
  );
  const followingContent = useMemo(() => {
    return (
      <div className="entity-list-body">
        <div className="cards-scroll-container flex-1 overflow-y-auto">
          {followedData.map((item) => {
            const extraInfo = getEntityExtraInfo(item);

            return (
              <div
                className="following-widget-list-item w-full p-xs border-radius-sm"
                data-testid={`Following-${getEntityName(item)}`}
                key={item.id}>
                <div className="d-flex items-center justify-between w-full">
                  <Link
                    className="item-link w-min-0"
                    to={entityUtilClassBase.getEntityLink(
                      item.entityType ?? '',
                      item.fullyQualifiedName as string
                    )}>
                    <Button
                      className="entity-button flex items-center gap-2 p-0 w-full"
                      icon={
                        <div className="entity-button-icon d-flex items-center justify-center flex-shrink">
                          {getEntityIcon(item)}
                        </div>
                      }
                      type="text">
                      <div className="d-flex w-max-full w-min-0 flex-column gap-1">
                        {'serviceType' in item && item.serviceType && (
                          <Typography.Text
                            className="text-left text-sm font-regular"
                            ellipsis={{ tooltip: true }}>
                            {item.serviceType}
                          </Typography.Text>
                        )}
                        <Typography.Text
                          className="text-left text-sm font-semibold"
                          ellipsis={{ tooltip: true }}>
                          {getEntityName(item)}
                        </Typography.Text>
                      </div>
                    </Button>
                  </Link>
                  {isExpanded && (
                    <div className="d-flex items-center gap-3 flex-wrap">
                      {extraInfo.map((info, i) => (
                        <>
                          <EntitySummaryDetails data={info} key={info.key} />
                          {i !== extraInfo.length - 1 && (
                            <span className="px-1.5 d-inline-block text-xl font-semibold">
                              {t('label.middot-symbol')}
                            </span>
                          )}
                        </>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [followedData, emptyState]);

  const WidgetContent = useMemo(() => {
    return (
      <div className="following-widget-container">
        <WidgetHeader
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={<FollowingAssetsIcon height={24} width={24} />}
          isEditView={isEditView}
          selectedSortBy={selectedEntityFilter}
          sortOptions={FOLLOWING_WIDGET_FILTER_OPTIONS}
          title={t('label.following-assets')}
          widgetKey={widgetKey}
          widgetWidth={widgetData?.w}
          onSortChange={(key) => handleEntityFilterChange({ key })}
        />
        <div className="widget-content flex-1">
          {isEmpty(followedData) ? emptyState : followingContent}
          <WidgetFooter
            moreButtonLink={getUserPath(
              currentUser?.name ?? '',
              EntityTabs.ACTIVITY_FEED
            )}
            moreButtonText={t('label.view-more-count', {
              count: followedData.length > 0 ? followedData.length : '',
            })}
            showMoreButton={
              Boolean(!isLoadingOwnedData) && !isEmpty(followedData)
            }
          />
        </div>
      </div>
    );
  }, [
    followedData,
    emptyState,
    isExpanded,
    isLoadingOwnedData,
    currentUser,
    currentLayout,
    handleLayoutUpdate,
    handleRemoveWidget,
    widgetKey,
    widgetData,
    isEditView,
  ]);

  return (
    <WidgetWrapper
      dataLength={followedData.length !== 0 ? followedData.length : 10}
      loading={isLoadingOwnedData}>
      {WidgetContent}
    </WidgetWrapper>
  );
}

export default FollowingWidget;
