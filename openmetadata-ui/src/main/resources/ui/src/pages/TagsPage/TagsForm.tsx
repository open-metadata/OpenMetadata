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

import { Box, Grid, SxProps, Theme } from '@mui/material';
import { Form } from 'antd';
import { castArray } from 'lodash';
import { Suspense, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityAttachmentProvider } from '../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import MUIFormItemLabel from '../../components/common/MUIFormItemLabel/MUIFormItemLabel';
import { VALIDATION_MESSAGES } from '../../constants/constants';
import {
  DEFAULT_FORM_VALUE,
  TAG_NAME_VALIDATION_RULES,
} from '../../constants/Tags.constant';
import { EntityType } from '../../enums/entity.enum';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import { CreateTag } from '../../generated/api/classification/createTag';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { EntityReference } from '../../generated/entity/type';
import { useEntityRules } from '../../hooks/useEntityRules';
import { FieldProp } from '../../interface/FormUtils.interface';
import { generateFormFields, getField } from '../../utils/formUtils';
import tagClassBase from '../../utils/TagClassBase';
import {
  COLOR_FIELD,
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
import { RenameFormProps } from './TagsPage.interface';

const LABEL_STYLES: SxProps<Theme> = {
  color: (theme) => theme.palette.grey[700],
  fontWeight: (theme) => theme.typography.subtitle2.fontWeight,
};

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

  const iconField = useMemo(() => {
    const field = getIconField(selectedColor);

    return {
      ...field,
      muiLabel: (
        <MUIFormItemLabel label={t(field.muiLabel)} labelSx={LABEL_STYLES} />
      ),
      props: {
        ...field.props,
        placeholder: t(field.placeholder),
      },
    };
  }, [t, selectedColor]);

  const colorField = useMemo(
    () => ({
      ...COLOR_FIELD,
      muiLabel: (
        <MUIFormItemLabel
          label={t(COLOR_FIELD.muiLabel)}
          labelSx={LABEL_STYLES}
        />
      ),
    }),
    [t]
  );

  const nameField = useMemo(() => {
    const field = getNameField(disableNameField || false);

    return {
      ...field,
      muiLabel: t(field.muiLabel),
      placeholder: t(field.placeholder),
      rules: TAG_NAME_VALIDATION_RULES.map((rule) => ({
        ...rule,
        message: rule.message
          ? t(rule.message, {
              ...rule.messageData,
              field: rule.messageData?.field
                ? t(rule.messageData.field)
                : undefined,
              entity: rule.messageData?.entity
                ? t(rule.messageData.entity)
                : undefined,
            })
          : undefined,
      })),
    };
  }, [t, disableNameField]);

  const displayNameField = useMemo(() => {
    const field = getDisplayNameField(disableDisplayNameField);

    return {
      ...field,
      muiLabel: t(field.muiLabel),
      placeholder: t(field.placeholder),
    };
  }, [t, disableDisplayNameField]);

  const ownerField = useMemo(() => {
    const field = getOwnerField({
      canAddMultipleUserOwners: entityRules.canAddMultipleUserOwners,
      canAddMultipleTeamOwner: entityRules.canAddMultipleTeamOwner,
    });

    return {
      ...field,
      muiLabel: t(field.muiLabel),
    };
  }, [
    t,
    entityRules.canAddMultipleUserOwners,
    entityRules.canAddMultipleTeamOwner,
  ]);

  const domainField = useMemo(() => {
    const field = getDomainField({
      canAddMultipleDomains: entityRules.canAddMultipleDomains,
    });

    return {
      ...field,
      muiLabel: t(field.muiLabel),
    };
  }, [entityRules.canAddMultipleDomains, t]);

  const formFields: FieldProp[] = useMemo(() => {
    const descriptionField = getDescriptionField({
      initialValue: initialValues?.description ?? '',
      readonly: disableDescriptionField,
    });

    const fields: FieldProp[] = [
      {
        ...descriptionField,
        label: (
          <MUIFormItemLabel
            label={t(descriptionField.label)}
            labelSx={LABEL_STYLES}
          />
        ),
      },
    ];

    if (isSystemTag && !isTier) {
      const disabledField = getDisabledField({
        initialValue: initialValues?.disabled ?? false,
        disabled: disableDisabledField,
      });

      fields.push({
        ...disabledField,
        label: t(disabledField.label),
      });
    }

    return fields;
  }, [
    t,
    initialValues?.description,
    initialValues?.disabled,
    disableDescriptionField,
    disableDisabledField,
    isSystemTag,
    isTier,
  ]);

  const mutuallyExclusiveField = useMemo(() => {
    const field = getMutuallyExclusiveField({
      disabled: disableMutuallyExclusiveField,
      showHelperText: Boolean(isMutuallyExclusive),
    });

    return {
      ...field,
      muiLabel: t(field.muiLabel),
    };
  }, [t, disableMutuallyExclusiveField, isMutuallyExclusive]);

  const autoClassificationComponent = useMemo(
    () =>
      tagClassBase.getAutoClassificationComponent(isClassification || false),
    [isClassification]
  );

  const handleSave = async (data: Classification | Tag | undefined) => {
    const domains = castArray(selectedDomain).filter(Boolean);
    const owners = castArray(selectedOwners).filter(Boolean);

    try {
      let domainsData;
      if (domains?.length) {
        if (isEditing) {
          domainsData = domains;
        } else {
          domainsData = domains
            .map((domain) => domain.fullyQualifiedName ?? domain.name)
            .filter(Boolean);
        }
      }

      const submitData = {
        ...data,
        owners: owners?.length ? owners : undefined,
        domains: domainsData,
      } as CreateClassification | CreateTag;
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
        <Grid container spacing={4}>
          <Grid size={6}>{getField(nameField)}</Grid>
          <Grid size={6}>{getField(displayNameField)}</Grid>
        </Grid>

        {/* Icon and Color row */}
        {!isClassification && (
          <Grid container spacing={2} sx={{ flexWrap: 'nowrap' }}>
            <Grid>{getField(iconField)}</Grid>
            <Grid sx={{ ml: 'auto', minWidth: 0 }}>{getField(colorField)}</Grid>
          </Grid>
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
