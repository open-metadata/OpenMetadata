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
import { ReactComponent as NoDataAssetsPlaceholder } from '../../../assets/svg/no-data-placeholder.svg';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  PAGE_SIZE_MEDIUM,
  ROUTES,
} from '../../../constants/constants';
import {
  applySortToData,
  getSortField,
  getSortOrder,
  MY_DATA_WIDGET_FILTER_OPTIONS,
} from '../../../constants/Widgets.constant';
import { SIZE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import type { EntityReference } from '../../../generated/tests/testCase';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityLinkFromType } from '../../../utils/EntityLinkUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityIcon } from '../../../utils/LandingPageWidgetIconUtils';
import { getDomainPath, getUserPath } from '../../../utils/RouterUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
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
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();

  const widgetData = useMemo(
    () => currentLayout?.find((w) => w.i === widgetKey),
    [currentLayout, widgetKey]
  );
  const [selectedFilter, setSelectedFilter] = useState<string>(
    CURATED_ASSETS_SORT_BY_KEYS.LATEST
  );
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SourceType[]>([]);

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

  const ownerIds = useMemo(() => {
    if (!isUndefined(currentUser)) {
      const teamsIds = (currentUser.teams ?? []).map((team) => team.id);

      return [...teamsIds, currentUser.id];
    }

    return [];
  }, [currentUser]);

  const fetchMyDataAssets = useCallback(
    async (isStale: () => boolean) => {
      if (isUndefined(currentUser)) {
        if (!isStale()) {
          setData([]);
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);

      try {
        const queryFilterObj = getTermQuery(
          { 'owners.id': ownerIds },
          'should',
          1
        );

        const sortField = getSortField(selectedFilter);
        const sortOrder = getSortOrder(selectedFilter);

        const res = await searchQuery({
          query: '',
          pageNumber: INITIAL_PAGING_VALUE,
          pageSize: PAGE_SIZE_MEDIUM,
          queryFilter: queryFilterObj,
          sortField,
          sortOrder,
          searchIndex: SearchIndex.ALL,
        });

        const ownedAssets = res?.hits?.hits ?? [];
        const sourceData = ownedAssets.map((hit) => hit._source);

        if (!isStale()) {
          setData(applySortToData(sourceData, selectedFilter));
        }
      } catch {
        if (!isStale()) {
          setData([]);
        }
      } finally {
        if (!isStale()) {
          setIsLoading(false);
        }
      }
    },
    [currentUser, ownerIds, selectedFilter]
  );

  useEffect(() => {
    let ignore = false;

    fetchMyDataAssets(() => ignore);

    return () => {
      ignore = true;
    };
  }, [fetchMyDataAssets]);

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        actionButtonLink={ROUTES.EXPLORE}
        actionButtonText={t('label.explore-assets')}
        description={t('message.no-owned-data')}
        icon={
          <NoDataAssetsPlaceholder height={SIZE.MEDIUM} width={SIZE.MEDIUM} />
        }
        title={t('label.no-records')}
      />
    ),
    []
  );
  const myDataContent = useMemo(() => {
    return (
      <div className="entity-list-body">
        <div className="cards-scroll-container flex-1 overflow-y-auto">
          {data.slice(0, PAGE_SIZE_BASE).map((item) => {
            const extraInfo = getEntityExtraInfo(item);

            return (
              <div
                className="my-data-widget-list-item card-wrapper w-full p-xs border-radius-sm"
                data-testid={`My-Data-${getEntityName(item)}`}
                key={item.id}>
                <div className="d-flex items-center justify-between ">
                  <Link
                    className="item-link w-min-0"
                    to={getEntityLinkFromType(
                      item.fullyQualifiedName as string,
                      item.entityType as EntityType
                    )}>
                    <Button
                      className="entity-button flex items-center gap-2 p-0 w-full"
                      icon={
                        <div className="entity-button-icon d-flex items-center justify-center flex-shrink">
                          {getEntityIcon(item)}
                        </div>
                      }
                      type="text">
                      <div className="d-flex w-max-full w-min-0 flex-column">
                        {'serviceType' in item && item.serviceType && (
                          <Typography.Text
                            className="text-left text-xs font-regular text-grey-600"
                            ellipsis={{ tooltip: true }}>
                            {item.serviceType}
                          </Typography.Text>
                        )}
                        <Typography.Text
                          className="text-left text-sm font-regular text-grey-800"
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

  const showWidgetFooterMoreButton = useMemo(
    () => Boolean(!isLoading) && data?.length > PAGE_SIZE_BASE,
    [data, isLoading]
  );

  const translatedSortOptions = useMemo(
    () =>
      MY_DATA_WIDGET_FILTER_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t]
  );

  const widgetHeader = useMemo(
    () => (
      <WidgetHeader
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={<MyDataIcon height={24} width={24} />}
        isEditView={isEditView}
        selectedSortBy={selectedFilter}
        sortOptions={translatedSortOptions}
        title={t('label.my-data')}
        widgetKey={widgetKey}
        onSortChange={(key) => handleFilterChange({ key })}
        onTitleClick={() =>
          navigate(getUserPath(currentUser?.name ?? '', UserPageTabs.MY_DATA))
        }
      />
    ),
    [
      currentLayout,
      handleLayoutUpdate,
      handleRemoveWidget,
      isEditView,
      selectedFilter,
      t,
      widgetKey,
      widgetData?.w,
      handleFilterChange,
      translatedSortOptions,
    ]
  );

  const widgetContent = useMemo(() => {
    return (
      <div className="my-data-widget-container">
        <div className="widget-content flex-1">
          {isEmpty(data) ? emptyState : myDataContent}
          <WidgetFooter
            moreButtonLink={getUserPath(
              currentUser?.name ?? '',
              UserPageTabs.MY_DATA
            )}
            moreButtonText={t('label.view-more')}
            showMoreButton={showWidgetFooterMoreButton}
          />
        </div>
      </div>
    );
  }, [
    data,
    emptyState,
    myDataContent,
    currentUser?.name,
    showWidgetFooterMoreButton,
    t,
  ]);

  return (
    <WidgetWrapper
      dataTestId="KnowledgePanel.MyData"
      header={widgetHeader}
      loading={isLoading}>
      {widgetContent}
    </WidgetWrapper>
  );
};

export const MyDataWidget = MyDataWidgetInternal;
