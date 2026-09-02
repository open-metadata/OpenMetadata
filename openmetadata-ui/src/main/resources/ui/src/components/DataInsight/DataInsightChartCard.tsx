/*
 *  Copyright 2024 Collate.
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
import { Button, Card, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import {
  first,
  get,
  groupBy,
  includes,
  last,
  omit,
  reduce,
  round,
  sortBy,
  startCase,
  toLower,
} from 'lodash';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ResponsiveContainer } from 'recharts';
import { ReactComponent as RightArrowIcon } from '../../assets/svg/right-arrow.svg';
import {
  DI_STRUCTURE,
  GRAPH_HEIGHT,
} from '../../constants/DataInsight.constants';
import {
  INCOMPLETE_DESCRIPTION_ADVANCE_SEARCH_FILTER,
  NO_OWNER_ADVANCE_SEARCH_FILTER,
} from '../../constants/explore.constants';

import { SystemChartType } from '../../enums/DataInsight.enum';
import { SearchIndex } from '../../enums/search.enum';
import { DataInsightChart } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { useDataInsightProvider } from '../../pages/DataInsightPage/DataInsightProvider';
import {
  DataInsightCustomChartResult,
  getChartPreviewByName,
} from '../../rest/DataInsightAPI';
import { updateActiveChartFilter } from '../../utils/ChartUtils';
import { entityChartColor } from '../../utils/ColorUtils';
import { renderDataInsightLineChart } from '../../utils/DataInsightChartUtils';
import {
  getQueryFilterForDataInsightChart,
  isPercentageSystemGraph,
} from '../../utils/DataInsightPureUtils';
import { getExplorePath } from '../../utils/RouterUtils';
import searchClassBase from '../../utils/SearchClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import Searchbar from '../common/SearchBarComponent/SearchBar.component';
import PageHeader from '../PageHeader/PageHeader.component';
import DataInsightProgressBar from './DataInsightProgressBar';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';
import EntitySummaryProgressBar from './EntitySummaryProgressBar.component';
interface DataInsightChartCardProps {
  type: SystemChartType;
  header: ReactNode;
  subHeader: ReactNode;
  listAssets?: boolean;
}

interface AbsoluteValuesResult {
  results: Array<{ count: number; day: number }>;
}

type FinalDataPoint = Record<string, number>;

const computeTotalDataAssetsChange = (
  latestData: Record<string, number>,
  finalData: FinalDataPoint[]
): number => {
  const lastValue = reduce(latestData, (acc, value) => acc + value, 0);
  const firstValue = reduce(
    omit(first(finalData) ?? {}, 'day'),
    (acc, value) => acc + value,
    0
  );

  return firstValue ? ((lastValue - firstValue) / firstValue) * 100 : 0;
};

const computeTotalDataAssetsByTierChange = (
  latestData: Record<string, number>,
  finalData: FinalDataPoint[],
  timeStampResults: Record<string, DataInsightCustomChartResult['results']>
): number => {
  const lastTotalAssetsValue = reduce(
    latestData,
    (acc, value) => acc + value,
    0
  );
  const firstTotalAssetsValue = reduce(
    omit(first(finalData) ?? {}, 'day'),
    (acc, value) => acc + value,
    0
  );

  const tierGraphResults = Object.entries(timeStampResults).map(
    ([key, value]) => {
      const keys = value
        .filter((curr) => curr.group !== 'NoTier')
        .reduce((acc, curr) => {
          return { ...acc, [curr.group ?? 'count']: curr.count };
        }, {});

      return {
        day: +key,
        ...keys,
      };
    }
  );

  const tierFinalData = sortBy(tierGraphResults, 'day');

  const lastAbsoluteValue = reduce(
    omit(last(tierFinalData) ?? {}, 'day'),
    (acc, value) => acc + value,
    0
  );
  const firstAbsoluteValue = reduce(
    omit(first(tierFinalData) ?? {}, 'day'),
    (acc, value) => acc + value,
    0
  );

  const firstPercentValue = firstTotalAssetsValue
    ? (firstAbsoluteValue / firstTotalAssetsValue) * 100
    : 0;
  const lastPercentValue = lastTotalAssetsValue
    ? (lastAbsoluteValue / lastTotalAssetsValue) * 100
    : 0;

  return lastPercentValue - firstPercentValue;
};

const computeDefaultChange = (
  totalAssetsResultsInput: DataInsightCustomChartResult['results'],
  absoluteValuesResultsInput: AbsoluteValuesResult['results']
): number => {
  const totalAssetsResults = totalAssetsResultsInput ?? [];
  const totalAssetsTimeStampResults = groupBy(totalAssetsResults, 'day');

  const totalAssetsGraphResults = Object.entries(
    totalAssetsTimeStampResults
  ).map(([key, value]) => {
    const keys = value.reduce((acc, curr) => {
      return { ...acc, [curr.group ?? 'count']: curr.count };
    }, {});

    return {
      day: +key,
      ...keys,
    };
  });

  const totalAssetsFinalData = sortBy(totalAssetsGraphResults, 'day');

  const lastTotalAssetsValue = reduce(
    omit(last(totalAssetsFinalData) ?? {}, 'day'),
    (acc, value) => acc + value,
    0
  );
  const firstTotalAssetsValue = reduce(
    omit(first(totalAssetsFinalData) ?? {}, 'day'),
    (acc, value) => acc + value,
    0
  );

  const absoluteValuesResults = absoluteValuesResultsInput ?? [];
  const absoluteValuesFinalData = sortBy(absoluteValuesResults, 'day');

  const lastAbsoluteValue = reduce(
    omit(last(absoluteValuesFinalData) ?? {}, 'day'),
    (acc, value) => acc + value,
    0
  );
  const firstAbsoluteValue = reduce(
    omit(first(absoluteValuesFinalData) ?? {}, 'day'),
    (acc, value) => acc + value,
    0
  );

  const firstPercentValue = firstTotalAssetsValue
    ? (firstAbsoluteValue / firstTotalAssetsValue) * 100
    : 0;
  const lastPercentValue = lastTotalAssetsValue
    ? (lastAbsoluteValue / lastTotalAssetsValue) * 100
    : 0;

  return lastPercentValue - firstPercentValue;
};

const RIGHT_SIDE_PANEL_LABEL_CONFIG: Partial<
  Record<SystemChartType, { key: string; entityKey: string }>
> = {
  [SystemChartType.TotalDataAssets]: {
    key: 'label.total-entity',
    entityKey: 'label.asset-plural',
  },
  [SystemChartType.PercentageOfServiceWithDescription]: {
    key: 'label.completed-entity',
    entityKey: 'label.description',
  },
  [SystemChartType.PercentageOfDataAssetWithDescription]: {
    key: 'label.completed-entity',
    entityKey: 'label.description',
  },
  [SystemChartType.PercentageOfDataAssetWithOwner]: {
    key: 'label.assigned-entity',
    entityKey: 'label.owner',
  },
  [SystemChartType.PercentageOfServiceWithOwner]: {
    key: 'label.assigned-entity',
    entityKey: 'label.owner',
  },
  [SystemChartType.TotalDataAssetsByTier]: {
    key: 'label.assigned-entity',
    entityKey: 'label.tier',
  },
};

const getChartLoadingState = (
  isLoading: boolean,
  isKpiLoading: boolean,
  resultsLength: number
): boolean => isLoading || isKpiLoading || resultsLength === 0;

const getProgressBarSuffix = (
  isPercentageGraph: boolean,
  type: SystemChartType
): string =>
  isPercentageGraph || type === SystemChartType.TotalDataAssetsByTier
    ? '%'
    : '';

interface ExploreAssetsLinkProps {
  type: SystemChartType;
  tabsInfo: ReturnType<typeof searchClassBase.getTabsInfo>;
  t: ReturnType<typeof useTranslation>['t'];
}

const ExploreAssetsLink = ({ type, tabsInfo, t }: ExploreAssetsLinkProps) => {
  const isDescriptionType =
    type === SystemChartType.PercentageOfDataAssetWithDescription;

  return (
    <Col className="d-flex justify-end" span={24}>
      <Link
        data-testid={`explore-asset-with-no-${
          isDescriptionType ? 'description' : 'owner'
        }`}
        to={getExplorePath({
          tab: tabsInfo[SearchIndex.TABLE].path,
          isPersistFilters: true,
          extraParameters: {
            queryFilter: JSON.stringify(
              isDescriptionType
                ? INCOMPLETE_DESCRIPTION_ADVANCE_SEARCH_FILTER
                : NO_OWNER_ADVANCE_SEARCH_FILTER
            ),
          },
        })}>
        <Button
          className="text-primary d-flex items-center gap-1"
          size="small"
          type="text">
          {t('label.explore-asset-plural-with-type', {
            type: isDescriptionType
              ? t('label.no-description')
              : t('label.no-owner'),
          })}
          <RightArrowIcon height={12} width={12} />
        </Button>
      </Link>
    </Col>
  );
};

export const DataInsightChartCard = ({
  type,
  header,
  subHeader,
  listAssets,
}: DataInsightChartCardProps) => {
  const tabsInfo = searchClassBase.getTabsInfo();
  const [chartData, setChartData] = useState<DataInsightCustomChartResult>({
    results: [],
  });
  const [totalAssets, setTotalAssets] = useState<DataInsightCustomChartResult>({
    results: [],
  });
  const [absoluteValues, setAbsoluteValues] = useState<AbsoluteValuesResult>({
    results: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [activeMouseHoverKey, setActiveMouseHoverKey] = useState('');
  const [searchEntityKeyWord, setSearchEntityKeyWord] = useState('');
  const {
    chartFilter,
    selectedDaysFilter: selectedDays,
    kpi,
    entitiesSummary,
  } = useDataInsightProvider();
  const isPercentageGraph = isPercentageSystemGraph(type);

  const { rightSideEntityList, latestData, graphData, changeInValue } =
    useMemo(() => {
      let changeInValue = 0;

      const results = chartData.results ?? [];
      const timeStampResults = groupBy(results, 'day');

      const graphResults = Object.entries(timeStampResults).map(
        ([key, value]) => {
          const keys = value.reduce((acc, curr) => {
            return { ...acc, [curr.group ?? 'count']: curr.count };
          }, {});

          return {
            day: +key,
            ...keys,
          };
        }
      );

      const finalData = sortBy(graphResults, 'day');

      const latestData: Record<string, number> = omit(
        last(finalData ?? {}),
        'day'
      );

      const uniqueLabels = Object.entries(latestData)
        .sort(([, valueA], [, valueB]) => valueB - valueA)
        .map(([key]) => key);

      if (type === SystemChartType.TotalDataAssets) {
        changeInValue = computeTotalDataAssetsChange(latestData, finalData);
      } else if (type === SystemChartType.TotalDataAssetsByTier) {
        // TotalDataAssetsByTier when Considering NoTier as well it has the TotalAssets
        changeInValue = computeTotalDataAssetsByTierChange(
          latestData,
          finalData,
          timeStampResults
        );
      } else {
        // Process TotalAssets and Absolute Values
        changeInValue = computeDefaultChange(
          totalAssets.results,
          absoluteValues.results
        );
      }

      return {
        rightSideEntityList: uniqueLabels.filter((entity) =>
          includes(toLower(entity), toLower(searchEntityKeyWord))
        ),
        latestData,
        graphData: finalData,
        changeInValue,
      };
    }, [chartData.results, searchEntityKeyWord]);

  const targetValue = useMemo(() => {
    if (
      [
        SystemChartType.PercentageOfDataAssetWithDescription,
        SystemChartType.PercentageOfDataAssetWithOwner,
        SystemChartType.PercentageOfServiceWithDescription,
        SystemChartType.PercentageOfServiceWithOwner,
      ].includes(type)
    ) {
      const kpiChart = [
        SystemChartType.PercentageOfDataAssetWithDescription,
        SystemChartType.PercentageOfServiceWithDescription,
      ].includes(type)
        ? DataInsightChart.PercentageOfDataAssetWithDescriptionKpi
        : DataInsightChart.PercentageOfDataAssetWithOwnerKpi;

      return kpi.data.find((value) => value.dataInsightChart.name === kpiChart)
        ?.targetValue;
    }

    return undefined;
  }, [kpi.data, type]);

  const totalValue = useMemo(() => {
    let data = { results: [{ count: 0 }] };
    switch (type) {
      case SystemChartType.TotalDataAssets:
        data = entitiesSummary[SystemChartType.TotalDataAssetsSummaryCard];

        break;

      case SystemChartType.PercentageOfDataAssetWithDescription:
      case SystemChartType.PercentageOfServiceWithDescription:
        data =
          entitiesSummary[SystemChartType.DataAssetsWithDescriptionSummaryCard];

        break;
      case SystemChartType.PercentageOfDataAssetWithOwner:
      case SystemChartType.PercentageOfServiceWithOwner:
        data = entitiesSummary[SystemChartType.DataAssetsWithOwnerSummaryCard];

        break;
      case SystemChartType.TotalDataAssetsByTier:
        data =
          entitiesSummary[SystemChartType.TotalDataAssetsWithTierSummaryCard];

        break;
    }

    return get(data, 'results.0.count', 0);
  }, [type, entitiesSummary]);

  const { t } = useTranslation();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const filter = getQueryFilterForDataInsightChart(
        chartFilter.team,
        chartFilter.tier
      );
      if (
        ![
          SystemChartType.TotalDataAssets,
          SystemChartType.TotalDataAssetsByTier,
        ].includes(type)
      ) {
        const totalAssetsResponse = await getChartPreviewByName(
          SystemChartType.TotalDataAssets,
          {
            start: chartFilter.startTs,
            end: chartFilter.endTs,
            filter,
          }
        );
        setTotalAssets(totalAssetsResponse);
      }

      if (
        [
          SystemChartType.PercentageOfServiceWithDescription,
          SystemChartType.PercentageOfDataAssetWithDescription,
        ].includes(type)
      ) {
        const absoluteValuesResponse = await getChartPreviewByName(
          SystemChartType.NumberOfDataAssetWithDescription,
          {
            start: chartFilter.startTs,
            end: chartFilter.endTs,
            filter,
          }
        );
        setAbsoluteValues(absoluteValuesResponse);
      } else if (
        [
          SystemChartType.PercentageOfServiceWithOwner,
          SystemChartType.PercentageOfDataAssetWithOwner,
        ].includes(type)
      ) {
        const absoluteValuesResponse = await getChartPreviewByName(
          SystemChartType.NumberOfDataAssetWithOwner,
          {
            start: chartFilter.startTs,
            end: chartFilter.endTs,
            filter,
          }
        );
        setAbsoluteValues(absoluteValuesResponse);
      }

      const response = await getChartPreviewByName(type, {
        start: chartFilter.startTs,
        end: chartFilter.endTs,
        filter,
      });
      setChartData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLegendClick = (entity: string) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(entity, prevActiveKeys)
    );
  };

  const handleLegendMouseEnter = (entity: string) => {
    setActiveMouseHoverKey(entity);
  };
  const handleLegendMouseLeave = () => {
    setActiveMouseHoverKey('');
  };

  useEffect(() => {
    !kpi.isLoading && fetchData();
  }, [
    chartFilter.startTs,
    chartFilter.endTs,
    chartFilter.team,
    chartFilter.tier,
    kpi.isLoading,
  ]);

  const rightSidePanelLabel = useMemo(() => {
    const config = RIGHT_SIDE_PANEL_LABEL_CONFIG[type];
    if (!config) {
      return '';
    }

    return (
      t(config.key, { entity: t(config.entityKey) }) +
      (isPercentageGraph ? ' %' : '')
    );
  }, [type, isPercentageGraph, t]);

  if (
    getChartLoadingState(isLoading, kpi.isLoading, chartData.results.length)
  ) {
    return (
      <Card
        className="data-insight-card"
        id={type}
        loading={isLoading}
        title={
          <PageHeader
            data={{
              header,
              subHeader: t('message.field-insight', {
                field: t('label.description-lowercase'),
              }),
            }}
          />
        }>
        <EmptyGraphPlaceholder />
      </Card>
    );
  }

  return (
    <Card
      className="data-insight-card data-insight-card-chart"
      data-testid={`${type}-graph`}
      id={type}>
      <Row gutter={DI_STRUCTURE.rowContainerGutter}>
        <Col span={DI_STRUCTURE.leftContainerSpan}>
          <PageHeader
            data={{
              header,
              subHeader,
            }}
          />
          <ResponsiveContainer
            className="m-t-lg"
            debounce={1}
            height={GRAPH_HEIGHT}
            id={`${type}-graph`}>
            {renderDataInsightLineChart(
              graphData,
              rightSideEntityList,
              activeKeys,
              activeMouseHoverKey,
              isPercentageGraph
            )}
          </ResponsiveContainer>
        </Col>
        <Col span={DI_STRUCTURE.rightContainerSpan}>
          <Row gutter={[8, 16]}>
            <Col span={24}>
              <DataInsightProgressBar
                changeInValue={changeInValue}
                duration={selectedDays}
                label={rightSidePanelLabel}
                progress={round(totalValue, 2)}
                showProgress={isPercentageGraph}
                suffix={getProgressBarSuffix(isPercentageGraph, type)}
                target={targetValue}
              />
            </Col>
            <Col span={24}>
              <Searchbar
                removeMargin
                searchValue={searchEntityKeyWord}
                onSearch={setSearchEntityKeyWord}
              />
            </Col>
            <Col className="chart-card-right-panel-container" span={24}>
              <Row gutter={[8, 8]}>
                {rightSideEntityList.map((entity, i) => {
                  return (
                    <Col
                      className="entity-summary-container"
                      key={entity}
                      span={24}
                      onClick={() => handleLegendClick(entity)}
                      onMouseEnter={() => handleLegendMouseEnter(entity)}
                      onMouseLeave={handleLegendMouseLeave}>
                      <EntitySummaryProgressBar
                        entity={startCase(entity)}
                        isActive={
                          activeKeys.length ? activeKeys.includes(entity) : true
                        }
                        label={`${round(latestData[entity] ?? 0, 2)}${
                          isPercentageGraph ? '%' : ''
                        }`}
                        pluralize={
                          ![
                            SystemChartType.TotalDataAssetsByTier,
                            SystemChartType.PercentageOfServiceWithDescription,
                            SystemChartType.PercentageOfServiceWithOwner,
                          ].includes(type)
                        }
                        progress={latestData[entity]}
                        strokeColor={entityChartColor(i)}
                      />
                    </Col>
                  );
                })}
              </Row>
            </Col>
            {activeKeys.length > 0 && (
              <Col className="flex justify-end" span={24}>
                <Button type="link" onClick={() => setActiveKeys([])}>
                  {t('label.clear')}
                </Button>
              </Col>
            )}
          </Row>
        </Col>
        {listAssets && (
          <ExploreAssetsLink t={t} tabsInfo={tabsInfo} type={type} />
        )}
      </Row>
    </Card>
  );
};
