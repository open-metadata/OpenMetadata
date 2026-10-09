/*
 *  Copyright 2022 Collate.
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

import {
  Box,
  Divider,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import { Checkbox, Select } from 'antd';
import { capitalize } from 'lodash';
import { useTranslation } from 'react-i18next';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { FilterPatternProps } from './filterPattern.interface';

const FilterPattern = ({
  showSeparator = true,
  isDisabled = false,
  checked,
  includePattern,
  excludePattern,
  handleChecked,
  getIncludeValue,
  getExcludeValue,
  includePatternExtraInfo,
  type,
}: FilterPatternProps) => {
  const { t } = useTranslation();

  return (
    <div data-testid="filter-pattern-container">
      <Grid className="layout-row layout-grid">
        <Grid.Item className="layout-column" span={8}>
          {/* eslint-disable-next-line jsx-a11y/label-has-for -- htmlFor-linked to checkbox (sibling column) */}
          <label htmlFor={`root/${type}FilterPattern`}>{`${capitalize(
            type
          )} ${t('label.filter-pattern')}`}</label>
        </Grid.Item>
        <Grid.Item className="layout-column" span={16}>
          <Checkbox
            checked={checked}
            className="filter-pattern-checkbox"
            data-testid={`${type}-filter-pattern-checkbox`}
            disabled={isDisabled}
            id={`root/${type}FilterPattern`}
            name={`root/${type}FilterPattern`}
            onChange={(e) => handleChecked(e.target.checked)}
          />
        </Grid.Item>
      </Grid>
      {checked && (
        <Grid
          className="layout-row layout-grid m-t-xs"
          data-testid="field-container"
          style={{ ...getLayoutGutter(0, 16) }}>
          <Grid.Item className="layout-column" span={24}>
            <Box
              inline
              align="center"
              className="layout-space layout-space-horizontal"
              itemClassName="layout-space-item"
              style={{ gap: 'var(--om-space-2)' }}>
              <span className="d-flex flex-col">{t('label.include')}:</span>
            </Box>

            <Select
              className="m-t-xss"
              data-testid={`filter-pattern-includes-${type}`}
              disabled={isDisabled}
              mode="tags"
              open={false}
              placeholder={t('message.filter-pattern-placeholder')}
              value={includePattern ?? []}
              onChange={(value) => getIncludeValue(value, type)}
            />

            {includePatternExtraInfo && (
              <Typography
                className="m-t-xss m-b-xss"
                color="secondary"
                data-testid="filter-pattern-include-info">
                {includePatternExtraInfo}
              </Typography>
            )}
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <Box
              inline
              align="center"
              className="layout-space layout-space-horizontal"
              itemClassName="layout-space-item"
              style={{ gap: 'var(--om-space-2)' }}>
              <span className="d-flex flex-col">{t('label.exclude')}:</span>
            </Box>
            <Select
              className="m-t-xss"
              data-testid={`filter-pattern-excludes-${type}`}
              disabled={isDisabled}
              mode="tags"
              open={false}
              placeholder={t('message.filter-pattern-placeholder')}
              value={excludePattern ?? []}
              onChange={(value) => getExcludeValue(value, type)}
            />

            {showSeparator && <Divider className="tw:my-6" />}
          </Grid.Item>
        </Grid>
      )}
    </div>
  );
};

export default FilterPattern;
