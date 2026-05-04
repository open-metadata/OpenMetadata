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
import { ChevronDown, Plus } from '@untitledui/icons';
import { Fragment, FunctionComponent, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ADVANCED_PROPERTIES = new Set([
  'connectionArguments',
  'connectionOptions',
  'sampleDataStorageConfig',
  'scheme',
  'sslConfig',
  'sslMode',
]);

export const CoreObjectFieldTemplate: FunctionComponent<
  ObjectFieldTemplateProps
> = ({ title, description, onAddClick, schema, properties, idSchema }) => {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isRoot = idSchema.$id === 'root';

  const { normalProperties, advancedProperties } = properties.reduce(
    (acc, prop) => {
      if (prop.hidden) {
        return acc;
      }
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

  const propertiesContent = (
    <>
      <div className="tw:flex tw:flex-col tw:gap-8">
        {!isRoot && schema.additionalProperties && (
          <div className="tw:flex tw:items-center tw:justify-between">
            <Typography
              as="label"
              className="tw:text-secondary"
              size="text-xs"
              weight="medium">
              {t('label.additional-property-plural')}
            </Typography>
            <Button
              aria-label={t('label.add-entity', { entity: title })}
              color="primary"
              data-testid={`add-item-${title}`}
              id={`${idSchema.$id}`}
              size="sm"
              onClick={() => onAddClick(schema)()}>
              <Plus data-icon size={14} />
            </Button>
          </div>
        )}
        {normalProperties.map((element) => (
          <div key={element.name}>{element.content}</div>
        ))}
      </div>

      {advancedProperties.length > 0 && (
        <div className="tw:my-3">
          <button
            aria-expanded={advancedOpen}
            className={`tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:justify-between tw:rounded-lg tw:border tw:border-primary tw:bg-primary
            tw:px-4 tw:py-3 tw:text-left tw:transition-colors hover:tw:bg-secondary ${
              advancedOpen ? 'tw:border-b-0 tw:rounded-none' : ''
            }`}
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}>
            <Typography
              as="span"
              className="tw:text-primary"
              size="text-sm"
              weight="medium">
              {title
                ? `${title} ${t('label.advanced-config')}`
                : t('label.advanced-config')}
            </Typography>
            <ChevronDown
              data-icon
              className={`tw:transition-transform tw:duration-200 ${
                advancedOpen ? 'tw:rotate-180' : ''
              }`}
              size={16}
            />
          </button>
          {advancedOpen && (
            <div className="tw:flex tw:flex-col tw:gap-4  tw:border-1 tw:border-t-0 tw:border-primary tw:p-3">
              {advancedProperties.map((element) => (
                <div key={element.name}>{element.content}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (!isRoot && title) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:flex tw:flex-col tw:gap-0.5">
          <Typography
            as="label"
            className="tw:text-primary"
            id={`${idSchema.$id}__title`}
            size="text-sm"
            weight="semibold">
            {title}
          </Typography>
          {description && (
            <span className="tw:text-xs tw:text-[var(--color-text-secondary)]">
              {description}
            </span>
          )}
        </div>
        {propertiesContent}
      </div>
    );
  }

  return (
    <Fragment>
      {title && isRoot && (
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
      {propertiesContent}
    </Fragment>
  );
};
