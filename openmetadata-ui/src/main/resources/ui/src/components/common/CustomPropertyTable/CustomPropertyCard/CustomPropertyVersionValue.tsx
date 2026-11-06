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
import { isString } from 'lodash';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../../generated/type/customProperty';
import RichTextEditorPreviewerV1 from '../../RichTextEditor/RichTextEditorPreviewerV1';
import { getPropertyValueSummary } from '../CustomPropertiesWidget/CustomPropertyListItem.utils';

interface CustomPropertyVersionValueProps {
  property: CustomProperty;
  value: unknown;
  /** The property first got a value in this version. */
  isAdded: boolean;
}

/** Value of a custom property on a version page, with its diff markup. */
export const CustomPropertyVersionValue = ({
  property,
  value,
  isAdded,
}: CustomPropertyVersionValueProps) => {
  const { t, i18n } = useTranslation();
  const diffClassName = isAdded ? 'diff-added' : undefined;

  if (isString(value)) {
    return (
      <RichTextEditorPreviewerV1 className={diffClassName} markdown={value} />
    );
  }

  return (
    <span className={diffClassName}>
      {getPropertyValueSummary(
        property.propertyType.name,
        value,
        t,
        i18n.language
      )}
    </span>
  );
};
