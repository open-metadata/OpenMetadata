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
  Box,
  Button,
  EmptyPlaceholder,
  Table,
  TableCard,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit, Expand, Delete } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isArray, isString, isUndefined, startCase } from 'lodash';
import React, { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../../../../AppRouter/withSuspenseFallback';
import { CUSTOM_PROPERTIES_ICON_MAP } from '../../../../../../constants/CustomProperty.constants';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Type } from '../../../../../../generated/entity/type';
import { CustomProperty } from '../../../../../../generated/type/customProperty';
import { getTypeByFQN, updateType } from '../../../../../../rest/metadataTypeAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../../../../utils/ToastUtils';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';

const SchemaEditor = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../../../../Database/SchemaEditor/SchemaEditor'
      )
  )
);

const RichTextEditorPreviewerNew = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../../../../common/RichTextEditor/RichTextEditorPreviewNew'
      )
  )
);

interface CustomPropertiesDetailPageProps {
  entityType: Type;
  onAddProperty: () => void;
  onEditProperty: (property: CustomProperty) => void;
}

const TABLE_COLUMNS = [
  { id: 'name', name: 'Name' },
  { id: 'type', name: 'Type' },
  { id: 'config', name: 'Config' },
  { id: 'description', name: 'Description' },
  { id: 'actions', name: 'Actions' },
];

const CustomPropertiesDetailPage: React.FC<CustomPropertiesDetailPageProps> = ({
  entityType,
  onAddProperty,
  onEditProperty,
}) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();

  const [typeDetail, setTypeDetail] = useState<Type | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('custom-properties');
  const [permission, setPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [propertyToDelete, setPropertyToDelete] =
    useState<CustomProperty | null>(null);

  const fetchTypeAndPermission = useCallback(async () => {
    if (!entityType.fullyQualifiedName || !entityType.id) {
      return;
    }
    setIsLoading(true);
    try {
      const [detail, perm] = await Promise.all([
        getTypeByFQN(entityType.fullyQualifiedName),
        getEntityPermission(ResourceEntity.TYPE, entityType.id),
      ]);
      setTypeDetail(detail);
      setPermission(perm);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [entityType.fullyQualifiedName, entityType.id, getEntityPermission]);

  useEffect(() => {
    fetchTypeAndPermission();
  }, [fetchTypeAndPermission]);

  const customProperties = useMemo(
    () => typeDetail?.customProperties ?? [],
    [typeDetail]
  );

  const hasEditPermission = permission.EditAll;

  const handleDeleteConfirm = useCallback(async () => {
    if (!propertyToDelete || !typeDetail) {
      return;
    }
    const updatedProperties = customProperties.filter(
      (prop) => prop.name !== propertyToDelete.name
    );
    const patch = compare(
      { ...typeDetail },
      { ...typeDetail, customProperties: updatedProperties }
    );
    setIsDeleting(true);
    try {
      const updated = await updateType(typeDetail.id ?? '', patch);
      setTypeDetail(updated);
      showSuccessToast(
        t('server.delete-entity-success', {
          entity: t('label.custom-property'),
        })
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDeleting(false);
      setPropertyToDelete(null);
    }
  }, [customProperties, propertyToDelete, t, typeDetail]);

  const renderRow = useCallback(
    (property: CustomProperty) => {
      const typeName = property.propertyType.name ?? '';
      const IconComp =
        CUSTOM_PROPERTIES_ICON_MAP[
          typeName as keyof typeof CUSTOM_PROPERTIES_ICON_MAP
        ];
      const typeDisplayName = startCase(typeName.replaceAll('-cp', ''));

      return (
        <Table.Row id={property.name} key={property.name}>
          <Table.Cell>
            <Typography size="text-sm" weight="medium">
              {getEntityName(property)}
            </Typography>
          </Table.Cell>
          <Table.Cell>
            <Box align="center" direction="row" gap={1}>
              {IconComp && <IconComp className="tw:size-4 tw:shrink-0" />}
              <Typography className="tw:text-text-secondary" size="text-sm">
                {typeDisplayName}
              </Typography>
            </Box>
          </Table.Cell>
          <Table.Cell>
            {(() => {
              const configData = property.customPropertyConfig;

              if (isUndefined(configData)) {
                return (
                  <Typography className="tw:text-text-secondary" size="text-sm">
                    {'--'}
                  </Typography>
                );
              }

              const config = configData.config;

              if (isArray(config) && !isEmpty(config)) {
                return (
                  <Typography className="tw:text-text-secondary" size="text-sm">
                    {JSON.stringify(config)}
                  </Typography>
                );
              }

              if (!isString(config) && !isArray(config)) {
                if (config?.columns) {
                  return (
                    <Typography
                      className="tw:text-text-secondary"
                      size="text-sm">
                      <span className="tw:font-medium">{`${t('label.column-plural')}:`}</span>
                      <ul className="tw:m-0! tw:pl-4">
                        {config.columns.map((col) => (
                          <li key={col}>{col}</li>
                        ))}
                      </ul>
                    </Typography>
                  );
                }

                return (
                  <Box direction="col" gap={1}>
                    <Typography
                      className="tw:text-text-secondary"
                      size="text-sm">
                      {JSON.stringify(config?.values ?? [])}
                    </Typography>
                    <Typography
                      className="tw:text-text-secondary"
                      size="text-sm">
                      {`${t('label.multi-select')}: ${config?.multiSelect ? t('label.yes') : t('label.no')}`}
                    </Typography>
                  </Box>
                );
              }

              return (
                <Typography className="tw:text-text-secondary" size="text-sm">
                  {config as string}
                </Typography>
              );
            })()}
          </Table.Cell>
          <Table.Cell>
            <RichTextEditorPreviewerNew
              markdown={property.description ?? ''}
              maxLineLength="2"
            />
          </Table.Cell>
          <Table.Cell>
            {hasEditPermission && (
              <Box direction="row" gap={1}>
                <Button
                  aria-label={t('label.edit')}
                  color="tertiary"
                  iconLeading={Edit}
                  size="xs"
                  onPress={() => onEditProperty(property)}
                />
                <Button
                  aria-label={t('label.delete')}
                  color="tertiary-destructive"
                  iconLeading={Delete}
                  size="xs"
                  onPress={() => setPropertyToDelete(property)}
                />
              </Box>
            )}
          </Table.Cell>
        </Table.Row>
      );
    },
    [hasEditPermission, onEditProperty, t]
  );

  const addButton = hasEditPermission ? (
    <Button
      color="primary"
      data-testid="add-custom-property-btn"
      iconLeading={Expand}
      isDisabled={isLoading}
      size="sm"
      onPress={onAddProperty}>
      {t('label.add-entity', { entity: t('label.custom-property') })}
    </Button>
  ) : undefined;

  return (
    <>
      <TableCard.Root className="tw:rounded-xl tw:border tw:border-secondary tw:shadow-none">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(k as string)}>
          <div className="tw:flex tw:items-end tw:justify-between tw:border-b tw:border-secondary tw:px-4 tw:pt-3">
            <Tabs.List size="sm" type="underline">
              <Tabs.Item
                badge={customProperties.length || undefined}
                id="custom-properties"
                label={t('label.custom-property-plural')}
              />
              <Tabs.Item id="schema" label={t('label.schema')} />
            </Tabs.List>
            <div className="tw:pb-3">
             {addButton}
            </div>
          </div>

          <Tabs.Panel id="custom-properties">
            <Table
              aria-label={t('label.custom-property-plural')}
              data-testid="custom-property-table">
              <Table.Header columns={TABLE_COLUMNS}>
                {(col) => (
                  <Table.Head
                    id={col.id}
                    key={col.id}
                    label={col.name}
                    width={col.width}
                  />
                )}
              </Table.Header>
              <Table.Body
                dependencies={[isLoading]}
                items={isLoading ? [] : customProperties}
                renderEmptyState={() => (
                  <div className="tw:min-h-[250px] tw:relative">
                      <EmptyPlaceholder
                      actions={
                        hasEditPermission
                          ? [
                              {
                                key: 'add',
                                label: t('label.add-entity', {
                                  entity: t('label.custom-property'),
                                }),
                                color: 'primary' as const,
                                iconLeading: Expand,
                                onPress: onAddProperty,
                              },
                            ]
                          : undefined
                      }
                      description={t('message.no-custom-properties-defined')}
                      title={t('label.no-entity-found', {
                        entity: t('label.custom-property-plural'),
                      })}
                      variant="blank"
                    />
                  </div>
                )}>
                {(property) => renderRow(property as CustomProperty)}
              </Table.Body>
            </Table>
          </Tabs.Panel>

          <Tabs.Panel id="schema">
            <SchemaEditor
              className="custom-properties-schemaEditor"
              editorClass="custom-entity-schema"
              value={typeDetail?.schema ?? '{}'}
            />
          </Tabs.Panel>
        </Tabs>
      </TableCard.Root>

      {propertyToDelete && (
        <DeleteModal
          entityTitle={getEntityName(propertyToDelete)}
          isDeleting={isDeleting}
          message={t('message.are-you-sure-delete-property', {
            propertyName: getEntityName(propertyToDelete),
          })}
          open={Boolean(propertyToDelete)}
          onCancel={() => setPropertyToDelete(null)}
          onDelete={handleDeleteConfirm}
        />
      )}
    </>
  );
};

export default CustomPropertiesDetailPage;
