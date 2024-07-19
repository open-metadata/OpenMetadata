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
import { first, groupBy, includes, map, round, toLower } from 'lodash';
import {
  default as React,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ResponsiveContainer } from 'recharts';
import { ReactComponent as RightArrowIcon } from '../../assets/svg/right-arrow.svg';
import { getExplorePath } from '../../constants/constants';
import {
  DI_STRUCTURE,
  GRAPH_HEIGHT,
  TOTAL_ENTITY_CHART_COLOR,
} from '../../constants/DataInsight.constants';
import { INCOMPLETE_DESCRIPTION_ADVANCE_SEARCH_FILTER } from '../../constants/explore.constants';

import { SearchIndex } from '../../enums/search.enum';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { useDataInsightProvider } from '../../pages/DataInsightPage/DataInsightProvider';
import {
  DataInsightCustomChartResult,
  getChartPreviewByName,
  SystemChartType,
} from '../../rest/DataInsightAPI';
import { updateActiveChartFilter } from '../../utils/ChartUtils';
import {
  isPercentageSystemGraph,
  renderDataInsightLineChart,
} from '../../utils/DataInsightUtils';
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [activeMouseHoverKey, setActiveMouseHoverKey] = useState('');
  const [searchEntityKeyWord, setSearchEntityKeyWord] = useState('');
  const {
    chartFilter,
    selectedDaysFilter: selectedDays,
    kpi,
  } = useDataInsightProvider();
  const isPercentageGraph = isPercentageSystemGraph(type);

  const { rightSideEntityList, latestData, graphData } = useMemo(() => {
    const results = chartData.results ?? [];

    const groupedResults = groupBy(results, 'group');
    const latestData: Record<string, number> = {};
    Object.entries(groupedResults).forEach(([key, value]) => {
      value.sort((a, b) => a.day - b.day);

      latestData[key] = first(value)?.count ?? 0;
    });

    const graphData = map(groupedResults, (value, key) => ({
      name: key,
      data: value,
    }));

    const labels = Object.keys(groupedResults);

    return {
      rightSideEntityList: labels.filter((entity) =>
        includes(toLower(entity), toLower(searchEntityKeyWord))
      ),
      latestData,
      graphData,
    };
  }, [chartData.results, searchEntityKeyWord]);

  const targetValue = useMemo(() => {
    if (type === SystemChartType.PercentageOfDataAssetWithDescription) {
      kpi.data.find(
        (value) =>
          value.dataInsightChart.name ===
          DataInsightChartType.PercentageOfEntitiesWithDescriptionByType
      )?.targetValue;
    }

    return undefined;
  }, [kpi]);

  const { t } = useTranslation();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await getChartPreviewByName(type, {
        start: chartFilter.startTs,
        end: chartFilter.endTs,
      });

      const newData = {
        results: response.results.map((result) => ({
          ...result,
          day: new Date(result.day).valueOf(),
        })),
      };

      setChartData(newData);
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
    fetchData();
  }, [chartFilter]);

  if (isLoading || kpi.isLoading || chartData.results.length === 0) {
    return (
      <Card
        className="data-insight-card"
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
      className="data-insight-card"
      data-testid="entity-description-percentage-card"
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
              activeKeys,
              activeMouseHoverKey,
              rightSideEntityList
            )}
          </ResponsiveContainer>
        </Col>
        <Col span={DI_STRUCTURE.rightContainerSpan}>
          <Row gutter={[8, 16]}>
            <Col span={24}>
              <DataInsightProgressBar
                changeInValue={0.2}
                duration={selectedDays}
                label={`${t('label.completed-entity', {
                  entity: t('label.description'),
                })}${isPercentageGraph ? ' %' : ''}`}
                progress={Number(100)}
                suffix={isPercentageGraph ? '%' : ''}
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
                        entity={entity}
                        isActive={
                          activeKeys.length ? activeKeys.includes(entity) : true
                        }
                        label={`${round(latestData[entity] ?? 0, 2)}${
                          isPercentageGraph ? '%' : ''
                        }`}
                        progress={latestData[entity]}
                        strokeColor={TOTAL_ENTITY_CHART_COLOR[i]}
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
          <Col className="d-flex justify-end" span={24}>
            <Link
              data-testid="explore-asset-with-no-description"
              to={getExplorePath({
                tab: tabsInfo[SearchIndex.TABLE].path,
                isPersistFilters: true,
                extraParameters: {
                  queryFilter: JSON.stringify(
                    INCOMPLETE_DESCRIPTION_ADVANCE_SEARCH_FILTER
                  ),
                },
              })}>
              <Button
                className="text-primary d-flex items-center gap-1"
                size="small"
                type="text">
                {t('label.explore-asset-plural-with-type', {
                  type: t('label.no-description'),
                })}
                <RightArrowIcon height={12} width={12} />
              </Button>
            </Link>
          </Col>
        )}
      </Row>
    </Card>
  );
};
