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

import { FieldTemplateProps } from '@rjsf/utils';
import { Tag } from 'antd';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { DEPRECATED_SSO_PROPERTIES } from '../../../constants/Services.constant';

export const SSOFieldTemplate: FunctionComponent<FieldTemplateProps> = (
  props
) => {
  const {
    id,
    label,
    children,
    errors,
    help,
    description,
    hidden,
    required,
    displayLabel,
    schema,
    classNames: fieldClassNames,
  } = props;
  const { t } = useTranslation();

  if (hidden) {
    return <div className="hidden">{children}</div>;
  }

  const fieldName = id.split('/').pop() ?? '';
  const isDeprecated =
    Boolean(schema.deprecated) || DEPRECATED_SSO_PROPERTIES.includes(fieldName);
  const isBooleanField = schema.type === 'boolean';

  return (
    <div className={classNames('form-group', fieldClassNames)}>
      {displayLabel && label ? (
        // The rjsf-rendered control carries this id, so htmlFor is the association;
        // the deprecated rule additionally demands DOM nesting of the control.
        // eslint-disable-next-line jsx-a11y/label-has-for -- associated via htmlFor
        <label
          className={classNames('control-label', {
            'sso-deprecated-field-label': isDeprecated,
          })}
          htmlFor={id}>
          {label}
          {required && <span className="required">*</span>}
          {isDeprecated && (
            <Tag className="sso-deprecated-tag" color="orange">
              {t('label.deprecated')}
            </Tag>
          )}
        </label>
      ) : null}
      {displayLabel && description ? description : null}
      {isBooleanField && isDeprecated ? (
        <div className="sso-deprecated-boolean-wrapper">
          {children}
          <Tag className="sso-deprecated-tag" color="orange">
            {t('label.deprecated')}
          </Tag>
        </div>
      ) : (
        children
      )}
      {errors}
      {help}
    </div>
  );
};
