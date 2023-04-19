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

import { Checkbox, Col, Input, Row, Space, Typography } from 'antd';
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
  const includeFilterChangeHandler = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value ? event.target.value.split(',') : [];
    getIncludeValue(value, type);
  };

  const excludeFilterChangeHandler = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value ? event.target.value.split(',') : [];
    getExcludeValue(value, type);
  };

  return (
    <div data-testid="filter-pattern-container">
      <Row>
        <Col>
          <Checkbox
            checked={checked}
            className="m-r-sm filter-pattern-checkbox"
            data-testid={`${type}-filter-pattern-checkbox`}
            disabled={isDisabled}
            id={`root/${type}FilterPattern`}
            name={`root/${type}FilterPattern`}
            onChange={(e) => handleChecked(e.target.checked)}
          />
        </Col>
        <Col className="d-flex">
          <label htmlFor={`root/${type}FilterPattern`}>{`${capitalize(
            type
          )} ${t('label.filter-pattern')}`}</label>
        </Col>
      </Row>
      {checked && (
        <div data-testid="field-container">
          <Field>
            <Space size={2}>
              <label className="d-flex flex-col">{t('label.include')}:</label>
            </Space>

            <Input
              className="m-t-xss"
              data-testid={`filter-pattern-includes-${type}`}
              disabled={isDisabled}
              placeholder={t('message.list-of-strings-regex-patterns-csv')}
              type="text"
              value={includePattern}
              onChange={includeFilterChangeHandler}
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
            <Input
              className="m-t-xss"
              data-testid={`filter-pattern-excludes-${type}`}
              disabled={isDisabled}
              placeholder={t('message.list-of-strings-regex-patterns-csv')}
              type="text"
              value={excludePattern}
              onChange={excludeFilterChangeHandler}
            />
          </Field>
          {showSeparator && getSeparator('')}
        </div>
      )}
    </div>
  );
};

export default FilterPattern;
