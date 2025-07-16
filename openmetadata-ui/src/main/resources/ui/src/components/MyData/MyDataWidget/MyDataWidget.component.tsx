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
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as MyDataIcon } from '../../../assets/svg/ic-my-data.svg';
import { ReactComponent as NoDataAssetsPlaceholder } from '../../../assets/svg/no-folder-data.svg';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  ROUTES,
} from '../../../constants/constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { MY_DATA_WIDGET_FILTER_OPTIONS } from '../../../constants/Widgets.constant';
import { SIZE } from '../../../enums/common.enum';
import { EntityTabs } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/tests/testCase';
import { TagLabel } from '../../../generated/type/tagLabel';
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
import { getUsagePercentile } from '../../../utils/TableUtils';
import EntitySummaryDetails from '../../common/EntitySummaryDetails/EntitySummaryDetails';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import WidgetEmptyState from '../Widgets/Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Widgets/Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Widgets/Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Widgets/Common/WidgetWrapper/WidgetWrapper';
import './my-data-widget.less';

const MyDataWidgetInternal = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SourceType[]>([]);

  const widgetData = useMemo(
    () => currentLayout?.find((w) => w.i === widgetKey),
    [currentLayout, widgetKey]
  );
  const [selectedFilter, setSelectedFilter] = useState<string>('Latest');

  const getSortField = useCallback((filterKey: string): string => {
    switch (filterKey) {
      case 'Latest':
        return 'updatedAt';
      case 'A to Z':
        return 'name.keyword';
      case 'Z to A':
        return 'name.keyword';
      default:
        return 'updatedAt';
    }
  }, []);

  const getSortOrder = useCallback((filterKey: string): 'asc' | 'desc' => {
    switch (filterKey) {
      case 'Latest':
        return 'desc';
      case 'A to Z':
        return 'asc';
      case 'Z to A':
        return 'desc';
      default:
        return 'desc';
    }
  }, []);

  // Client-side sorting as fallback
  const applySortToData = useCallback(
    (data: SourceType[], filterKey: string): SourceType[] => {
      const sortedData = [...data];

      switch (filterKey) {
        case 'A to Z':
          return sortedData.sort((a, b) => {
            const aName = getEntityName(a).toLowerCase();
            const bName = getEntityName(b).toLowerCase();

            return aName.localeCompare(bName);
          });
        case 'Z to A':
          return sortedData.sort((a, b) => {
            const aName = getEntityName(a).toLowerCase();
            const bName = getEntityName(b).toLowerCase();

            return bName.localeCompare(aName);
          });
        case 'Latest':
        default:
          // For Latest sorting, rely on API sorting since SourceType doesn't have timestamp fields
          return sortedData;
      }
    },
    []
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

    // Add tier info
    if (item.tier) {
      extraInfo.push({
        key: 'Tier',
        value: (
          <TagsV1
            startWith={TAG_START_WITH.SOURCE_ICON}
            tag={item.tier as TagLabel}
            tagProps={{
              'data-testid': 'Tier',
            }}
          />
        ),
        isEntityDetails: true,
      });
    }

    // Add table type info
    if ('tableType' in item) {
      extraInfo.push({
        key: 'Type',
        value: item.tableType,
        showLabel: true,
      });
    }

    // Add usage summary info
    if ('usageSummary' in item) {
      extraInfo.push({
        key: 'Usage',
        value: getUsagePercentile(
          item.usageSummary?.weeklyStats?.percentileRank || 0
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
      return searchClassBase.getEntityIcon(item.entityType ?? '');
    }
  };

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        actionButtonText={t('label.get-started')}
        description={t('message.nothing-saved-here-yet')}
        icon={
          <NoDataAssetsPlaceholder height={SIZE.LARGE} width={SIZE.LARGE} />
        }
        title={t('message.curate-your-data-view')}
        onActionClick={() => navigate(ROUTES.EXPLORE)}
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
                data-testid={`Recently Viewed-${getEntityName(item)}`}
                key={item.id}>
                <div className="d-flex items-center justify-between w-full overflow-hidden">
                  <Link
                    className="item-link w-min-0"
                    to={entityUtilClassBase.getEntityLink(
                      item.entityType ?? '',
                      item.fullyQualifiedName as string
                    )}>
                    <Button
                      className="entity-button flex-center gap-2 p-0 w-full"
                      icon={
                        <div className="entity-button-icon d-flex items-center justify-center flex-shrink-0">
                          {getEntityIcon(item)}
                        </div>
                      }
                      type="text">
                      <Typography.Text
                        className="text-left text-sm font-regular"
                        ellipsis={{ tooltip: true }}>
                        {getEntityName(item)}
                      </Typography.Text>
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
  const widgetContent = useMemo(() => {
    return (
      <div className="my-data-widget-container">
        <WidgetHeader
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={<MyDataIcon />}
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
              EntityTabs.ACTIVITY_FEED
            )}
            moreButtonText={t('label.view-more-count', {
              count: data.length > 0 ? data.length : '',
            })} // if data is empty then show view more
            showMoreButton={Boolean(!isLoading)}
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
  ]);

  return (
    <WidgetWrapper
      dataLength={data.length !== 0 ? data.length : 5}
      loading={isLoading}>
      {widgetContent}
    </WidgetWrapper>
  );
};

export const MyDataWidget = MyDataWidgetInternal;
