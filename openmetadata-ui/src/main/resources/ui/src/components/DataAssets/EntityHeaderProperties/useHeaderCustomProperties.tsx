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
import { isUndefined } from 'lodash';
import { CUSTOM_PROPERTY_HEADER_ID_PREFIX } from '../../../constants/EntityHeaderProperties.constants';
import { EntityHeader } from '../../../generated/system/ui/page';
import { useEntityTypeCustomProperties } from '../../../hooks/useEntityTypeCustomProperties';
import { getCustomPropertyHeaderId } from '../../../utils/EntityHeaderProperties.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { isPropertyValueEmpty } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { getPropertyRenderer } from '../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { HeaderProperty } from './EntityHeaderProperties.types';
import HeaderCustomPropertyEditor from './HeaderCustomPropertyEditor';

interface UseHeaderCustomPropertiesArgs {
  entityType: string;
  extension?: Record<string, unknown>;
  entityHeader?: EntityHeader;
  /** The customize page lists every custom property, pinned or not. */
  listAll: boolean;
  /** Whether the user may edit custom properties; saving also needs the page's entity update. */
  canEdit: boolean;
}

/**
 * The entity type's custom properties as header properties. The type's
 * definitions are fetched only when the header can show one, so a page whose
 * persona pins none makes no extra request.
 */
export const useHeaderCustomProperties = ({
  entityType,
  extension,
  entityHeader,
  listAll,
  canEdit,
}: UseHeaderCustomPropertiesArgs): HeaderProperty[] => {
  const pinsCustomProperty = Boolean(
    entityHeader?.properties.some((id) =>
      id.startsWith(CUSTOM_PROPERTY_HEADER_ID_PREFIX)
    )
  );
  const { onUpdate } = useGenericContext();
  const canSave = canEdit && !isUndefined(onUpdate);
  const { customProperties } = useEntityTypeCustomProperties(
    listAll || pinsCustomProperty ? entityType : undefined
  );

  return customProperties.map((property) => {
    const value = extension?.[property.name];
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
            <HeaderCustomPropertyEditor property={property} value={value}>
              {trigger}
            </HeaderCustomPropertyEditor>
          )
        : undefined,
    };
  });
};
