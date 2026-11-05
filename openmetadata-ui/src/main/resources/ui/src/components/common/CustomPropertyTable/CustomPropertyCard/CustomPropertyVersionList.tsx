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
import { Card } from '@openmetadata/ui-core-components';
import { isString } from 'lodash';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../../generated/type/customProperty';
import RichTextEditorPreviewerV1 from '../../RichTextEditor/RichTextEditorPreviewerV1';
import { CustomPropertyListItem } from '../CustomPropertiesWidget/CustomPropertyListItem';
import { getPropertyValueSummary } from '../CustomPropertiesWidget/CustomPropertyListItem.utils';
import { isPropertyValueEmpty } from './CustomPropertyCard.utils';
import { CustomPropertyVersionListProps } from './CustomPropertyVersionList.interface';

/** Read-only Custom Properties tab of an entity version page. */
export const CustomPropertyVersionList = ({
  properties,
  extension,
  addedKeys = [],
}: CustomPropertyVersionListProps) => {
  const { t, i18n } = useTranslation();

  const renderValue = (property: CustomProperty) => {
    const typeName = property.propertyType.name;
    const value = extension?.[property.name];
    const diffClassName = addedKeys.includes(property.name)
      ? 'diff-added'
      : undefined;

    // A changed value of any type arrives as a word-diff HTML string, so
    // strings go through the previewer before the type-aware empty check.
    if (isString(value) && value) {
      return (
        <RichTextEditorPreviewerV1 className={diffClassName} markdown={value} />
      );
    }

    if (isPropertyValueEmpty(typeName, value)) {
      return undefined;
    }

    return (
      <span className={diffClassName}>
        {getPropertyValueSummary(typeName, value, t, i18n.language)}
      </span>
    );
  };

  return (
    <Card className="tw:p-4" data-testid="custom-properties-card">
      <ul className="tw:m-0 tw:grid tw:list-none tw:grid-cols-1 tw:gap-3 tw:p-0 tw:md:grid-cols-2 tw:xl:grid-cols-3">
        {properties.map((property) => (
          <CustomPropertyListItem
            className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary"
            hasEditPermissions={false}
            key={property.name}
            property={property}
            value={extension?.[property.name]}
            valueContent={renderValue(property)}
          />
        ))}
      </ul>
    </Card>
  );
};
