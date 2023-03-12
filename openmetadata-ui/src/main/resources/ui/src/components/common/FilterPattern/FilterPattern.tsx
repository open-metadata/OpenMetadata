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

import { Checkbox, Col, Input, Row, Typography } from 'antd';
import { t } from 'i18next';
import { capitalize, toLower } from 'lodash';
import React from 'react';
import {
  getFilterPatternDocsLinks,
  getSeparator,
} from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Field } from '../../Field/Field';
import { FilterPatternProps } from './filterPattern.interface';

const FilterPattern = ({
  showSeparator = true,
  checked,
  includePattern,
  excludePattern,
  handleChecked,
  getIncludeValue,
  getExcludeValue,
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
    <div className="m-t-md" data-testid="filter-pattern-container">
      <Row>
        <Col>
          <Checkbox
            checked={checked}
            className="m-r-sm filter-pattern-checkbox"
            data-testid={`${type}-filter-pattern-checkbox`}
            id={`${type}FilterPatternCheckbox`}
            name={`${type}FilterPatternCheckbox`}
            onChange={(e) => handleChecked(e.target.checked)}
          />
        </Col>
        <Col className="d-flex flex-col">
          <label htmlFor={`${type}FilterPatternCheckbox`}>{`${capitalize(
            type
          )} ${t('label.filter-pattern')}`}</label>
          <Typography.Text
            className="text-grey-muted m-t-xss"
            data-testid="filter-pattern-info">
            {t('message.filter-pattern-info', {
              filterPattern: type,
            })}{' '}
            <Typography.Link
              href={getFilterPatternDocsLinks(type)}
              target="_blank">
              {t('label.read-type', {
                type: t('label.more-lowercase'),
              })}{' '}
              <SVGIcons
                alt="external-link"
                className="m-l-xss"
                icon={Icons.EXTERNAL_LINK}
                width="14px"
              />
            </Typography.Link>
          </Typography.Text>
        </Col>
      </Row>
      {checked && (
        <div data-testid="field-container">
          <Field>
            <label className="d-flex flex-col">{t('label.include')}:</label>
            <Typography.Text
              className="text-grey-muted m-t-xss m-b-xss"
              data-testid="filter-pattern-include-info">
              {t('message.filter-pattern-include-exclude-info', {
                activity: toLower(t('label.include')),
                filterPattern: type,
              })}
            </Typography.Text>
            <Input
              className="m-t-xss"
              data-testid={`filter-pattern-includes-${type}`}
              placeholder={t('message.list-of-strings-regex-patterns-csv')}
              type="text"
              value={includePattern}
              onChange={includeFilterChangeHandler}
            />
          </Field>
          <Field>
            <label className="d-flex flex-col">{t('label.exclude')}:</label>
            <Typography.Text
              className="text-grey-muted m-t-xss m-b-xss"
              data-testid="filter-pattern-exclude-info">
              {t('message.filter-pattern-include-exclude-info', {
                activity: toLower(t('label.exclude')),
                filterPattern: type,
              })}
            </Typography.Text>
            <Input
              className="m-t-xss"
              data-testid={`filter-pattern-excludes-${type}`}
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
