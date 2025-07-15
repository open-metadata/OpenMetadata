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
import Icon, {
  ArrowRightOutlined,
  DownOutlined,
  DragOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Dropdown, Row, Space, Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import { ExtraInfo } from 'Models';
import { MenuInfo } from 'rc-menu/lib/interface';
import { useCallback, useMemo, useState } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as FollowingEmptyIcon } from '../../../assets/svg/no-notifications.svg';
import { ROUTES } from '../../../constants/constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import {
  WIDGETS_MORE_MENU_KEYS,
  WIDGETS_MORE_MENU_OPTIONS,
} from '../../../constants/Widgets.constant';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityReference } from '../../../generated/entity/type';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { SearchSourceAlias } from '../../../interface/search.interface';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../pages/CustomizablePage/CustomizablePage.interface';
import customizeMyDataPageClassBase from '../../../utils/CustomizeMyDataPageClassBase';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDomainPath, getUserPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { getUsagePercentile } from '../../../utils/TableUtils';
import EntitySummaryDetails from '../../common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import EntityListSkeleton from '../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import './following-widget.less';

export interface FollowingWidgetProps extends WidgetCommonProps {
  followedData: SourceType[];
  isLoadingOwnedData: boolean;
}

function FollowingWidget({
  isEditView,
  followedData,
  isLoadingOwnedData,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: Readonly<FollowingWidgetProps>) {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const navigate = useNavigate();
  const [selectedEntityFilter, setSelectedEntityFilter] =
    useState<string>('ALL');

  const widgetIcon = useMemo(() => {
    return customizeMyDataPageClassBase.getWidgetIconFromKey(widgetKey);
  }, [widgetKey]);

  // Check if widget is in expanded form (full size)
  const isExpanded = useMemo(() => {
    const currentWidget = currentLayout?.find(
      (layout: WidgetConfig) => layout.i === widgetKey
    );

    return (currentWidget?.w ?? 1) >= 2; // Full size is width 2, half size is width 1
  }, [currentLayout, widgetKey]);

  // Filter options for entity types
  const entityFilterOptions = [
    {
      label: t('label.latest'),
      value: 'Latest',
      key: 'Latest',
    },
    {
      label: 'a-z',
      value: 'a-z',
      key: 'a-z',
    },
    {
      label: 'z-a',
      value: 'z-a',
      key: 'z-a',
    },
  ];

  // Filtered data based on selected entity type
  const filteredFollowedData = useMemo(() => {
    if (selectedEntityFilter === 'ALL') {
      return followedData;
    }

    // Need to update this once filters are implemented
    return followedData.filter((item) => item);
  }, [followedData, selectedEntityFilter]);

  const handleEntityFilterChange = useCallback(({ key }: { key: string }) => {
    setSelectedEntityFilter(key);
  }, []);

  const getSelectedFilterLabel = useCallback(() => {
    const selectedOption = entityFilterOptions.find(
      (option) => option.key === selectedEntityFilter
    );

    return selectedOption?.label || t('label.all');
  }, [selectedEntityFilter, entityFilterOptions, t]);

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
          item.usageSummary?.weeklyStats?.percentileRank || 0,
          true
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
          src={serviceUtilClassBase.getServiceTypeLogo(
            item.serviceType as unknown as SearchSourceAlias
          )}
        />
      );
    } else {
      return searchClassBase.getEntityIcon(item.type ?? '');
    }
  };

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  const handleSizeChange = useCallback(
    (value: number) => {
      if (handleLayoutUpdate) {
        const hasCurrentWidget = currentLayout?.find(
          (layout: WidgetConfig) => layout.i === widgetKey
        );

        const updatedLayout = hasCurrentWidget
          ? currentLayout?.map((layout: WidgetConfig) =>
              layout.i === widgetKey ? { ...layout, w: value } : layout
            )
          : [
              ...(currentLayout || []),
              {
                ...customizeMyDataPageClassBase.defaultLayout.find(
                  (layout: WidgetConfig) => layout.i === widgetKey
                ),
                i: widgetKey,
                w: value,
              },
            ];

        handleLayoutUpdate(updatedLayout as Layout[]);
      }
    },
    [currentLayout, handleLayoutUpdate, widgetKey]
  );

  const handleMoreClick = (e: MenuInfo) => {
    if (e.key === WIDGETS_MORE_MENU_KEYS.REMOVE_WIDGET) {
      handleCloseClick();
    } else if (e.key === WIDGETS_MORE_MENU_KEYS.HALF_SIZE) {
      handleSizeChange(1);
    } else if (e.key === WIDGETS_MORE_MENU_KEYS.FULL_SIZE) {
      handleSizeChange(2);
    }
  };

  return (
    <Card
      className="following-widget-container card-widget p-box"
      data-testid="following-widget"
      loading={isLoadingOwnedData}>
      <Row>
        <Col span={24}>
          <div className="d-flex items-center justify-between m-b-xs">
            <div className="d-flex items-center gap-3 flex-wrap">
              <Icon
                className="following-widget-icon display-xs"
                component={widgetIcon as SvgComponent}
              />
              <Typography.Text className="text-md font-semibold">
                {t('label.following-assets')}
              </Typography.Text>
            </div>
            <Space>
              {!isEditView && (
                <Dropdown
                  menu={{
                    items: entityFilterOptions,
                    selectedKeys: [selectedEntityFilter],
                    onClick: handleEntityFilterChange,
                  }}
                  trigger={['click']}>
                  <Button
                    ghost
                    className="expand-btn"
                    data-testid="entity-filter-dropdown"
                    type="primary">
                    {getSelectedFilterLabel()}
                    <DownOutlined />
                  </Button>
                </Dropdown>
              )}
              {isEditView && (
                <>
                  <DragOutlined
                    className="drag-widget-icon cursor-pointer p-sm border-radius-xs"
                    data-testid="drag-widget-button"
                    size={20}
                  />
                  <Dropdown
                    className="widget-options"
                    data-testid="widget-options"
                    menu={{
                      items: WIDGETS_MORE_MENU_OPTIONS,
                      selectable: true,
                      multiple: false,
                      onClick: handleMoreClick,
                      className: 'widget-header-menu',
                    }}
                    placement="bottomLeft"
                    trigger={['click']}>
                    <Button
                      className="more-options-btn"
                      data-testid="more-options-btn"
                      icon={<MoreOutlined size={20} />}
                    />
                  </Dropdown>
                </>
              )}
            </Space>
          </div>
        </Col>
      </Row>
      <EntityListSkeleton
        dataLength={
          filteredFollowedData.length !== 0 ? filteredFollowedData.length : 5
        }
        loading={Boolean(isLoadingOwnedData)}>
        {isEmpty(filteredFollowedData) ? (
          <div className="flex-center h-full">
            <ErrorPlaceHolder
              className="border-none"
              icon={
                <FollowingEmptyIcon height={SIZE.LARGE} width={SIZE.LARGE} />
              }
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <div className="d-flex flex-col items-center">
                <Typography.Text className="text-md font-semibold m-b-sm">
                  {selectedEntityFilter === 'ALL'
                    ? t('message.not-following-any-assets-yet')
                    : t('label.no-data-found')}
                </Typography.Text>
                <Typography.Paragraph className="placeholder-text text-sm font-regular">
                  {t('message.not-followed-anything')}
                </Typography.Paragraph>
                <Button
                  className="m-t-md"
                  type="primary"
                  onClick={() => {
                    navigate(ROUTES.EXPLORE);
                  }}>
                  {t('label.browse-assets')}
                </Button>
              </div>
            </ErrorPlaceHolder>
          </div>
        ) : (
          <div className="d-flex flex-col h-full">
            <div className="entity-list-body p-y-sm d-flex flex-col gap-3 flex-1 overflow-y-auto">
              {filteredFollowedData.map((item) => {
                const extraInfo = getEntityExtraInfo(item);

                return (
                  <div
                    className="following-widget-list-item w-full p-sm border-radius-sm"
                    data-testid={`Following-${getEntityName(item)}`}
                    key={item.id}>
                    <div className="d-flex items-center justify-between w-full">
                      <Link
                        className="item-link"
                        to={entityUtilClassBase.getEntityLink(
                          item.entityType ?? '',
                          item.fullyQualifiedName as string
                        )}>
                        <Button
                          className="entity-button flex-center gap-2 p-0"
                          icon={
                            <div className="entity-button-icon d-flex items-center justify-center">
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
                              <EntitySummaryDetails
                                data={info}
                                key={info.key}
                              />
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
            <div className="d-flex items-center justify-center w-full">
              <Link
                className="view-more-text text-sm font-regular  cursor-pointer"
                data-testid="view-more-link"
                to={getUserPath(currentUser?.name ?? '', 'following')}>
                {t('label.view-more-count', {
                  count: filteredFollowedData?.length,
                })}
                <ArrowRightOutlined className="m-l-xss" />
              </Link>
            </div>
          </div>
        )}
      </EntityListSkeleton>
    </Card>
  );
}

export default FollowingWidget;
