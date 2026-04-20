/*
 *  Copyright 2025 Collate.
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

import { FieldProps } from '@rjsf/utils';
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AsyncSelect } from '../../common/AsyncSelect/AsyncSelect';
import './sso-configuration-form-array-field-template.less';

const SsoRolesSelectField = (props: FieldProps) => {
  const { t } = useTranslation();

  const fetchRoleOptions = async (searchText: string, page?: number) => {
    try {
      const response = await searchQuery({
        query: searchText || '*',
        searchIndex: SearchIndex.ROLE,
        pageSize: 10,
        pageNumber: page ?? 1,
        fetchSource: true,
      });

      return {
        data: response.hits.hits.map((hit) => ({
          label: getEntityName(hit._source),
          value: hit._source.name,
        })),
        paging: {
          total: response.hits.total.value,
        },
      };
    } catch (error) {
      showErrorToast(error as AxiosError);

      return { data: [], paging: { total: 0 } };
    }
  };

  const id = props.idSchema.$id;
  const value: string[] = props.formData ?? [];
  const hasError = props.rawErrors && props.rawErrors.length > 0;

  const placeholder =
    props.uiSchema?.['ui:placeholder'] ?? t('label.select-field');

  const handleChange = useCallback(
    (newValue: string[]) => {
      props.onChange(newValue);
      if (props.formContext?.clearFieldError) {
        props.formContext.clearFieldError(props.idSchema.$id);
      }
    },
    [props.onChange, props.formContext, props.idSchema.$id]
  );

  const handleBlur = useCallback(() => {
    props.onBlur(id, value);
  }, [value, props.onBlur, id]);

  const handleFocus = () => {
    props.formContext?.handleFocus?.(id);
  };

  return (
    <Row className={classNames('field-error', { 'has-error': hasError })}>
      <Col span={24}>
        <Typography
          className={`array-field-label ${
            props.required ? 'required-field' : ''
          }`}>
          {startCase(props.name)}
        </Typography>
      </Col>
      <Col className="sso-select-container" span={24}>
        <AsyncSelect
          showSearch
          api={fetchRoleOptions}
          className={classNames('m-t-xss w-full', {
            'ant-select-status-error': hasError,
          })}
          data-testid={`sso-configuration-form-array-field-template-${props.name}`}
          disabled={props.disabled}
          id={id}
          mode="multiple"
          placeholder={placeholder}
          status={hasError ? 'error' : undefined}
          value={value}
          onBlur={handleBlur}
          onChange={handleChange}
          onFocus={handleFocus}
        />
      </Col>
    </Row>
  );
};

export default SsoRolesSelectField;
