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
import { Button, Col, Row } from 'antd';
import { Gutter } from 'antd/lib/grid/row';
import classNames from 'classnames';
import { includes, startCase, toLower } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateActiveChartFilter } from '../../utils/ChartUtils';
import { entityChartColor } from '../../utils/CommonUtils';
import { sortEntityByValue } from '../../utils/DataInsightUtils';
import Searchbar from '../common/SearchBarComponent/SearchBar.component';
import CustomStatistic from './CustomStatistic';
import EntitySummaryProgressBar from './EntitySummaryProgressBar.component';

type TotalEntityInsightSummaryProps = {
  total: string | number;
  relativePercentage: number;
  selectedDays: number;
  entities: string[];
  latestData: Record<string, number>;
  gutter?: Gutter | [Gutter, Gutter];
  onActiveKeysUpdate?: (entity: string[]) => void;
  onActiveKeyMouseHover?: (entity: string) => void;
  activeKeys?: string[];
  allowFilter?: boolean;
};

const TotalEntityInsightSummary = ({
  total,
  allowFilter = false,
  relativePercentage,
  selectedDays,
  entities,
  latestData,
  activeKeys,
  onActiveKeysUpdate,
  onActiveKeyMouseHover,
}: TotalEntityInsightSummaryProps) => {
  const { t } = useTranslation();
  const [searchEntityKeyWord, setSearchEntityKeyWord] = useState('');

  const sortedEntitiesByValue = useMemo(() => {
    return sortEntityByValue(entities, latestData);
  }, [entities, latestData]);

  const rightSideEntityList = useMemo(
    () =>
      sortedEntitiesByValue.filter((entity) =>
        includes(toLower(entity), toLower(searchEntityKeyWord))
      ),
    [sortedEntitiesByValue, searchEntityKeyWord]
  );

  const handleLegendClick = (entity: string) => {
    onActiveKeysUpdate?.(updateActiveChartFilter(entity, activeKeys ?? []));
  };

  const handleLegendMouseEnter = (entity: string) => {
    onActiveKeyMouseHover?.(entity);
  };
  const handleLegendMouseLeave = () => {
    onActiveKeyMouseHover?.('');
  };

  return (
    <Row data-testid="total-entity-insight-summary-container" gutter={[8, 16]}>
      <Col className="p-b-sm" span={24}>
        <CustomStatistic
          changeInValue={relativePercentage}
          duration={selectedDays}
          label={t('label.total-entity', {
            entity: t('label.asset-plural'),
          })}
          value={total}
        />
      </Col>
      {allowFilter && (
        <Col span={24}>
          <Searchbar
            removeMargin
            searchValue={searchEntityKeyWord}
            onSearch={setSearchEntityKeyWord}
          />
        </Col>
      )}
      <Col
        className={classNames({
          'chart-card-right-panel-container': allowFilter,
        })}
        span={24}>
        <Row gutter={[8, 8]}>
          {rightSideEntityList.map((entity, i) => {
            const progress = (latestData[entity] / Number(total)) * 100;

            return (
              <Col
                className={classNames({
                  'entity-summary-container': allowFilter,
                })}
                key={entity}
                span={24}
                onClick={() => handleLegendClick(entity)}
                onMouseEnter={() => handleLegendMouseEnter(entity)}
                onMouseLeave={handleLegendMouseLeave}>
                <EntitySummaryProgressBar
                  entity={startCase(entity)}
                  isActive={
                    activeKeys?.length ? activeKeys.includes(entity) : true
                  }
                  label={latestData[entity]}
                  progress={progress}
                  strokeColor={entityChartColor(i)}
                />
              </Col>
            );
          })}
        </Row>
      </Col>

      {activeKeys && activeKeys.length > 0 && allowFilter && (
        <Col className="flex justify-end" span={24}>
          <Button type="link" onClick={() => onActiveKeysUpdate?.([])}>
            {t('label.clear')}
          </Button>
        </Col>
      )}
    </Row>
  );
};

export default TotalEntityInsightSummary;
