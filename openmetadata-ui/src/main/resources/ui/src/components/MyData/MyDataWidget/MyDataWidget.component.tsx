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
import { isEmpty, isUndefined } from 'lodash';
import { ExtraInfo } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as MyDataIcon } from '../../../assets/svg/ic-my-data.svg';
import { ReactComponent as NoDataAssetsPlaceholder } from '../../../assets/svg/no-data-placeholder.svg';
import { INITIAL_PAGING_VALUE, PAGE_SIZE } from '../../../constants/constants';
import {
  applySortToData,
  getSortField,
  getSortOrder,
  MY_DATA_WIDGET_FILTER_OPTIONS,
} from '../../../constants/Widgets.constant';
import { SIZE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/tests/testCase';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { SearchSourceAlias } from '../../../interface/search.interface';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchData } from '../../../rest/miscAPI';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDomainPath, getUserPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import EntitySummaryDetails from '../../common/EntitySummaryDetails/EntitySummaryDetails';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { UserPageTabs } from '../../Settings/Users/Users.interface';
import WidgetEmptyState from '../Widgets/Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Widgets/Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Widgets/Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Widgets/Common/WidgetWrapper/WidgetWrapper';
import { CURATED_ASSETS_SORT_BY_KEYS } from '../Widgets/CuratedAssetsWidget/CuratedAssetsWidget.constants';
import './my-data-widget.less';

const MyDataWidgetInternal = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SourceType[]>([]);

  const widgetData = useMemo(
    () => currentLayout?.find((w) => w.i === widgetKey),
    [currentLayout, widgetKey]
  );
  const [selectedFilter, setSelectedFilter] = useState<string>(
    CURATED_ASSETS_SORT_BY_KEYS.LATEST
  );

  const handleFilterChange = useCallback(({ key }: { key: string }) => {
    setSelectedFilter(key);
  }, []);
  // Check if widget is in expanded form (full size)
  const isExpanded = useMemo(() => {
    const currentWidget = currentLayout?.find(
      (layout: WidgetConfig) => layout.i === widgetKey
    );

    return currentWidget?.w === 2;
  }, [currentLayout, widgetKey]);

  const getEntityExtraInfo = (item: SourceType): ExtraInfo[] => {
    const extraInfo: ExtraInfo[] = [];
    // Add domain info
    if (item.domains && item.domains.length > 0) {
      extraInfo.push({
        key: 'Domain',
        value: getDomainPath(item.domains[0]?.fullyQualifiedName ?? ''),
        placeholderText: getEntityName(item.domains[0] ?? {}),
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

  const fetchMyDataAssets = useCallback(async () => {
    if (!isUndefined(currentUser)) {
      setIsLoading(true);
      try {
        const teamsIds = (currentUser.teams ?? []).map((team) => team.id);
        const mergedIds = [
          ...teamsIds.map((id) => `owners.id:${id}`),
          `owners.id:${currentUser.id}`,
        ].join(' OR ');

        const queryFilter = `(${mergedIds})`;
        const sortField = getSortField(selectedFilter);
        const sortOrder = getSortOrder(selectedFilter);

        const res = await searchData(
          '',
          INITIAL_PAGING_VALUE,
          PAGE_SIZE,
          queryFilter,
          sortField,
          sortOrder,
          SearchIndex.ALL
        );

        // Extract useful details from the Response
        const ownedAssets = res?.data?.hits?.hits;
        const sourceData = ownedAssets.map((hit) => hit._source).slice(0, 8);

        // Apply client-side sorting as well to ensure consistent results
        const sortedData = applySortToData(sourceData, selectedFilter);
        setData(sortedData);
      } catch {
        setData([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [
    currentUser,
    selectedFilter,
    getSortField,
    getSortOrder,
    applySortToData,
  ]);

  useEffect(() => {
    fetchMyDataAssets();
  }, [fetchMyDataAssets]);

  const getEntityIcon = (item: SourceType) => {
    if ('serviceType' in item && item.serviceType) {
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
      return searchClassBase.getEntityIcon(item.entityType ?? '');
    }
  };

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        actionButtonLink={getUserPath(
          currentUser?.name ?? '',
          UserPageTabs.MY_DATA
        )}
        actionButtonText={t('label.get-started')}
        description={`${t('message.nothing-saved-yet')} ${t(
          'message.no-owned-data'
        )}`}
        icon={
          <NoDataAssetsPlaceholder height={SIZE.LARGE} width={SIZE.LARGE} />
        }
        title={t('message.curate-your-data-view')}
      />
    ),
    []
  );
  const myDataContent = useMemo(() => {
    return (
      <div className="entity-list-body">
        <div className="cards-scroll-container flex-1 overflow-y-auto">
          {data.map((item) => {
            const extraInfo = getEntityExtraInfo(item);

            return (
              <div
                className="my-data-widget-list-item card-wrapper w-full p-xs border-radius-sm"
                data-testid={`My-Data-${getEntityName(item)}`}
                key={item.id}>
                <div className="d-flex items-center justify-between ">
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
  }, [data, isExpanded]);

  const showMoreCount = useMemo(() => {
    return data.length > 0 ? data.length.toString() : '';
  }, [data]);

  const widgetContent = useMemo(() => {
    return (
      <div className="my-data-widget-container">
        <WidgetHeader
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={<MyDataIcon height={24} width={24} />}
          isEditView={isEditView}
          selectedSortBy={selectedFilter}
          sortOptions={MY_DATA_WIDGET_FILTER_OPTIONS}
          title={t('label.my-data')}
          widgetKey={widgetKey}
          widgetWidth={widgetData?.w}
          onSortChange={(key) => handleFilterChange({ key })}
        />
        <div className="widget-content flex-1">
          {isEmpty(data) ? emptyState : myDataContent}
          <WidgetFooter
            moreButtonLink={getUserPath(
              currentUser?.name ?? '',
              UserPageTabs.MY_DATA
            )}
            moreButtonText={t('label.view-more-count', {
              countValue: showMoreCount,
            })}
            showMoreButton={Boolean(!isLoading) && data?.length > 10}
          />
        </div>
      </div>
    );
  }, [
    data,
    isLoading,
    currentUser,
    currentLayout,
    handleLayoutUpdate,
    handleRemoveWidget,
    widgetKey,
    widgetData,
    isEditView,
    showMoreCount,
  ]);

  return (
    <WidgetWrapper
      dataLength={data.length > 0 ? data.length : 10}
      loading={isLoading}>
      {widgetContent}
    </WidgetWrapper>
  );
};

export const MyDataWidget = MyDataWidgetInternal;
