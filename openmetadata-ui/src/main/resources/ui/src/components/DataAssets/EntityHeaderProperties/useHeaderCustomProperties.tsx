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
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { useCallback } from 'react';
import { CUSTOM_PROPERTY_HEADER_ID_PREFIX } from '../../../constants/EntityHeaderProperties.constants';
import { EntityHeader } from '../../../generated/system/ui/page';
import { useEntityTypeCustomProperties } from '../../../hooks/useEntityTypeCustomProperties';
import { getAPIfromSource } from '../../../utils/Assets/AssetsUtils';
import { getCustomPropertyHeaderId } from '../../../utils/EntityHeaderProperties.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { isPropertyValueEmpty } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { getPropertyRenderer } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers';
import { useCustomPropertyValueSave } from '../../common/CustomPropertyTable/useCustomPropertyValueSave';
import { EntityWithExtension } from '../../common/CustomPropertyTable/useCustomPropertyValueSave.interface';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { AssetsUnion } from '../AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../DataAssetsHeader/DataAssetsHeader.interface';
import { HeaderProperty } from './EntityHeaderProperties.types';
import HeaderCustomPropertyEditor from './HeaderCustomPropertyEditor';

const extensionDocument = (extension?: EntityWithExtension['extension']) =>
  isUndefined(extension) ? {} : { extension };

interface UseHeaderCustomPropertiesArgs {
  entityType: string;
  entity: EntityWithExtension;
  entityHeader?: EntityHeader;
  /** The customize page lists every custom property, pinned or not. */
  listAll: boolean;
  /** Whether the user may edit custom properties. */
  canEdit: boolean;
  /** Refreshes the page's entity after a save made outside its GenericProvider. */
  onEntityUpdated?: (entity: DataAssetWithDomains) => void;
}

/**
 * The entity type's custom properties as header properties. The type's
 * definitions are fetched only when the header can show one, so a page whose
 * persona pins none makes no extra request.
 */
export const useHeaderCustomProperties = ({
  entityType,
  entity,
  entityHeader,
  listAll,
  canEdit,
  onEntityUpdated,
}: UseHeaderCustomPropertiesArgs): HeaderProperty[] => {
  const pinsCustomProperty = Boolean(
    entityHeader?.properties.some((id) =>
      id.startsWith(CUSTOM_PROPERTY_HEADER_ID_PREFIX)
    )
  );
  const { onUpdate: providerUpdate } = useGenericContext<EntityWithExtension>();
  const patchExtension = useCallback(
    async (updated: EntityWithExtension) => {
      const response = await getAPIfromSource(entityType as AssetsUnion)(
        entity.id,
        compare(
          extensionDocument(entity.extension),
          extensionDocument(updated.extension)
        )
      );
      onEntityUpdated?.(response as DataAssetWithDomains);
    },
    [entityType, entity.id, entity.extension, onEntityUpdated]
  );
  const onUpdate =
    providerUpdate ?? (onEntityUpdated ? patchExtension : undefined);
  const { onPropertyValueSave } =
    useCustomPropertyValueSave<EntityWithExtension>({
      entityDetails: entity,
      onUpdate,
    });
  const canSave = canEdit && !isUndefined(onUpdate);
  const { customProperties } = useEntityTypeCustomProperties(
    listAll || pinsCustomProperty ? entityType : undefined
  );

  return customProperties.map((property) => {
    const value = entity.extension?.[property.name];
    const { View } = getPropertyRenderer(property.propertyType.name);

    return {
      id: getCustomPropertyHeaderId(property.name),
      label: getEntityName(property),
      customPropertyType: getEntityName(property.propertyType),
      isReadOnly: false,
      isEmpty: isPropertyValueEmpty(property.propertyType.name, value),
      testId: `header-custom-property-${property.name}`,
      editorTestId: 'edit-custom-property-value',
      content: <View isCompact property={property} value={value} />,
      renderEditor: canSave
        ? (trigger) => (
            <HeaderCustomPropertyEditor
              property={property}
              value={value}
              onSave={(updatedValue) =>
                onPropertyValueSave(property, updatedValue)
              }>
              {trigger}
            </HeaderCustomPropertyEditor>
          )
        : undefined,
    };
  });
};
