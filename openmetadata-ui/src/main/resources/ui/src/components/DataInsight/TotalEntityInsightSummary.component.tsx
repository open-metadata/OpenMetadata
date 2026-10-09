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
import { Grid } from '@openmetadata/ui-core-components';
import { useChartPalette } from '@openmetadata/ui-core-components/charts';
import { Button } from 'antd';
import { Gutter } from 'antd/lib/grid/row';
import classNames from 'classnames';
import { includes, startCase, toLower } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateActiveChartFilter } from '../../utils/ChartUtils';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { dataInsightColor } from '../../utils/DataInsightChartUtils';
import { sortEntityByValue } from '../../utils/DataInsightPureUtils';
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
  const palette = useChartPalette();
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
    <Grid
      className="layout-row layout-grid"
      data-testid="total-entity-insight-summary-container"
      style={getLayoutGutter(8, 16)}>
      <Grid.Item className="layout-column p-b-sm" span={24}>
        <CustomStatistic
          changeInValue={relativePercentage}
          duration={selectedDays}
          label={t('label.total-entity', {
            entity: t('label.asset-plural'),
          })}
          value={total}
        />
      </Grid.Item>
      {allowFilter && (
        <Grid.Item className="layout-column" span={24}>
          <Searchbar
            removeMargin
            searchValue={searchEntityKeyWord}
            onSearch={setSearchEntityKeyWord}
          />
        </Grid.Item>
      )}
      <Grid.Item
        className={`layout-column ${classNames({
          'chart-card-right-panel-container': allowFilter,
        })}`}
        span={24}>
        <Grid className="layout-row layout-grid" style={getLayoutGutter(8, 8)}>
          {rightSideEntityList.map((entity) => {
            const progress = (latestData[entity] / Number(total)) * 100;

            return (
              <Grid.Item
                className={`layout-column ${classNames({
                  'entity-summary-container': allowFilter,
                })}`}
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
                  strokeColor={dataInsightColor(
                    palette,
                    sortedEntitiesByValue,
                    entity
                  )}
                />
              </Grid.Item>
            );
          })}
        </Grid>
      </Grid.Item>

      {activeKeys && activeKeys.length > 0 && allowFilter && (
        <Grid.Item className="layout-column flex justify-end" span={24}>
          <Button type="link" onClick={() => onActiveKeysUpdate?.([])}>
            {t('label.clear')}
          </Button>
        </Grid.Item>
      )}
    </Grid>
  );
};

export default TotalEntityInsightSummary;
