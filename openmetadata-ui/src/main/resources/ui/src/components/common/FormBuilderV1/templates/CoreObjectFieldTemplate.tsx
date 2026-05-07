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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { ObjectFieldTemplateProps } from '@rjsf/utils';
import { Plus } from '@untitledui/icons';
import { Fragment, FunctionComponent, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ADVANCED_PROPERTIES = new Set([
  'connectionArguments',
  'connectionOptions',
]);

export const CoreObjectFieldTemplate: FunctionComponent<
  ObjectFieldTemplateProps
> = ({ title, onAddClick, schema, properties, idSchema }) => {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { normalProperties, advancedProperties } = properties.reduce(
    (acc, prop) => {
      if (ADVANCED_PROPERTIES.has(prop.name)) {
        acc.advancedProperties.push(prop);
      } else {
        acc.normalProperties.push(prop);
      }

      return acc;
    },
    {
      normalProperties: [] as typeof properties,
      advancedProperties: [] as typeof properties,
    }
  );

  return (
    <Fragment>
      {title && (
        <div className="tw:flex tw:items-center tw:justify-between tw:mt-2">
          <Typography
            as="label"
            className="tw:text-primary"
            id={`${idSchema.$id}__title`}
            size="text-sm"
            weight="medium">
            {title}
          </Typography>
          {schema.additionalProperties && (
            <Button
              aria-label={t('label.add-entity', { entity: title })}
              color="primary"
              data-testid={`add-item-${title}`}
              id={`${idSchema.$id}`}
              size="sm"
              onClick={() => onAddClick(schema)()}>
              <Plus data-icon size={14} />
            </Button>
          )}
        </div>
      )}

      <div className="tw:flex tw:flex-col tw:gap-4">
        {normalProperties.map((element) => (
          <div key={element.name}>{element.content}</div>
        ))}
      </div>

      {advancedProperties.length > 0 && (
        <div className="tw:mt-3">
          <Button
            aria-label={
              advancedOpen
                ? t('label.hide-entity', { entity: t('label.advanced-config') })
                : t('label.show-entity', { entity: t('label.advanced-config') })
            }
            className="tw:flex tw:items-center tw:gap-1 tw:text-sm tw:font-medium tw:text-brand-primary hover:tw:underline"
            color="link-color"
            onClick={() => setAdvancedOpen((v) => !v)}>
            {advancedOpen
              ? t('label.hide-entity', { entity: t('label.advanced-config') })
              : t('label.show-entity', { entity: t('label.advanced-config') })}
          </Button>
          {advancedOpen && (
            <div className="tw:mt-2 tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:border-primary tw:p-3">
              {advancedProperties.map((element) => (
                <div key={element.name}>{element.content}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </Fragment>
  );
};
