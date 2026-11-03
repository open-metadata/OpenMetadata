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
  Button,
  ConfirmPopover,
  TableCard,
  Tabs,
} from '@openmetadata/ui-core-components';
import { Plus as Expand } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import React, { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../../../../generated/type/customProperty';
import { useAnchoredConfirm } from '../../../../../../hooks/popover/useAnchoredConfirm';
import { deleteCustomPropertyByName } from '../../../../../../rest/metadataTypeAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import withSuspenseFallback from '../../../../../AppRouter/withSuspenseFallback';
import NoDataPlaceholder from '../../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import CustomPropertiesListTable from '../../../../../Settings/CustomProperty/CustomPropertiesListTable';
import { CustomPropertiesDetailPageProps } from './CustomPropertiesPanel.types';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../../../Database/SchemaEditor/SchemaEditor'))
);

const CustomPropertiesDetailPage: React.FC<CustomPropertiesDetailPageProps> = ({
  entityType,
  onAddProperty,
  onEditProperty,
  onEntityTypeChange,
  onSetHeaderActions,
  permission,
}) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<string>('custom-properties');
  const {
    target: deleteTarget,
    open: openDeleteConfirm,
    popoverProps,
  } = useAnchoredConfirm<CustomProperty>();

  const customProperties = useMemo(
    () => entityType.customProperties ?? [],
    [entityType.customProperties]
  );

  const { canCreate, canDelete, canEditAll } =
    getDerivedPermissionFlags(permission);

  const handleDeleteConfirm = useCallback(
    async (propertyToDelete: CustomProperty) => {
      if (!entityType.fullyQualifiedName) {
        return false;
      }
      try {
        const updated = await deleteCustomPropertyByName(
          entityType.fullyQualifiedName,
          propertyToDelete.name
        );
        // `undefined`: someone else already removed it, so drop it locally.
        onEntityTypeChange(
          updated ?? {
            ...entityType,
            customProperties: entityType.customProperties?.filter(
              (property) => property.name !== propertyToDelete.name
            ),
          }
        );
        showSuccessToast(
          t('server.entity-deleted-success', {
            entity: t('label.custom-property'),
          })
        );

        return true;
      } catch (err) {
        showErrorToast(err as AxiosError);

        return false;
      }
    },
    [entityType, onEntityTypeChange, t]
  );

  useEffect(() => {
    onSetHeaderActions(
      canCreate ? (
        <Button
          color="primary"
          data-testid="add-custom-property-btn"
          iconLeading={Expand}
          size="xs"
          onPress={onAddProperty}>
          {t('label.add-entity', { entity: t('label.custom-property') })}
        </Button>
      ) : undefined
    );

    return () => onSetHeaderActions(undefined);
  }, [canCreate, onAddProperty, onSetHeaderActions, t]);

  return (
    <>
      <TableCard.Root className="tw:rounded-xl tw:shadow-none" variant="muted">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(k as string)}>
          <Tabs.List className="tw:px-4 tw:pt-3" size="sm" type="underline">
            <Tabs.Item
              badge={customProperties.length || undefined}
              id="custom-properties"
              label={t('label.custom-property-plural')}
            />
            <Tabs.Item id="schema" label={t('label.schema')} />
          </Tabs.List>

          <Tabs.Panel id="custom-properties">
            <CustomPropertiesListTable
              canDelete={canDelete}
              canEdit={canEditAll}
              containerClassName="custom-card-with-table"
              customProperties={customProperties}
              data-testid="custom-property-table"
              emptyText={
                <div className="tw:min-h-[250px] tw:relative">
                  <NoDataPlaceholder
                    actions={
                      canCreate
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
                  />
                </div>
              }
              variant="muted"
              onDelete={openDeleteConfirm}
              onEdit={onEditProperty}
            />
          </Tabs.Panel>

          <Tabs.Panel id="schema">
            <SchemaEditor
              className="custom-properties-schemaEditor tw:dark:[&_.cm-editor]:bg-primary_alt!"
              editorClass="custom-entity-schema"
              value={entityType.schema ?? '{}'}
            />
          </Tabs.Panel>
        </Tabs>
      </TableCard.Root>

      {deleteTarget && (
        <ConfirmPopover
          {...popoverProps}
          data-testid="delete-custom-property-popover"
          description={t('message.are-you-sure-delete-property', {
            propertyName: getEntityName(deleteTarget),
          })}
          title={t('label.delete-entity', {
            entity: getEntityName(deleteTarget),
          })}
          onConfirm={() => handleDeleteConfirm(deleteTarget)}
        />
      )}
    </>
  );
};

export default CustomPropertiesDetailPage;
