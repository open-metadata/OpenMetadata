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

import {
  Button,
  Card,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';
import { ChevronDown, Plus } from '@untitledui/icons';
import classNames from 'classnames';
import { FocusEvent, FunctionComponent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SERVICE_FILTER_PATTERN_FIELDS } from '../../../../../constants/ServiceConnection.constants';
import {
  ADVANCED_PROPERTIES,
  INGESTION_BOOLEAN_CONFIG_FIELDS,
} from '../../../../../constants/ServiceType.constant';
import { hasVisibleProperties } from '../../../../../utils/JSONSchemaFormUtils';

const FILTER_PROPERTY_SET = new Set([
  ...SERVICE_FILTER_PATTERN_FIELDS,
  'useFqnForFiltering',
]);

const CONFIG_PROPERTY_SET = new Set(INGESTION_BOOLEAN_CONFIG_FIELDS);
const ADVANCED_PROPERTY_SET = new Set(ADVANCED_PROPERTIES);

interface SchemaProperty {
  anyOf?: unknown[];
  oneOf?: unknown[];
  type?: string | string[];
}

interface IngestionSectionConfig {
  collapsible: boolean;
  defaultOpen: boolean;
  description: string;
  index?: number;
  key: string;
  properties: ObjectFieldTemplatePropertyType[];
  schemaProperties: Record<string, SchemaProperty>;
  title: string;
}

interface PropertyGroups {
  advancedProperties: ObjectFieldTemplatePropertyType[];
  configProperties: ObjectFieldTemplatePropertyType[];
  filterPatternProperties: ObjectFieldTemplatePropertyType[];
  primaryProperties: ObjectFieldTemplatePropertyType[];
}

const isWide = (
  name: string,
  schemaProperties: Record<string, SchemaProperty>
): boolean => {
  const prop = schemaProperties[name];
  if (!prop) {
    return false;
  }
  if (prop.type === 'object' || prop.type === 'array') {
    return true;
  }

  const variants = [...(prop.oneOf ?? []), ...(prop.anyOf ?? [])] as Array<{
    type?: string;
  }>;

  const nonNullVariants = variants.filter((v) => v.type !== 'null');

  return nonNullVariants.some(
    (v) => v.type === 'object' || v.type === 'array' || v.type === undefined
  );
};

const groupProperties = (
  properties: ObjectFieldTemplatePropertyType[]
): PropertyGroups =>
  properties.reduce<PropertyGroups>(
    (groups, property) => {
      if (ADVANCED_PROPERTY_SET.has(property.name)) {
        return {
          ...groups,
          advancedProperties: [...groups.advancedProperties, property],
        };
      }
      if (FILTER_PROPERTY_SET.has(property.name)) {
        return {
          ...groups,
          filterPatternProperties: [
            ...groups.filterPatternProperties,
            property,
          ],
        };
      }
      if (CONFIG_PROPERTY_SET.has(property.name)) {
        return {
          ...groups,
          configProperties: [...groups.configProperties, property],
        };
      }

      return {
        ...groups,
        primaryProperties: [...groups.primaryProperties, property],
      };
    },
    {
      advancedProperties: [],
      configProperties: [],
      filterPatternProperties: [],
      primaryProperties: [],
    }
  );

const HiddenFields = ({
  properties,
}: {
  properties: ObjectFieldTemplatePropertyType[];
}) =>
  properties.length > 0 ? (
    <>
      {properties.map((element) => (
        <div className="property-wrapper tw:hidden" key={element.name}>
          {element.content}
        </div>
      ))}
    </>
  ) : null;

const SectionHeader = ({
  collapsible,
  description,
  index,
  open,
  title,
  onToggle,
}: {
  collapsible: boolean;
  description: string;
  index?: number;
  open: boolean;
  title: string;
  onToggle: () => void;
}) => (
  <button
    className="tw:flex tw:w-full tw:items-center tw:gap-2.5 tw:border-0 tw:bg-transparent tw:p-0 tw:text-left"
    type="button"
    onClick={() => {
      if (collapsible) {
        onToggle();
      }
    }}>
    {index != null && (
      <span className="tw:grid tw:size-5 tw:shrink-0 tw:place-items-center tw:rounded-full tw:bg-utility-brand-50 tw:text-xs tw:font-semibold tw:text-utility-brand-700">
        {index}
      </span>
    )}
    <span className="tw:flex-1">
      <span className="tw:block tw:text-sm tw:font-semibold tw:leading-6 tw:text-primary">
        {title}
      </span>
      {description && (
        <span className="tw:mt-0.5 tw:block tw:text-xs tw:text-tertiary">
          {description}
        </span>
      )}
    </span>
    {collapsible && (
      <ChevronDown
        className={classNames(
          'tw:flex-shrink-0 tw:text-fg-quaternary tw:transition-transform',
          open && 'tw:rotate-180'
        )}
        size={18}
      />
    )}
  </button>
);

type FieldGroup =
  | { properties: ObjectFieldTemplatePropertyType[]; type: 'grid' }
  | { property: ObjectFieldTemplatePropertyType; type: 'wide' };

const SectionFields = ({
  properties,
  schemaProperties,
}: {
  properties: ObjectFieldTemplatePropertyType[];
  schemaProperties: Record<string, SchemaProperty>;
}) => {
  const visibleProperties = properties.filter((p) => !p.hidden);
  const hiddenProperties = properties.filter((p) => p.hidden);
  const booleanProperties = visibleProperties.filter(
    (p) => schemaProperties[p.name]?.type === 'boolean'
  );
  const nonBooleanProperties = visibleProperties.filter(
    (p) => schemaProperties[p.name]?.type !== 'boolean'
  );

  const orderedFieldGroups = nonBooleanProperties.reduce<FieldGroup[]>(
    (groups, element) => {
      if (isWide(element.name, schemaProperties)) {
        groups.push({ property: element, type: 'wide' });

        return groups;
      }

      const lastGroup = groups[groups.length - 1];

      if (lastGroup?.type === 'grid') {
        lastGroup.properties.push(element);
      } else {
        groups.push({ properties: [element], type: 'grid' });
      }

      return groups;
    },
    []
  );

  const renderProperty = (
    element: ObjectFieldTemplatePropertyType,
    extraClassName?: string
  ) => (
    <div
      className={classNames('property-wrapper', extraClassName)}
      data-field-name={element.name}
      key={element.name}>
      {element.content}
    </div>
  );

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      {hiddenProperties.map((element) => renderProperty(element, 'tw:hidden'))}
      {orderedFieldGroups.map((group) =>
        group.type === 'grid' ? (
          <div
            className="tw:grid tw:grid-flow-row-dense tw:gap-3 tw:[grid-template-columns:repeat(3,minmax(0,1fr))]"
            key={group.properties[0].name}>
            {group.properties.map((element) => renderProperty(element))}
          </div>
        ) : (
          renderProperty(group.property, 'tw:w-full tw:min-w-0')
        )
      )}
      {booleanProperties.length > 0 && (
        <>
          {orderedFieldGroups.length > 0 && <Divider />}
          <div className="tw:flex tw:flex-col tw:gap-3">
            {booleanProperties.map((element) => renderProperty(element))}
          </div>
        </>
      )}
    </div>
  );
};

const SectionCard = ({ section }: { section: IngestionSectionConfig }) => {
  const [open, setOpen] = useState(section.defaultOpen);
  const [active, setActive] = useState(false);
  const showBody = !section.collapsible || open;
  const hasVisibleFields = section.properties.some((p) => !p.hidden);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocusedElement = event.relatedTarget as Node | null;

    if (
      !nextFocusedElement ||
      !event.currentTarget.contains(nextFocusedElement)
    ) {
      setActive(false);
    }
  };

  if (section.collapsible && !hasVisibleFields) {
    return <HiddenFields properties={section.properties} />;
  }

  return (
    <Card
      className="tw:p-5"
      color={active ? 'brandOutlined' : 'default'}
      data-testid={`ingestion-section-${section.key}`}
      onBlurCapture={handleBlur}
      onFocusCapture={() => setActive(true)}>
      <SectionHeader
        collapsible={section.collapsible}
        description={section.description}
        index={section.index}
        open={showBody}
        title={section.title}
        onToggle={() => setOpen((prev) => !prev)}
      />
      {showBody ? (
        <>
          <Divider className="tw:my-3" />
          <SectionFields
            properties={section.properties}
            schemaProperties={section.schemaProperties}
          />
        </>
      ) : (
        <HiddenFields properties={section.properties.filter((p) => p.hidden)} />
      )}
    </Card>
  );
};

export const IngestionObjectFieldTemplate: FunctionComponent<
  ObjectFieldTemplateProps
> = ({
  idSchema,
  onAddClick,
  properties,
  schema,
}: ObjectFieldTemplateProps) => {
  const { t } = useTranslation();
  const isRootLevel = idSchema.$id === 'root';

  if (!isRootLevel) {
    const nonRootSchemaProperties = (schema.properties ?? {}) as Record<
      string,
      SchemaProperty
    >;

    if (!schema.additionalProperties) {
      return (
        <SectionFields
          properties={properties}
          schemaProperties={nonRootSchemaProperties}
        />
      );
    }

    const visibleProperties = properties.filter((p) => !p.hidden);

    return (
      <div className="tw:flex tw:flex-col tw:gap-3">
        <div className="tw:flex tw:min-h-6 tw:items-center tw:justify-between tw:gap-4">
          <Typography
            as="label"
            className="tw:font-semibold tw:text-secondary"
            size="text-xs"
            weight="semibold">
            {t('label.additional-property-plural')}
          </Typography>
          <Button
            aria-label={t('label.add-entity', { entity: t('label.property') })}
            className="tw:inline-flex tw:size-7 tw:items-center tw:justify-center tw:rounded-[6px] tw:p-0 tw:leading-none"
            color="primary"
            size="sm"
            type="button"
            onClick={() => onAddClick(schema)()}>
            <Plus data-icon size={14} />
          </Button>
        </div>
        {visibleProperties.length === 0 ? (
          <Typography as="span" className="tw:text-tertiary" size="text-xs">
            {t('message.no-properties-added')}
          </Typography>
        ) : (
          <div className="tw:flex tw:flex-col tw:gap-2">
            {visibleProperties.map((element) => (
              <div
                className="property-wrapper"
                data-field-name={element.name}
                key={element.name}>
                {element.content}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const {
    advancedProperties,
    configProperties,
    filterPatternProperties,
    primaryProperties,
  } = groupProperties(properties);

  const schemaProperties = (schema.properties ?? {}) as Record<
    string,
    SchemaProperty
  >;

  const rawSections: IngestionSectionConfig[] = [
    ...(hasVisibleProperties(primaryProperties)
      ? [
          {
            collapsible: false,
            defaultOpen: true,
            description: t('message.agent-setup-description'),
            key: 'essential',
            properties: primaryProperties,
            schemaProperties,
            title: t('label.agent-setup'),
          },
        ]
      : []),
    ...(hasVisibleProperties(filterPatternProperties)
      ? [
          {
            collapsible: true,
            defaultOpen: false,
            description: t('message.filter-pattern-description'),
            key: 'filters',
            properties: filterPatternProperties,
            schemaProperties,
            title: t('label.filter-pattern-plural'),
          },
        ]
      : []),
    ...(hasVisibleProperties(configProperties)
      ? [
          {
            collapsible: true,
            defaultOpen: false,
            description: t('message.ingestion-configuration-description'),
            key: 'scope',
            properties: configProperties,
            schemaProperties,
            title: t('label.scope-and-behaviour'),
          },
        ]
      : []),
    ...(hasVisibleProperties(advancedProperties)
      ? [
          {
            collapsible: true,
            defaultOpen: false,
            description: t('message.advanced-config-section-description'),
            key: 'advanced',
            properties: advancedProperties,
            schemaProperties,
            title: t('label.advanced-config'),
          },
        ]
      : []),
  ];

  let counter = 0;
  const sections = rawSections.map((section) => ({
    ...section,
    index: section.key === 'advanced' ? undefined : ++counter,
  }));

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      {sections.map((section) => (
        <SectionCard key={section.key} section={section} />
      ))}
    </div>
  );
};
