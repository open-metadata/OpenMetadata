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

import { PlusOutlined } from '@ant-design/icons';
import {
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';
import { Button, Space } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { createElement, Fragment, FunctionComponent, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  SSOFieldLayout,
  SSOSectionLayout,
} from '../../../constants/SSO.constant';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import './sso-grouped-field-template.less';

const ROOT_PREFIX = 'root/';

const stripRootPrefix = (idSchemaId: string): string =>
  idSchemaId.startsWith(ROOT_PREFIX)
    ? idSchemaId.slice(ROOT_PREFIX.length)
    : idSchemaId;

const isVisibleProperty = (prop: ObjectFieldTemplatePropertyType): boolean => {
  const element = prop.content;
  if (!element || prop.hidden) {
    return false;
  }

  if (
    element.type === 'input' &&
    element.props &&
    element.props.type === 'hidden'
  ) {
    return false;
  }

  return !(element.props?.style?.display === 'none' || element.props?.hidden);
};

const partitionByLayout = (
  properties: ObjectFieldTemplatePropertyType[],
  sectionLayout: SSOSectionLayout | undefined
): {
  mainProperties: ObjectFieldTemplatePropertyType[];
  advancedProperties: ObjectFieldTemplatePropertyType[];
} => {
  if (!sectionLayout) {
    return { mainProperties: properties, advancedProperties: [] };
  }

  const mainProperties: ObjectFieldTemplatePropertyType[] = [];
  const advancedProperties: ObjectFieldTemplatePropertyType[] = [];

  for (const prop of properties) {
    if (sectionLayout[prop.name] === 'advanced') {
      advancedProperties.push(prop);
    } else {
      mainProperties.push(prop);
    }
  }

  return { mainProperties, advancedProperties };
};

const renderProperty = (
  element: ObjectFieldTemplatePropertyType,
  index: number,
  hasAdditionalProperties?: boolean
) => (
  <div
    className={classNames('property-wrapper', {
      'additional-fields': hasAdditionalProperties,
    })}
    key={`${element.content.key}-${index}`}>
    {element.content}
  </div>
);

export const SSOGroupedFieldTemplate: FunctionComponent<
  ObjectFieldTemplateProps
> = (props: ObjectFieldTemplateProps) => {
  const { formContext, idSchema, title, onAddClick, schema, properties } =
    props;

  const fieldLayout = formContext?.fieldLayout as SSOFieldLayout | undefined;
  const advancedFieldsContainer = formContext?.advancedFieldsContainer as
    | HTMLElement
    | null
    | undefined;
  const sectionPath = stripRootPrefix(idSchema.$id);
  const sectionLayout = fieldLayout?.[sectionPath];

  const { mainProperties, advancedProperties } = useMemo(() => {
    const visibleProperties = properties.filter(isVisibleProperty);

    const { properties: enrichedNormalProperties } =
      serviceUtilClassBase.getProperties(visibleProperties);

    return partitionByLayout(enrichedNormalProperties, sectionLayout);
  }, [properties, sectionLayout]);

  const additionalFieldData = useMemo(
    () => serviceUtilClassBase.getProperties(properties),
    [properties]
  );

  const AdditionalField = additionalFieldData.additionalField;
  const additionalFieldContent = additionalFieldData.additionalFieldContent;

  const hasAdvanced = advancedProperties.length > 0;
  const hasAdditional = Boolean(schema.additionalProperties);
  const canPortalAdvanced = hasAdvanced && Boolean(advancedFieldsContainer);

  return (
    <Fragment>
      {title && title.trim() !== '' && (
        <Space className="w-full justify-between header-title-wrapper">
          <label
            className={classNames('control-label', {
              'font-medium text-base-color text-md':
                !schema.additionalProperties,
            })}
            id={`${idSchema.$id}__title`}>
            {title}
          </label>

          {hasAdditional && (
            <Button
              data-testid={`add-item-${title}`}
              icon={
                <PlusOutlined style={{ color: 'white', fontSize: '12px' }} />
              }
              id={`${idSchema.$id}`}
              size="small"
              type="primary"
              onClick={() => {
                onAddClick(schema)();
              }}
              onFocus={() => {
                if (!isUndefined(formContext?.handleFocus)) {
                  formContext.handleFocus(idSchema.$id);
                }
              }}
            />
          )}
        </Space>
      )}

      {AdditionalField &&
        createElement(AdditionalField, { data: additionalFieldContent })}

      <div className="sso-main-fields">
        {mainProperties.map((element, index) =>
          renderProperty(element, index, hasAdditional)
        )}
      </div>

      {canPortalAdvanced &&
        createPortal(
          <div className="sso-advanced-section" data-section={sectionPath}>
            {advancedProperties.map((element, index) =>
              renderProperty(element, index, hasAdditional)
            )}
          </div>,
          advancedFieldsContainer as HTMLElement
        )}
    </Fragment>
  );
};
