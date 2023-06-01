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

import { Checkbox, Col, Row, Select, Space, Typography } from 'antd';
import { t } from 'i18next';
import { capitalize } from 'lodash';
import React from 'react';
import { getSeparator } from '../../../utils/CommonUtils';
import { Field } from '../../Field/Field';
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
  return (
    <div data-testid="filter-pattern-container">
      <Row>
        <Col span={8}>
          <label htmlFor={`root/${type}FilterPattern`}>{`${capitalize(
            type
          )} ${t('label.filter-pattern')}`}</label>
        </Col>
        <Col span={16}>
          <Checkbox
            checked={checked}
            className="filter-pattern-checkbox"
            data-testid={`${type}-filter-pattern-checkbox`}
            disabled={isDisabled}
            id={`root/${type}FilterPattern`}
            name={`root/${type}FilterPattern`}
            onChange={(e) => handleChecked(e.target.checked)}
          />
        </Col>
      </Row>
      {checked && (
        <div data-testid="field-container">
          <Field>
            <Space size={2}>
              <label className="d-flex flex-col">{t('label.include')}:</label>
            </Space>

            <Select
              className="m-t-xss"
              data-testid={`filter-pattern-includes-${type}`}
              disabled={isDisabled}
              mode="tags"
              placeholder={t('message.filter-pattern-placeholder')}
              value={includePattern ?? []}
              onChange={(value) => getIncludeValue(value, type)}
            />

            {includePatternExtraInfo && (
              <Typography.Text
                className="text-grey-muted m-t-xss m-b-xss"
                data-testid="filter-pattern-include-info">
                {includePatternExtraInfo}
              </Typography.Text>
            )}
          </Field>
          <Field>
            <Space size={2}>
              <label className="d-flex flex-col">{t('label.exclude')}:</label>
            </Space>
            <Select
              className="m-t-xss"
              data-testid={`filter-pattern-excludes-${type}`}
              disabled={isDisabled}
              mode="tags"
              placeholder={t('message.filter-pattern-placeholder')}
              value={excludePattern ?? []}
              onChange={(value) => getExcludeValue(value, type)}
            />
          </Field>
          {showSeparator && getSeparator('')}
        </div>
      )}
    </div>
  );
};

export default FilterPattern;
