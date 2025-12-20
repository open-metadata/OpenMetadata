/*
 *  Copyright 2023 Collate.
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

import { Box } from '@mui/material';
import { Col, Form, Row } from 'antd';
import { castArray } from 'lodash';
import { Suspense, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityAttachmentProvider } from '../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import { VALIDATION_MESSAGES } from '../../constants/constants';
import { DEFAULT_FORM_VALUE } from '../../constants/Tags.constant';
import { EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/entity/type';
import { useEntityRules } from '../../hooks/useEntityRules';
import { FieldProp } from '../../interface/FormUtils.interface';
import { generateFormFields, getField } from '../../utils/formUtils';
import tagClassBase from '../../utils/TagClassBase';
import {
  getColorField,
  getDescriptionField,
  getDisabledField,
  getDisplayNameField,
  getDomainField,
  getIconField,
  getMutuallyExclusiveField,
  getNameField,
  getOwnerField,
} from './tagFormFields';
import './TagsForm.less';
import { RenameFormProps, SubmitProps } from './TagsPage.interface';

const TagsForm = ({
  formRef,
  initialValues,
  onSubmit,
  showMutuallyExclusive = false,
  isSystemTag,
  permissions,
  isClassification,
  isEditing = false,
  isTier = false,
}: RenameFormProps) => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.CLASSIFICATION);
  const selectedColor = Form.useWatch(['style', 'color'], formRef);
  const selectedDomain = Form.useWatch<EntityReference[] | undefined>(
    'domains',
    formRef
  );
  const selectedOwners = Form.useWatch<
    EntityReference | EntityReference[] | undefined
  >('owners', formRef);
  const isMutuallyExclusive = Form.useWatch<boolean | undefined>(
    'mutuallyExclusive',
    formRef
  );

  useEffect(() => {
    formRef?.setFieldsValue(initialValues);
  }, [initialValues, formRef]);

  const disableNameField = useMemo(
    () => isEditing && isSystemTag,
    [isEditing, isSystemTag]
  );

  const disableDisplayNameField = useMemo(
    () =>
      isEditing
        ? !(permissions?.editDisplayName || permissions?.editAll)
        : !(permissions?.createTags || isClassification),
    [isEditing, isClassification, permissions]
  );

  const disableDescriptionField = useMemo(
    () =>
      isEditing
        ? !(permissions?.editDescription || permissions?.editAll)
        : !(permissions?.createTags || isClassification),
    [isEditing, isClassification, permissions]
  );

  const disableDisabledField = useMemo(
    () =>
      isEditing
        ? !permissions?.editAll
        : !(permissions?.createTags || isClassification),
    [isEditing, isClassification, permissions]
  );

  const disableMutuallyExclusiveField = useMemo(
    () => (isEditing ? !permissions?.editAll : !isClassification),
    [isEditing, isClassification, permissions]
  );

  const iconField = useMemo(
    () => getIconField(t, selectedColor),
    [t, selectedColor]
  );

  const colorField = useMemo(() => getColorField(t), [t]);

  const nameField = useMemo(
    () => getNameField(t, disableNameField || false),
    [t, disableNameField]
  );

  const displayNameField = useMemo(
    () => getDisplayNameField(t, disableDisplayNameField),
    [t, disableDisplayNameField]
  );

  const ownerField = useMemo(
    () =>
      getOwnerField(t, {
        canAddMultipleUserOwners: entityRules.canAddMultipleUserOwners,
        canAddMultipleTeamOwner: entityRules.canAddMultipleTeamOwner,
      }),
    [
      t,
      entityRules.canAddMultipleUserOwners,
      entityRules.canAddMultipleTeamOwner,
    ]
  );

  const domainField = useMemo(
    () =>
      getDomainField(t, {
        canAddMultipleDomains: entityRules.canAddMultipleDomains,
      }),
    [t, entityRules.canAddMultipleDomains]
  );

  const formFields: FieldProp[] = useMemo(
    () => [
      getDescriptionField(t, {
        initialValue: initialValues?.description ?? '',
        readonly: disableDescriptionField,
      }),
      ...(isSystemTag && !isTier
        ? ([
            getDisabledField(t, {
              initialValue: initialValues?.disabled ?? false,
              disabled: disableDisabledField,
            }),
          ] as FieldProp[])
        : []),
    ],
    [
      t,
      initialValues?.description,
      initialValues?.disabled,
      disableDescriptionField,
      disableDisabledField,
      isSystemTag,
      isTier,
    ]
  );

  const mutuallyExclusiveField = useMemo(
    () =>
      getMutuallyExclusiveField(t, {
        disabled: disableMutuallyExclusiveField,
        showHelperText: Boolean(isMutuallyExclusive),
      }),
    [t, disableMutuallyExclusiveField, isMutuallyExclusive]
  );

  const autoClassificationComponent = useMemo(
    () =>
      tagClassBase.getAutoClassificationComponent(isClassification || false),
    [isClassification]
  );

  const handleSave = async (data: SubmitProps) => {
    const domains = castArray(selectedDomain).filter(Boolean);
    const owners = castArray(selectedOwners).filter(Boolean);

    try {
      let domainsData;
      if (domains?.length) {
        if (isEditing) {
          domainsData = domains;
        } else {
          domainsData = domains.map(
            (domain) => domain.fullyQualifiedName ?? domain.name
          );
        }
      }

      const submitData = {
        ...data,
        owners: owners?.length ? owners : undefined,
        domains: domainsData,
      };
      await onSubmit(submitData);
      formRef.setFieldsValue(DEFAULT_FORM_VALUE);
    } catch {
      // Parent will handle the error
    }
  };

  return (
    <EntityAttachmentProvider
      entityFqn={initialValues?.fullyQualifiedName}
      entityType={
        isClassification ? EntityType.CLASSIFICATION : EntityType.TAG
      }>
      <Form
        className="tags-form"
        data-testid="tags-form"
        form={formRef}
        initialValues={initialValues ?? DEFAULT_FORM_VALUE}
        layout="vertical"
        name="tags"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSave}>
        {/* Name and Display Name row */}
        <Row gutter={16}>
          <Col span={12}>{getField(nameField)}</Col>
          <Col span={12}>{getField(displayNameField)}</Col>
        </Row>

        {/* Icon and Color row */}
        {!isClassification && (
          <Box
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <Box>{getField(iconField)}</Box>
            <Box sx={{ ml: 'auto' }}>{getField(colorField)}</Box>
          </Box>
        )}

        {/* Remaining fields */}
        {generateFormFields(formFields)}
        <Box sx={{ mb: 6 }}>
          {showMutuallyExclusive && getField(mutuallyExclusiveField)}
        </Box>

        {/* Owner and Domain fields */}
        <div className="m-t-xss">{getField(ownerField)}</div>
        <div className="m-t-xss">{getField(domainField)}</div>

        {/* Auto Classification fields */}
        {autoClassificationComponent && (
          <Suspense fallback={null}>{autoClassificationComponent}</Suspense>
        )}
      </Form>
    </EntityAttachmentProvider>
  );
};

export default TagsForm;
