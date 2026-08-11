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
import { debounce, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchRoles } from '../../../rest/rolesAPIV1';
import { showErrorToast } from '../../../utils/ToastUtils';
import './sso-configuration-form-array-field-template.less';

const SsoRolesSelectField = (props: FieldProps) => {
  const { t } = useTranslation();

  const [roleOptions, setRoleOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const id = props.idSchema.$id;
  const value: string[] = props.formData ?? [];
  const hasError = props.rawErrors && props.rawErrors.length > 0;

  const placeholder =
    props.uiSchema?.['ui:placeholder'] ?? t('label.select-field');
  const searchStateRef = useRef({
    roleOptions: [] as { label: string; value: string }[],
    value: [] as string[],
  });

  searchStateRef.current = { roleOptions, value };

  useEffect(() => {
    searchRoles('')
      .then((roles) => {
        setRoleOptions(
          (roles ?? []).map((role) => ({
            label: role.displayName || role.name,
            value: role.name,
          }))
        );
      })
      .catch((error: AxiosError) => showErrorToast(error));
  }, []);

  const debouncedSearchRoles = useMemo(
    () =>
      debounce(async (searchText: string) => {
        try {
          const results = await searchRoles(searchText);
          const searchOpts = (results ?? []).map((role) => ({
            label: role.displayName || role.name,
            value: role.name,
          }));
          const { roleOptions, value } = searchStateRef.current;
          const selectedSet = new Set(value);
          const kept = roleOptions.filter((option) =>
            selectedSet.has(option.value)
          );

          setRoleOptions([
            ...kept,
            ...searchOpts.filter((option) => !selectedSet.has(option.value)),
          ]);
        } catch (err) {
          showErrorToast(err as AxiosError);
        }
      }, 300),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearchRoles.cancel();
    };
  }, [debouncedSearchRoles]);

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
          filterOption={false}
          id={id}
          mode="multiple"
          options={roleOptions}
          placeholder={placeholder}
          status={hasError ? 'error' : undefined}
          value={value}
          onBlur={handleBlur}
          onChange={handleChange}
          onFocus={handleFocus}
          onSearch={debouncedSearchRoles}
        />
      </Col>
    </Row>
  );
};

export default SsoRolesSelectField;
