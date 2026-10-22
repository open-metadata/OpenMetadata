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
  Badge,
  Box,
  ButtonUtility,
  Skeleton,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Settings02 } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { startCase } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { getAllCustomProperties } from '../../../../../rest/metadataTypeAPI';
import { TYPE_QUERY_STALE_TIME } from '../../../../../rest/queries/typeQuery';
import { getTextFromHtmlString } from '../../../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { SORT_OPTIONS } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.constants';
import { CustomPropertySortMode } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.interface';
import {
  filterAndSortProperties,
  getPropertyTypeMeta,
  isPropertyValueEmpty,
} from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { CustomPropertyEditModal } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyEditModal';
import { getPropertyRenderer } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers';
import { CustomPropertySearchSortBar } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertySearchSortBar';
import NoDataPlaceholder from '../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import PermissionPlaceholder from '../../../../common/EmptyPlaceholder/PermissionPlaceholder';
import { EMPTY_VALUE } from './UserCustomProperties.constants';
import { UserCustomPropertiesProps } from './UserCustomProperties.interface';
import { useUserCustomPropertyAccess } from './useUserCustomPropertyAccess';
import { useUserCustomPropertyEditor } from './useUserCustomPropertyEditor';

const MAX_ENTITY_TYPE_CHIPS = 3;

type ColumnId = 'property' | 'type' | 'value' | 'entityTypes' | 'actions';

const UserCustomPropertiesTable = (props: UserCustomPropertiesProps) => {
  const { t } = useTranslation();
  const { user } = props;
  const access = useUserCustomPropertyAccess(user);
  const {
    customProperties,
    isLoading,
    extension,
    editingProperty,
    isSaving,
    startEditing,
    stopEditing,
    saveValue,
  } = useUserCustomPropertyEditor(props);
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<CustomPropertySortMode>('name');
  const visibleProperties = useMemo(
    () =>
      filterAndSortProperties(
        customProperties,
        extension,
        searchText,
        sortMode,
        { groupWideLast: false }
      ),
    [customProperties, extension, searchText, sortMode]
  );

  // Other entity types that define a property with the same name.
  const { data: propertiesByEntityType } = useQuery({
    queryKey: ['metadataType', 'allCustomProperties'],
    queryFn: getAllCustomProperties,
    enabled: access.canView,
    staleTime: TYPE_QUERY_STALE_TIME,
  });

  const getEntityTypes = (propertyName: string) =>
    Object.entries(propertiesByEntityType ?? {})
      .filter(([, properties]) =>
        properties.some((property) => property.name === propertyName)
      )
      .map(([entityType]) => entityType)
      .sort(
        (a, b) =>
          Number(b === EntityType.USER) - Number(a === EntityType.USER) ||
          a.localeCompare(b)
      );

  const columns = useMemo<
    { id: ColumnId; label: string; className?: string }[]
  >(
    () => [
      { id: 'property', label: t('label.property'), className: 'tw:w-[30%]' },
      { id: 'type', label: t('label.type'), className: 'tw:w-32' },
      { id: 'value', label: t('label.value') },
      { id: 'entityTypes', label: t('label.entity-types') },
      { id: 'actions', label: '', className: 'tw:w-14' },
    ],
    [t]
  );

  if (access.isLoading || isLoading) {
    return (
      <Box data-testid="user-custom-properties-loading" direction="col" gap={2}>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton height={56} key={index} variant="rounded" />
        ))}
      </Box>
    );
  }

  if (!access.canView) {
    return (
      <Box className="tw:relative tw:min-h-80">
        <PermissionPlaceholder
          data-testid="user-custom-properties-no-permission"
          permissionValue={t('label.view-entity', {
            entity: t('label.custom-property-plural'),
          })}
        />
      </Box>
    );
  }

  if (customProperties.length === 0) {
    return (
      <Box className="tw:relative tw:min-h-80">
        <NoDataPlaceholder
          data-testid="user-custom-properties-empty"
          description={t('message.define-user-custom-properties-hint')}
          icon={<Settings02 />}
          title={t('message.no-custom-properties-for-users')}
        />
      </Box>
    );
  }

  const renderCell = (property: CustomProperty, columnId: ColumnId) => {
    const typeName = property.propertyType.name;
    const value = extension?.[property.name];

    switch (columnId) {
      case 'property': {
        const description = getTextFromHtmlString(property.description);

        return (
          <Box className="tw:min-w-0 tw:gap-0.5" direction="col">
            <Typography
              className="tw:text-primary"
              data-testid="property-name"
              size="text-sm"
              weight="medium">
              {getEntityName(property)}
            </Typography>
            {description && (
              <Typography className="tw:text-secondary" size="text-xs">
                {description}
              </Typography>
            )}
          </Box>
        );
      }
      case 'type': {
        const meta = getPropertyTypeMeta(typeName);

        return (
          <Badge
            className="tw:whitespace-nowrap"
            color={meta.color}
            data-testid="property-type-badge"
            size="sm"
            type="color">
            {t(meta.labelKey)}
          </Badge>
        );
      }
      case 'value': {
        if (isPropertyValueEmpty(typeName, value)) {
          return (
            <Typography className="tw:text-tertiary" data-testid="no-value">
              {EMPTY_VALUE}
            </Typography>
          );
        }
        const { View } = getPropertyRenderer(typeName);

        return <View property={property} value={value} />;
      }
      case 'entityTypes': {
        const entityTypes = getEntityTypes(property.name);
        const hidden = entityTypes.length - MAX_ENTITY_TYPE_CHIPS;

        return (
          <Box
            className="tw:flex-wrap tw:gap-1.5"
            data-testid="property-entity-types">
            {entityTypes.slice(0, MAX_ENTITY_TYPE_CHIPS).map((entityType) => (
              <Badge color="gray" key={entityType} size="sm" type="modern">
                {startCase(entityType)}
              </Badge>
            ))}
            {hidden > 0 && (
              <Badge color="gray" size="sm" type="modern">
                {t('label.plus-count', { count: hidden })}
              </Badge>
            )}
          </Box>
        );
      }
      case 'actions':
        return access.canEdit ? (
          <ButtonUtility
            color="tertiary"
            data-testid={`edit-${property.name}`}
            icon={Edit01}
            size="xs"
            tooltip={t('label.edit-entity', {
              entity: getEntityName(property),
            })}
            onClick={() => startEditing(property)}
          />
        ) : null;
      default:
        return null;
    }
  };

  // React Aria caches collection rows by item; re-render them when cell inputs change.
  const rowDependencies = [propertiesByEntityType, extension, access.canEdit];

  return (
    <Box data-testid="user-custom-properties-table" direction="col" gap={4}>
      <CustomPropertySearchSortBar
        searchText={searchText}
        sortMode={sortMode}
        sortOptions={SORT_OPTIONS}
        onSearchChange={setSearchText}
        onSortChange={setSortMode}
      />
      {visibleProperties.length ? (
        <TableCard.Root
          className="tw:rounded-xl tw:border tw:border-secondary tw:shadow-none"
          size="compact">
          <div className="tw:overflow-x-auto">
            <Table
              aria-label={t('label.custom-property-plural')}
              className="tw:min-w-[720px] tw:table-fixed"
              size="compact">
              <Table.Header columns={columns}>
                {(column) => (
                  <Table.Head
                    className={column.className}
                    id={column.id}
                    isRowHeader={column.id === 'property'}
                    key={column.id}
                    label={column.label}
                  />
                )}
              </Table.Header>
              <Table.Body
                dependencies={rowDependencies}
                items={visibleProperties}>
                {(property) => (
                  <Table.Row
                    columns={columns}
                    data-testid={`custom-property-row-${property.name}`}
                    dependencies={rowDependencies}
                    id={property.name}
                    key={property.name}>
                    {(column) => (
                      <Table.Cell
                        className={`tw:align-top ${column.className ?? ''}`}
                        key={column.id}>
                        {renderCell(property, column.id)}
                      </Table.Cell>
                    )}
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </div>
        </TableCard.Root>
      ) : (
        <Typography
          className="tw:py-8 tw:text-center tw:text-tertiary"
          data-testid="no-matching-custom-properties"
          size="text-sm">
          {t('message.no-entity-found-for-name', {
            entity: t('label.property-plural'),
            name: searchText,
          })}
        </Typography>
      )}
      {editingProperty && (
        <CustomPropertyEditModal
          isNewValue={isPropertyValueEmpty(
            editingProperty.propertyType.name,
            extension?.[editingProperty.name]
          )}
          isSaving={isSaving}
          property={editingProperty}
          value={extension?.[editingProperty.name]}
          onCancel={stopEditing}
          onSave={saveValue}
        />
      )}
    </Box>
  );
};

export default UserCustomPropertiesTable;
