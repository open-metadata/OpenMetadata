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
import { Badge, Box } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { WidgetEditButton } from '../../WidgetActionButton/WidgetActionButton';
import { TYPE_ICON_TILE_CLASS } from '../CustomPropertyCard/CustomPropertyCard.constants';
import {
  getPropertyTypeMeta,
  isPropertyValueEmpty,
} from '../CustomPropertyCard/CustomPropertyCard.utils';
import { CustomPropertyEditModal } from '../CustomPropertyCard/CustomPropertyEditModal';
import { CustomPropertyListItemProps } from './CustomPropertyListItem.interface';
import { getPropertyValueSummary } from './CustomPropertyListItem.utils';

/** Compact row of the Custom Properties side widget. */
export const CustomPropertyListItem = ({
  className,
  actions,
  itemRef,
  property,
  value,
  valueContent,
  hasEditPermissions,
  onValueSave,
}: CustomPropertyListItemProps) => {
  const { t, i18n } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const typeName = property.propertyType.name;
  const meta = getPropertyTypeMeta(typeName);
  const TypeIcon = meta.icon;
  const propertyLabel = getEntityName(property);
  const isEmptyValue = isPropertyValueEmpty(typeName, value);
  const summary = isEmptyValue
    ? t('label.not-set')
    : getPropertyValueSummary(typeName, value, t, i18n.language);

  const handleSave = async (updatedValue: unknown) => {
    setIsSaving(true);
    try {
      await onValueSave?.(property, updatedValue);
      setIsEditing(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  const renderAction = () => {
    if (!hasEditPermissions || !onValueSave) {
      return null;
    }

    // Empty rows keep the icon visible: it is their only edit affordance.
    // Wrapped because WidgetEditButton's className replaces its own padding.
    return (
      <span
        className={classNames('tw:flex', {
          'tw:opacity-0 tw:group-hover:opacity-100 tw:group-focus-within:opacity-100':
            !isEmptyValue,
        })}>
        <WidgetEditButton
          data-testid="edit-icon"
          title={t('label.edit-entity', { entity: propertyLabel })}
          onClick={() => setIsEditing(true)}
        />
      </span>
    );
  };

  return (
    <li
      className={classNames(
        'tw:group tw:flex tw:min-w-0 tw:items-start tw:gap-3 tw:px-4 tw:py-3 tw:hover:bg-secondary',
        className
      )}
      data-testid={`custom-property-${property.name}-row`}
      ref={itemRef}>
      <span
        aria-hidden
        className={`tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg ${
          TYPE_ICON_TILE_CLASS[meta.color]
        }`}>
        <TypeIcon className="tw:size-4" />
      </span>
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
        <span
          className="tw:truncate tw:text-xs tw:text-secondary"
          data-testid="property-name">
          {propertyLabel}
        </span>
        {valueContent ? (
          <div
            className="tw:min-w-0 tw:break-words tw:text-xs tw:text-primary"
            data-testid="property-value">
            {valueContent}
          </div>
        ) : (
          <span
            className={classNames('tw:line-clamp-2 tw:break-words tw:text-xs', {
              'tw:text-tertiary': isEmptyValue,
              'tw:font-semibold tw:text-primary': !isEmptyValue,
            })}
            data-testid="property-value">
            {summary}
          </span>
        )}
      </div>
      <Box align="center" className="tw:ml-auto tw:shrink-0" gap={1}>
        <Badge color={meta.color} size="sm" type="color">
          {t(meta.labelKey)}
        </Badge>
        {renderAction()}
        {actions}
      </Box>
      {isEditing && (
        <CustomPropertyEditModal
          isNewValue={isEmptyValue}
          isSaving={isSaving}
          property={property}
          value={value}
          onCancel={() => setIsEditing(false)}
          onSave={handleSave}
        />
      )}
    </li>
  );
};
