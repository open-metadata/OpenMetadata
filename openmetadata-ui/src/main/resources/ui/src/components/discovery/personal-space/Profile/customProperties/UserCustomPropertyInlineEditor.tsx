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
import { Box, Button } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { getTextFromHtmlString } from '../../../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getPropertyTypeMeta } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyCard.utils';
import { getPropertyRenderer } from '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyRenderers';
import FieldRow from '../components/FieldRow';

interface UserCustomPropertyInlineEditorProps {
  property: CustomProperty;
  value: unknown;
  isSaving: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

/**
 * A custom property row in edit mode, laid out like the other Profile rows
 * (InlineEditCard). Save submits the type's own editor form, as the edit modal
 * does, so every property type keeps its validation and value shape.
 */
const UserCustomPropertyInlineEditor = ({
  property,
  value,
  isSaving,
  onSave,
  onCancel,
}: UserCustomPropertyInlineEditorProps) => {
  const { t } = useTranslation();
  const formId = useId();
  const typeName = property.propertyType.name;
  const { Edit } = getPropertyRenderer(typeName);
  const { isWide } = getPropertyTypeMeta(typeName);

  return (
    <Box
      className="tw:px-5 tw:py-4"
      data-testid={`custom-property-row-${property.name}`}
      direction="col">
      <FieldRow
        description={getTextFromHtmlString(property.description)}
        title={getEntityName(property)}>
        <div
          className={classNames(
            isWide ? 'tw:w-full' : 'tw:w-2/5 tw:min-w-[500px]'
          )}>
          <Edit
            formId={formId}
            isSaving={isSaving}
            property={property}
            value={value}
            onSave={onSave}
          />
        </div>
      </FieldRow>
      <Box align="center" className="tw:mt-5 tw:pr-2" gap={2} justify="end">
        <Button
          color="secondary"
          data-testid="inline-cancel-btn"
          isDisabled={isSaving}
          size="sm"
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="inline-save-btn"
          form={formId}
          isLoading={isSaving}
          size="sm"
          type="submit">
          {t('label.save-changes')}
        </Button>
      </Box>
    </Box>
  );
};

export default UserCustomPropertyInlineEditor;
