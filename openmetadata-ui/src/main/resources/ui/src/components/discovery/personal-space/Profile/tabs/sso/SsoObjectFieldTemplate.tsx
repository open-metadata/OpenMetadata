/*
 *  Copyright 2026 Collate.
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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import {
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  getFieldGroups,
  getSsoGroupingFlags,
  partitionAdvancedProperties,
} from '../../../../../SettingsSso/SSOGroupedFieldTemplate/SSOGroupedFieldTemplate.utils';

const SECTION_CLASS =
  'tw:flex tw:flex-col tw:gap-5 tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary tw:p-5';

/** Provider sub-objects render their own titled section, so the root leaves them unboxed. */
const PROVIDER_CONFIG_FIELDS = [
  'oidcConfiguration',
  'ldapConfiguration',
  'samlConfiguration',
];

const PropertyList = ({
  properties,
}: {
  properties: ObjectFieldTemplatePropertyType[];
}) => (
  <>
    {properties.map((property) => (
      <div key={property.name}>{property.content}</div>
    ))}
  </>
);

/**
 * Lays the SSO schema out in the same groups as the classic form
 * (`getFieldGroups`), each as a bordered core-ui section, with advanced
 * properties in a collapsed accordion.
 */
const SsoObjectFieldTemplate = ({
  idSchema,
  title,
  schema,
  properties,
  disabled,
  readonly,
  onAddClick,
}: ObjectFieldTemplateProps) => {
  const { t } = useTranslation();
  const flags = getSsoGroupingFlags(idSchema.$id);
  const { advancedProperties, normalProperties } =
    partitionAdvancedProperties(properties);
  const groups = getFieldGroups(normalProperties, flags);
  // The two top-level objects are named by the page, not by a caption.
  const showTitle =
    Boolean(title?.trim()) &&
    !flags.isAuthConfigRoot &&
    !flags.isAuthorizerConfig;
  const canAddProperty =
    Boolean(schema.additionalProperties) && !disabled && !readonly;

  return (
    <Box data-testid={`sso-object-${idSchema.$id}`} direction="col" gap={4}>
      {(showTitle || canAddProperty) && (
        <Box align="center" direction="row" justify="between">
          {showTitle && (
            <Typography
              className="tw:text-secondary"
              id={`${idSchema.$id}__title`}
              size="text-sm"
              weight="semibold">
              {title}
            </Typography>
          )}
          {canAddProperty && (
            <Button
              aria-label={t('label.add-entity', { entity: title })}
              color="secondary"
              data-testid={`add-item-${title}`}
              iconLeading={Plus}
              size="sm"
              onPress={() => onAddClick(schema)()}
            />
          )}
        </Box>
      )}

      {groups.map((group) => {
        const isProviderConfig =
          flags.isAuthConfigRoot &&
          group.properties.every((p) =>
            PROVIDER_CONFIG_FIELDS.includes(p.name)
          );

        return flags.shouldApplyGrouping && !isProviderConfig ? (
          <div
            className={SECTION_CLASS}
            key={group.properties.map((p) => p.name).join('-')}>
            <PropertyList properties={group.properties} />
          </div>
        ) : (
          <Box
            direction="col"
            gap={5}
            key={group.properties.map((p) => p.name).join('-')}>
            <PropertyList properties={group.properties} />
          </Box>
        );
      })}

      {!isEmpty(advancedProperties) && (
        <Accordion className="tw:rounded-lg">
          {/* The panel stays mounted while collapsed: transformErrors drops
              errors for fields missing from the DOM, so unmounting would hide
              validation on advanced fields. */}
          <AccordionItem id={`${idSchema.$id}-advanced`}>
            <AccordionHeader data-testid={`sso-advanced-${idSchema.$id}`}>
              {t('label.advanced-config')}
            </AccordionHeader>
            <AccordionPanel>
              <Box direction="col" gap={5}>
                <PropertyList properties={advancedProperties} />
              </Box>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}
    </Box>
  );
};

export default SsoObjectFieldTemplate;
