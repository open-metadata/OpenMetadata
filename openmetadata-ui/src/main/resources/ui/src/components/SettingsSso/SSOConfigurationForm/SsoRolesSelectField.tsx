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
import { Col, Row, Select, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRoles } from '../../../rest/rolesAPIV1';
import { showErrorToast } from '../../../utils/ToastUtils';
import './sso-configuration-form-array-field-template.less';

const SsoRolesSelectField = (props: FieldProps) => {
  const { t } = useTranslation();

  const [roleOptions, setRoleOptions] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    getRoles('*', undefined, undefined, true, 1000)
      .then((response) => {
        setRoleOptions(
          (response.data || []).map((role) => ({
            label: role.displayName || role.name,
            value: role.name,
          }))
        );
      })
      .catch((error: AxiosError) => showErrorToast(error));
  }, []);

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
        <Select
          allowClear
          showSearch
          className={classNames('m-t-xss w-full', {
            'ant-select-status-error': hasError,
          })}
          data-testid={`sso-configuration-form-array-field-template-${props.name}`}
          disabled={props.disabled}
          id={id}
          mode="multiple"
          optionFilterProp="label"
          options={roleOptions}
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
