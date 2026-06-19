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

import { Card, Divider } from '@openmetadata/ui-core-components';
import {
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';
import { ChevronDown, InfoCircle, Key01, Lock01 } from '@untitledui/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import {
  Children,
  cloneElement,
  createElement,
  FocusEvent,
  FunctionComponent,
  isValidElement,
  ReactElement,
  ReactNode,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ADVANCED_PROPERTIES } from '../../../../../constants/ServiceType.constant';
import { Transi18next } from '../../../../../utils/i18next/LocalUtil';
import { getMissingSchemaRequiredFieldsCountForSelectedBranch } from '../../../../../utils/ServiceConnectionUtils';
import serviceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import { CoreObjectFieldTemplate } from '../../../FormBuilderV1/templates/CoreObjectFieldTemplate';
import './connection-object-field-template.less';
import { ObjectFieldTemplate } from './ObjectFieldTemplate';

const SingleCredentialNote = ({ method }: { method: string }) => {
  return (
    <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs">
      <InfoCircle className="tw:text-fg-quaternary" size={14} />
      <span className="tw:text-tertiary">
        <Transi18next
          i18nKey="message.auth-single-credential-stored"
          renderElement={
            <strong className="tw:font-medium tw:text-secondary" />
          }
          values={{ method }}
        />
      </span>
    </div>
  );
};

const AUTH_PROPERTY = 'authType';
const PASSWORD_METHOD = 'password';
const SERVICE_TYPE_PROPERTY = 'type';
const REQUIRED_AUTH_PROPERTIES = new Set([
  'apiKey',
  'clientSecret',
  'password',
  'privateKey',
  'secretKey',
  'token',
]);
const OPTIONAL_SCOPE_PROPERTIES = new Set([
  'apiCollectionFilterPattern',
  'apiEndpointFilterPattern',
  'chartFilterPattern',
  'containerFilterPattern',
  'dashboardFilterPattern',
  'dataModelFilterPattern',
  'databaseFilterPattern',
  'databaseName',
  'directoryFilterPattern',
  'domainFilterPattern',
  'fileFilterPattern',
  'glossaryFilterPattern',
  'mlModelFilterPattern',
  'modelFilterPattern',
  'pipelineFilterPattern',
  'projectFilterPattern',
  'schemaFilterPattern',
  'searchIndexFilterPattern',
  'serverFilterPattern',
  'sobjectNames',
  'spreadsheetFilterPattern',
  'storedProcedureFilterPattern',
  'supportsMetadataExtraction',
  'tableFilterPattern',
  'topicFilterPattern',
  'worksheetFilterPattern',
]);
const PRIVATE_KEY_AUTH_PROPERTIES = new Set([
  'privateKey',
  'snowflakePrivatekeyPassphrase',
]);
const ADVANCED_PRIMARY_PROPERTY_ORDER = [
  'scheme',
  'useAccessHistory',
  'accessHistoryChunkSize',
];
const OPTIONAL_CONNECTION_PROPERTIES = new Set([
  'billingProjectId',
  'hostPort',
]);

interface SectionConfig {
  key: string;
  index?: number;
  title: string;
  description: string;
  properties: ObjectFieldTemplatePropertyType[];
  schemaProperties: Record<string, SchemaProperty>;
  collapsible: boolean;
  defaultOpen: boolean;
  layout: 'grid' | 'stack';
  badge?: ReactNode;
  wideNames?: Set<string>;
  inlineBooleans?: boolean;
  focusName?: string;
  onFocus?: (fieldName: string) => void;
}

interface SchemaProperty {
  anyOf?: unknown[];
  format?: string;
  oneOf?: unknown[];
  type?: string | string[];
}

const ReqBadge = ({
  children,
  tone = 'quiet',
}: {
  children: ReactNode;
  tone?: 'quiet' | 'info' | 'error';
}) => {
  const toneClass = {
    info: 'tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:text-utility-brand-700',
    error:
      'tw:border-utility-error-200 tw:bg-utility-error-50 tw:text-utility-error-700',
    quiet: 'tw:border-secondary tw:bg-secondary tw:text-tertiary',
  }[tone];

  return (
    <span
      className={classNames(
        'tw:rounded-full tw:border tw:px-1 tw:py-0.25 tw:text-xs tw:font-semibold',
        toneClass
      )}>
      {children}
    </span>
  );
};

const SectionHeader = ({
  index,
  title,
  description,
  badge,
  collapsible,
  open,
  onToggle,
  onFocus,
}: {
  index?: number;
  title: string;
  description: string;
  badge?: ReactNode;
  collapsible: boolean;
  open: boolean;
  onToggle: () => void;
  onFocus?: () => void;
}) => (
  <button
    className="connection-section-header tw:flex tw:items-center tw:justify-between tw:w-full tw:gap-2.5 tw:border-0 tw:bg-transparent tw:p-0 tw:text-left"
    type="button"
    onClick={() => {
      onFocus?.();
      if (collapsible) {
        onToggle();
      }
    }}>
    <span className="tw:flex tw:gap-2.5">
      {index != null && (
        <span className="tw:grid tw:size-6 tw:flex-shrink-0 tw:place-items-center tw:rounded-full tw:bg-utility-brand-50 tw:text-xs tw:font-semibold tw:text-utility-brand-700 tw:mt-1">
          {index}
        </span>
      )}
      <span className="tw:flex-1">
        <span className="tw:flex tw:items-center tw:gap-2">
          <span className="connection-section-header-title tw:text-md tw:font-semibold tw:leading-4 tw:text-primary">
            {title}
          </span>
          {badge}
        </span>
        {description && (
          <span className="connection-section-header-description tw:mt-0.5 tw:block tw:text-xs tw:text-tertiary">
            {description}
          </span>
        )}
      </span>
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

const hasHiddenClassName = (className?: unknown): boolean =>
  typeof className === 'string' &&
  /(^|\s)(tw:hidden|hidden)(\s|$)/.test(className);

const hasHiddenContent = (node: ReactNode): boolean => {
  if (!isValidElement(node)) {
    return false;
  }

  const props = node.props as {
    children?: ReactNode;
    className?: unknown;
    hidden?: boolean;
    style?: {
      display?: string;
      visibility?: string;
    };
  };

  if (
    props.hidden ||
    hasHiddenClassName(props.className) ||
    props.style?.display === 'none' ||
    props.style?.visibility === 'hidden'
  ) {
    return true;
  }

  const children = Children.toArray(props.children);

  return children.length > 0 && children.every(hasHiddenContent);
};

const isVisibleProperty = (
  property: ObjectFieldTemplatePropertyType
): boolean => !property.hidden && !hasHiddenContent(property.content);

const hasVisibleProperties = (
  properties: ObjectFieldTemplatePropertyType[]
): boolean => properties.some(isVisibleProperty);

const SectionFields = ({
  properties,
  layout,
  schemaProperties,
  wideNames,
  inlineBooleans,
  sectionKey,
}: {
  properties: ObjectFieldTemplatePropertyType[];
  layout: 'grid' | 'stack';
  schemaProperties: Record<string, SchemaProperty>;
  wideNames?: Set<string>;
  inlineBooleans?: boolean;
  sectionKey?: string;
}) => {
  const isBoolean = (name: string) =>
    schemaProperties[name]?.type === 'boolean';
  const isWideProperty = (name: string) => wideNames?.has(name) ?? false;
  const hiddenProperties = properties.filter(
    (element) => !isVisibleProperty(element)
  );
  const visibleProperties = properties.filter(isVisibleProperty);
  const booleanProperties = inlineBooleans
    ? []
    : visibleProperties.filter((element) => isBoolean(element.name));
  const orderedFieldGroups = visibleProperties
    .filter((element) => inlineBooleans || !isBoolean(element.name))
    .reduce<
      Array<
        | {
            properties: ObjectFieldTemplatePropertyType[];
            type: 'grid';
          }
        | {
            property: ObjectFieldTemplatePropertyType;
            type: 'wide';
          }
      >
    >((groups, element) => {
      if (isWideProperty(element.name)) {
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
    }, []);

  const renderProperty = (
    element: ObjectFieldTemplatePropertyType,
    index: number,
    extraClassName?: string
  ) => (
    <div
      className={classNames('property-wrapper', extraClassName)}
      data-field-name={element.name}
      key={`${element.content.key}-${index}`}>
      {element.content}
    </div>
  );

  if (layout === 'stack') {
    return (
      <div className="connection-section-fields tw:flex tw:flex-col tw:gap-3">
        {hiddenProperties.map((element, index) =>
          renderProperty(element, index, 'tw:hidden')
        )}
        {visibleProperties.map((element, index) =>
          renderProperty(element, index)
        )}
      </div>
    );
  }

  if (sectionKey === 'advanced') {
    const visiblePropertyMap = new Map(
      visibleProperties.map((element) => [element.name, element])
    );
    const primaryProperties = ADVANCED_PRIMARY_PROPERTY_ORDER.flatMap(
      (name) => {
        const property = visiblePropertyMap.get(name);

        return property ? [property] : [];
      }
    );
    const primaryPropertyNames = new Set(
      primaryProperties.map((element) => element.name)
    );
    const remainingProperties = visibleProperties.filter(
      (element) => !primaryPropertyNames.has(element.name)
    );
    const scalarProperties = remainingProperties.filter(
      (element) => !isWideProperty(element.name)
    );
    const fullRowProperties = remainingProperties.filter((element) =>
      isWideProperty(element.name)
    );

    return (
      <div
        className="connection-advanced-section-fields tw:flex tw:flex-col tw:gap-4"
        data-testid="connection-advanced-section-fields">
        {hiddenProperties.map((element, index) =>
          renderProperty(element, index, 'tw:hidden')
        )}
        {primaryProperties.length > 0 && (
          <div className="connection-advanced-primary-grid tw:grid tw:grid-flow-row-dense tw:[grid-template-columns:repeat(3,minmax(0,1fr))] tw:gap-5 tw:items-start">
            {primaryProperties.map((element, index) =>
              renderProperty(element, index)
            )}
          </div>
        )}
        {scalarProperties.length > 0 && (
          <div className="connection-advanced-secondary-grid tw:grid tw:grid-flow-row-dense tw:[grid-template-columns:repeat(3,minmax(0,1fr))] tw:gap-5 tw:items-start">
            {scalarProperties.map((element, index) =>
              renderProperty(element, index)
            )}
          </div>
        )}
        {fullRowProperties.length > 0 && (
          <div className="connection-advanced-full-rows tw:flex tw:flex-col tw:gap-5">
            {fullRowProperties.map((element, index) =>
              renderProperty(
                element,
                index,
                'connection-advanced-full-row tw:pt-4 tw:border-t tw:border-secondary'
              )
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      {hiddenProperties.map((element, index) =>
        renderProperty(element, index, 'tw:hidden')
      )}
      {orderedFieldGroups.map((group, groupIndex) =>
        group.type === 'grid' ? (
          <div
            className="connection-section-field-grid tw:grid tw:grid-flow-row-dense tw:gap-3 tw:[grid-template-columns:repeat(3,minmax(0,1fr))]"
            key={`grid-${groupIndex}`}>
            {group.properties.map((element, index) =>
              renderProperty(element, index)
            )}
          </div>
        ) : (
          renderProperty(
            group.property,
            groupIndex,
            'connection-section-wide-property tw:w-full tw:min-w-0'
          )
        )
      )}
      {booleanProperties.length > 0 && (
        <>
          {orderedFieldGroups.length > 0 && (
            <div className="tw:h-px tw:bg-secondary" />
          )}
          <div className="connection-section-boolean-grid tw:grid tw:gap-3 tw:[grid-template-columns:repeat(2,minmax(0,1fr))]">
            {booleanProperties.map((element, index) =>
              renderProperty(element, index)
            )}
          </div>
        </>
      )}
    </div>
  );
};

const HiddenFields = ({
  properties,
}: {
  properties: ObjectFieldTemplatePropertyType[];
}) =>
  properties.length > 0 ? (
    <>
      {properties.map((element, index) => (
        <div
          className="property-wrapper tw:hidden"
          key={`${element.content.key}-${index}`}>
          {element.content}
        </div>
      ))}
    </>
  ) : null;

// Snowflake-style connectors expose `password` and `privateKey`/passphrase as
// flat secret siblings. We present them as the design's Password / Key pair tabs
// by show/hiding the already-rendered fields — no schema oneOf, so no RJSF
// re-render loop.
const hasAuthTabs = (properties: ObjectFieldTemplatePropertyType[]): boolean =>
  properties.some((p) => p.name === PASSWORD_METHOD) &&
  properties.some((p) => PRIVATE_KEY_AUTH_PROPERTIES.has(p.name));

const getFirstVisibleFieldName = (
  properties: ObjectFieldTemplatePropertyType[],
  fallback: string
): string =>
  properties.find((property) => isVisibleProperty(property))?.name ??
  properties[0]?.name ??
  fallback;

const AuthTabs = ({
  properties,
}: {
  properties: ObjectFieldTemplatePropertyType[];
}) => {
  const { t } = useTranslation();
  const [method, setMethod] = useState<'password' | 'keypair'>('password');
  const tabs = [
    {
      id: 'password' as const,
      label: t('label.password'),
      Icon: Lock01,
      fields: properties.filter((p) => p.name === PASSWORD_METHOD),
    },
    {
      id: 'keypair' as const,
      label: t('label.key-pair'),
      Icon: Key01,
      fields: properties.filter((p) => p.name !== PASSWORD_METHOD),
    },
  ];
  const active = tabs.find((tab) => tab.id === method) ?? tabs[0];
  const renderAuthProperty = (
    element: ObjectFieldTemplatePropertyType,
    index: number
  ) => {
    const content =
      REQUIRED_AUTH_PROPERTIES.has(element.name) &&
      isValidElement(element.content) &&
      typeof element.content.type !== 'string'
        ? cloneElement(
            element.content as ReactElement<{ required?: boolean }>,
            {
              required: true,
            }
          )
        : element.content;

    return (
      <div className="property-wrapper" key={`${element.content.key}-${index}`}>
        {content}
      </div>
    );
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-3" data-testid="auth-tabs">
      <div className="tw:grid tw:grid-cols-2 tw:gap-1 tw:rounded-xl tw:border tw:border-primary tw:bg-secondary tw:p-1">
        {tabs.map((tab) => {
          const isActive = tab.id === method;

          return (
            <button
              className={classNames(
                'tw:flex tw:h-7 tw:items-center tw:justify-center tw:gap-2 tw:rounded-lg tw:border tw:px-3 tw:text-xs tw:transition-colors',
                isActive
                  ? 'tw:border-primary tw:bg-primary tw:font-medium tw:text-primary tw:shadow-xs'
                  : 'tw:border-transparent tw:font-medium tw:text-tertiary'
              )}
              data-testid={`auth-tab-${tab.id}`}
              key={tab.id}
              type="button"
              onClick={() => setMethod(tab.id)}>
              <tab.Icon
                className={
                  isActive ? 'tw:text-brand-secondary' : 'tw:text-fg-quaternary'
                }
                size={16}
              />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="tw:flex tw:flex-col tw:gap-3">
        {active.fields.map(renderAuthProperty)}
      </div>
      <SingleCredentialNote method={active.label} />
    </div>
  );
};

const SectionCard = ({ section }: { section: SectionConfig }) => {
  const [open, setOpen] = useState(section.defaultOpen);
  const [active, setActive] = useState(false);
  const showBody = !section.collapsible || open;
  const hasVisibleFields = hasVisibleProperties(section.properties);
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
      className={classNames(
        'connection-section-card tw:p-5',
        `connection-section-card-${section.key}`
      )}
      color={active ? 'brandOutlined' : 'default'}
      data-testid={`connection-section-${section.key}`}
      onBlurCapture={handleBlur}
      onFocusCapture={() => setActive(true)}>
      <SectionHeader
        badge={section.badge}
        collapsible={section.collapsible}
        description={section.description}
        index={section.index}
        open={showBody}
        title={section.title}
        onFocus={() => {
          setActive(true);
          section.focusName && section.onFocus?.(section.focusName);
        }}
        onToggle={() => setOpen((value) => !value)}
      />
      {showBody && (
        <>
          <Divider className={classNames('tw:my-3')} />
          {section.key === 'authentication' &&
          hasAuthTabs(section.properties) ? (
            <AuthTabs properties={section.properties} />
          ) : (
            <SectionFields
              inlineBooleans={section.inlineBooleans}
              layout={section.layout}
              properties={section.properties}
              schemaProperties={section.schemaProperties}
              sectionKey={section.key}
              wideNames={section.wideNames}
            />
          )}
        </>
      )}
      {!showBody && (
        <HiddenFields
          properties={section.properties.filter(
            (property) => !isVisibleProperty(property)
          )}
        />
      )}
    </Card>
  );
};

const isRootConnectionObject = (props: ObjectFieldTemplateProps): boolean =>
  props.idSchema.$id === 'root';

interface ConnectionFormContext {
  handleFocus?: (fieldName: string) => void;
}

const ConnectionObjectFieldTemplate: FunctionComponent<
  ObjectFieldTemplateProps
> = (props) => {
  const { t } = useTranslation();
  const { formContext, formData, properties, schema } = props;
  const connectionFormContext = formContext as
    | ConnectionFormContext
    | undefined;

  let rendered: ReactNode;
  if (!isRootConnectionObject(props)) {
    rendered = (
      <div
        className={classNames('tw:flex tw:flex-col tw:gap-4', {
          'connection-additional-object tw:pt-0.5': schema.additionalProperties,
        })}>
        <CoreObjectFieldTemplate
          {...props}
          formContext={{
            ...(props.formContext as object),
            flatPropertyLayout: true,
          }}
        />
      </div>
    );
  } else if (isEmpty(schema.properties)) {
    rendered = <ObjectFieldTemplate {...props} />;
  } else {
    const {
      properties: sectionProperties,
      additionalField: AdditionalField,
      additionalFieldContent,
    } = serviceUtilClassBase.getProperties(properties);

    const requiredKeys = (schema.required ?? []) as string[];
    const schemaProperties = (schema.properties ?? {}) as Record<
      string,
      SchemaProperty
    >;
    const isAdvanced = (name: string) => ADVANCED_PROPERTIES.includes(name);
    // authType oneOf renders the segmented selector. Flat secret fields stay in
    // Authentication, while connector identity fields remain in Connection.
    const isAuth = (name: string) =>
      name === AUTH_PROPERTY || schemaProperties[name]?.format === 'password';
    // Object/array fields (additionalProperties maps, storage config, …) render
    // wide controls — span the full row so they don't ragged-wrap the grid.
    const isWide = (name: string) => {
      const property = schemaProperties[name];
      const propType = property?.type;

      return (
        propType === 'object' ||
        propType === 'array' ||
        Boolean(property?.oneOf?.length) ||
        Boolean(property?.anyOf?.length)
      );
    };
    const wideNames = new Set(
      sectionProperties.filter((p) => isWide(p.name)).map((p) => p.name)
    );

    const authProperties = sectionProperties.filter((p) => isAuth(p.name));
    const advancedProperties = sectionProperties.filter((p) =>
      isAdvanced(p.name)
    );
    const explicitConnectionProperties = sectionProperties.filter(
      (p) =>
        !isAuth(p.name) && !isAdvanced(p.name) && requiredKeys.includes(p.name)
    );
    const optionalConnectionProperties = sectionProperties.filter(
      (p) =>
        !isAuth(p.name) &&
        !isAdvanced(p.name) &&
        !requiredKeys.includes(p.name) &&
        OPTIONAL_CONNECTION_PROPERTIES.has(p.name)
    );
    const fallbackConnectionProperties = sectionProperties.filter(
      (p) =>
        !isAuth(p.name) &&
        !isAdvanced(p.name) &&
        !OPTIONAL_SCOPE_PROPERTIES.has(p.name)
    );
    const connectionProperties =
      explicitConnectionProperties.length > 0
        ? [...explicitConnectionProperties, ...optionalConnectionProperties]
        : fallbackConnectionProperties;
    const connectionPropertyNames = new Set(
      connectionProperties.map((property) => property.name)
    );
    const scopeProperties = sectionProperties.filter(
      (p) =>
        !isAuth(p.name) &&
        !isAdvanced(p.name) &&
        !connectionPropertyNames.has(p.name)
    );
    const shouldRenderScopeSection = hasVisibleProperties(scopeProperties);
    const hiddenUnsectionedProperties = [
      ...(!shouldRenderScopeSection ? scopeProperties : []),
    ].filter((property) => !isVisibleProperty(property));
    const rootFormData = formData as Record<string, unknown>;

    const explicitConnectionPropertyNames = explicitConnectionProperties
      .filter((p) => !p.hidden && p.name !== SERVICE_TYPE_PROPERTY)
      .map((p) => p.name);

    const connectionMissingCount =
      getMissingSchemaRequiredFieldsCountForSelectedBranch(
        {
          type: 'object',
          properties: Object.fromEntries(
            explicitConnectionPropertyNames.map((name) => [
              name,
              schemaProperties[name] as Record<string, unknown>,
            ])
          ),
          required: explicitConnectionPropertyNames,
        },
        rootFormData
      );

    const authRequiredKeys = requiredKeys.filter((k) => isAuth(k));
    const effectiveAuthRequired = [
      ...authRequiredKeys,
      ...(rootFormData?.[AUTH_PROPERTY] !== undefined &&
      !authRequiredKeys.includes(AUTH_PROPERTY)
        ? [AUTH_PROPERTY]
        : []),
    ];
    const authMissingCount =
      getMissingSchemaRequiredFieldsCountForSelectedBranch(
        {
          type: 'object',
          properties: Object.fromEntries(
            authProperties.map((p) => [
              p.name,
              schemaProperties[p.name] as Record<string, unknown>,
            ])
          ),
          required: effectiveAuthRequired,
        },
        rootFormData
      );

    const rawSections: SectionConfig[] = [
      {
        key: 'connection',
        title: t('label.connection'),
        description: t('message.connection-section-description'),
        properties: connectionProperties,
        schemaProperties,
        collapsible: false,
        defaultOpen: true,
        layout: 'grid',
        wideNames,
        focusName: getFirstVisibleFieldName(connectionProperties, 'connection'),
        onFocus: connectionFormContext?.handleFocus,
        badge:
          connectionMissingCount > 0 ? (
            <ReqBadge tone="error">
              {t('message.field-count-required', {
                count: connectionMissingCount,
              })}
            </ReqBadge>
          ) : (
            <ReqBadge>{t('label.optional')}</ReqBadge>
          ),
      },
      ...(authProperties.length
        ? [
            {
              key: 'authentication',
              title: t('label.authentication'),
              description: t('message.authentication-section-description'),
              properties: authProperties,
              schemaProperties,
              collapsible: false,
              defaultOpen: true,
              layout: 'stack',
              focusName: authProperties.some(
                (property) => property.name === AUTH_PROPERTY
              )
                ? AUTH_PROPERTY
                : getFirstVisibleFieldName(authProperties, AUTH_PROPERTY),
              onFocus: connectionFormContext?.handleFocus,
              badge:
                authMissingCount > 0 ? (
                  <ReqBadge tone="error">
                    {t('message.field-count-required', {
                      count: authMissingCount,
                    })}
                  </ReqBadge>
                ) : (
                  <ReqBadge>{t('label.optional')}</ReqBadge>
                ),
            } as SectionConfig,
          ]
        : []),
      ...(shouldRenderScopeSection
        ? [
            {
              key: 'scope',
              title: t('label.scope-and-option-plural'),
              description: t('message.scope-section-description'),
              properties: scopeProperties,
              schemaProperties,
              collapsible: true,
              defaultOpen: false,
              layout: 'grid',
              wideNames,
              focusName: getFirstVisibleFieldName(
                scopeProperties,
                'scopeOptions'
              ),
              onFocus: connectionFormContext?.handleFocus,
              badge: <ReqBadge>{t('label.optional')}</ReqBadge>,
            } as SectionConfig,
          ]
        : []),
      ...(advancedProperties.length
        ? [
            {
              key: 'advanced',
              title: t('label.advanced-config'),
              description: t('message.advanced-config-section-description'),
              properties: advancedProperties,
              schemaProperties,
              collapsible: true,
              defaultOpen: false,
              layout: 'grid',
              wideNames,
              inlineBooleans: true,
              focusName: getFirstVisibleFieldName(
                advancedProperties,
                'advancedConfig'
              ),
              onFocus: connectionFormContext?.handleFocus,
            } as SectionConfig,
          ]
        : []),
    ];

    let sectionCounter = 0;
    const sections = rawSections.map((section) => ({
      ...section,
      index: section.key !== 'advanced' ? ++sectionCounter : undefined,
    }));

    rendered = (
      <div
        className="connection-grouped-form tw:flex tw:flex-col tw:gap-3 tw:text-primary"
        data-testid="connection-grouped-form">
        {AdditionalField &&
          createElement(AdditionalField, { data: additionalFieldContent })}
        <HiddenFields properties={hiddenUnsectionedProperties} />
        {sections.map((section) => (
          <SectionCard key={section.key} section={section} />
        ))}
      </div>
    );
  }

  return <>{rendered}</>;
};

export default ConnectionObjectFieldTemplate;
