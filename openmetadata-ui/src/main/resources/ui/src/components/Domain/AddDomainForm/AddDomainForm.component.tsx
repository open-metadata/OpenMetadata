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
import { Button, Col, Form, FormProps, Row, Space } from 'antd';
import { omit } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import imageClassBase from '../../../components/BlockEditor/Extensions/image/ImageClassBase';
import {
  DATA_PRODUCT_TYPE_LABEL_KEYS,
  PORTFOLIO_PRIORITY_LABEL_KEYS,
  VISIBILITY_LABEL_KEYS,
} from '../../../constants/DataProduct.constants';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  CreateDataProduct,
  DataProductType,
  PortfolioPriority,
  Visibility,
} from '../../../generated/api/domains/createDataProduct';
import {
  CreateDomain,
  DomainType,
} from '../../../generated/api/domains/createDomain';
import { Operation } from '../../../generated/entity/policies/policy';
import {
  CustomProperty,
  EntityReference,
} from '../../../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
  RequiredField,
  TargetEntityType,
} from '../../../generated/governance/intakeForm';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../interface/FormUtils.interface';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import {
  domainTypeTooltipDataRender,
  iconTooltipDataRender,
} from '../../../utils/DomainUtils';
import { generateFormFields, getField } from '../../../utils/formUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  DEFAULT_DATA_PRODUCT_ICON,
  DEFAULT_DOMAIN_ICON,
} from '../../common/IconPicker';
import '../domain.less';
import { DomainFormType } from '../DomainPage.interface';
import { AddDomainFormProps } from './AddDomainForm.interface';

const AddDomainForm = ({
  isFormInDialog,
  loading,
  onCancel,
  onSubmit,
  formRef,
  type,
  parentDomain,
}: AddDomainFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm(formRef);
  const { permissions } = usePermissionProvider();
  const [intakeForm, setIntakeForm] = useState<IntakeForm | null>(null);
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );

  const isDataProduct = type === DomainFormType.DATA_PRODUCT;
  const isDomain =
    type === DomainFormType.DOMAIN || type === DomainFormType.SUBDOMAIN;

  const targetEntityType = useMemo<TargetEntityType | null>(() => {
    let entityType: TargetEntityType | null = null;
    if (isDataProduct) {
      entityType = TargetEntityType.DataProduct;
    } else if (isDomain) {
      entityType = TargetEntityType.Domain;
    }

    return entityType;
  }, [isDataProduct, isDomain]);

  useEffect(() => {
    let cancelled = false;
    if (!targetEntityType) {
      setIntakeForm(null);

      return;
    }
    getIntakeFormByEntityType(targetEntityType)
      .then((result) => {
        if (!cancelled) {
          setIntakeForm(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIntakeForm(null);
          showErrorToast(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [targetEntityType]);

  useEffect(() => {
    let cancelled = false;
    if (!targetEntityType) {
      setCustomProperties([]);

      return;
    }
    getCustomPropertiesByEntityType(targetEntityType)
      .then((props) => {
        if (!cancelled) {
          setCustomProperties(props ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCustomProperties([]);
          showErrorToast(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [targetEntityType]);

  const isCustomRequiredField = (field: RequiredField) =>
    field.fieldKind === FieldKind.CustomProperty ||
    field.fieldPath.startsWith('extension.');

  const nativeRequiredFieldsByPath = useMemo(() => {
    const map = new Map<string, RequiredField>();
    (intakeForm?.requiredFields ?? []).forEach((rf: RequiredField) => {
      if (!isCustomRequiredField(rf)) {
        map.set(rf.fieldPath, rf);
      }
    });

    return map;
  }, [intakeForm]);

  const extensionRequiredFields = useMemo<RequiredField[]>(
    () =>
      (intakeForm?.requiredFields ?? []).filter((rf) =>
        isCustomRequiredField(rf)
      ),
    [intakeForm]
  );

  const applyIntakeFormRequired = useCallback(
    (field: FieldProp): FieldProp => {
      const rf = nativeRequiredFieldsByPath.get(field.name as string);
      let result = field;
      if (rf) {
        const message =
          rf.errorMessage ||
          t('label.field-required', { field: rf.fieldLabel });
        result = {
          ...field,
          required: true,
          rules: [...(field.rules ?? []), { required: true, message }],
        };
      }

      return result;
    },
    [nativeRequiredFieldsByPath, t]
  );

  const dataProductTypeOptions = useMemo(
    () =>
      Object.values(DataProductType).map((value) => ({
        label: t(DATA_PRODUCT_TYPE_LABEL_KEYS[value]),
        value,
      })),
    [t]
  );

  const visibilityOptions = useMemo(
    () =>
      Object.values(Visibility).map((value) => ({
        label: t(VISIBILITY_LABEL_KEYS[value]),
        value,
      })),
    [t]
  );

  const portfolioPriorityOptions = useMemo(
    () =>
      Object.values(PortfolioPriority).map((value) => ({
        label: t(PORTFOLIO_PRIORITY_LABEL_KEYS[value]),
        value,
      })),
    [t]
  );

  const domainTypeArray = Object.keys(DomainType).map((key) => ({
    label: key,
    value: DomainType[key as keyof typeof DomainType],
  }));

  const selectedColor = Form.useWatch('color', form);

  // Check if upload functionality is available (for showing/hiding cover image field)
  const { onImageUpload } =
    imageClassBase.getBlockEditorAttachmentProps() ?? {};
  const isCoverImageUploadAvailable = !!onImageUpload;

  // Separate fields for custom layout
  const coverImageField: FieldProp | null = isCoverImageUploadAvailable
    ? {
        name: 'coverImage',
        id: 'root/coverImage',
        label: t('label.cover-image'),
        muiLabel: t('label.cover-image'),
        required: false,
        type: FieldTypes.COVER_IMAGE_UPLOAD_MUI,
        props: {
          'data-testid': 'cover-image',
          maxSizeMB: 5,
          maxDimensions: { width: 800, height: 400 },
          // NO onUpload prop - this makes MUICoverImageUpload store file locally
          // Parent component will handle upload after domain is created
        },
        formItemProps: {
          valuePropName: 'value',
          trigger: 'onChange',
        },
      }
    : null;

  const iconField: FieldProp = {
    name: 'iconURL',
    id: 'root/iconURL',
    label: t('label.icon'),
    muiLabel: t('label.icon'),
    required: false,
    type: FieldTypes.ICON_PICKER_MUI,
    helperText: iconTooltipDataRender(),
    props: {
      'data-testid': 'icon-url',
      allowUrl: true,
      placeholder: t('label.icon-url'),
      backgroundColor: selectedColor,
      defaultIcon:
        type === DomainFormType.DATA_PRODUCT
          ? DEFAULT_DATA_PRODUCT_ICON
          : DEFAULT_DOMAIN_ICON,
      customStyles: {
        searchBoxWidth: 366,
      },
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'value',
      trigger: 'onChange',
    },
  };

  const colorField: FieldProp = {
    name: 'color',
    id: 'root/color',
    label: t('label.color'),
    muiLabel: t('label.color'),
    required: false,
    type: FieldTypes.COLOR_PICKER_MUI,
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'value',
      trigger: 'onChange',
    },
  };

  const nameField: FieldProp = {
    name: 'name',
    id: 'root/name',
    label: t('label.name'),
    required: true,
    placeholder: t('label.name'),
    type: FieldTypes.TEXT_MUI,
    props: {
      'data-testid': 'name',
    },
    rules: NAME_FIELD_RULES,
  };

  const displayNameField: FieldProp = {
    name: 'displayName',
    id: 'root/displayName',
    label: t('label.display-name'),
    required: false,
    placeholder: t('label.display-name'),
    type: FieldTypes.TEXT_MUI,
    props: {
      'data-testid': 'display-name',
    },
  };

  const formFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'description',
        required: true,
        label: t('label.description'),
        id: 'root/description',
        type: FieldTypes.DESCRIPTION,
        props: {
          'data-testid': 'description',
          initialValue: '',
          height: 'auto',
          className: 'add-domain-form-description new-form-style',
        },
      },
      {
        name: 'tags',
        required: false,
        label: t('label.tag-plural'),
        id: 'root/tags',
        type: FieldTypes.UT_TAG_SUGGESTION,
        props: {
          selectProps: {
            'data-testid': 'tags-container',
          },
        },
      },
      {
        name: 'glossaryTerms',
        required: false,
        label: t('label.glossary-term-plural'),
        id: 'root/glossaryTerms',
        type: FieldTypes.GLOSSARY_TAG_SUGGESTION_MUI,
        props: {
          'data-testid': 'glossary-terms',
          placeholder: t('label.select-field', {
            field: t('label.glossary-term-plural'),
          }),
        },
      },
    ],
    [t]
  );

  const additionalFields: FieldProp[] = useMemo(() => {
    const fields: FieldProp[] = [];

    if (type === DomainFormType.DOMAIN || type === DomainFormType.SUBDOMAIN) {
      const domainTypeField: FieldProp = {
        name: 'domainType',
        required: true,
        label: t('label.domain-type'),
        id: 'root/domainType',
        type: FieldTypes.SELECT_MUI,
        helperText: domainTypeTooltipDataRender(),
        props: {
          'data-testid': 'domainType',
          options: domainTypeArray,
          overlayClassName: 'domain-type-tooltip-container',
          tooltipPlacement: 'top-start',
          tooltipAlign: { targetOffset: [18, 0] },
          slotProps: {
            tooltip: {
              sx: {
                bgcolor: '#fff',
                color: '#000',
              },
            },
            arrow: {
              sx: {
                color: '#fff',
              },
            },
          },
        },
        placeholder: t('label.select-entity', {
          entity: t('label.domain-type'),
        }),
      };

      fields.push(domainTypeField);
    }

    // Add domain selection field for Data Products ONLY when NOT in domain context
    if (type === DomainFormType.DATA_PRODUCT && !parentDomain) {
      const domainField: FieldProp = {
        name: 'domains',
        required: true,
        label: t('label.domain'),
        muiLabel: t('label.domain'),
        id: 'root/domains',
        type: FieldTypes.DOMAIN_SELECT_MUI,
        props: {
          'data-testid': 'domain-select',
          hasPermission: true,
          multiple: false,
        },
        formItemLayout: FormItemLayout.HORIZONTAL,
        formItemProps: {
          valuePropName: 'value',
          trigger: 'onChange',
        },
      };

      fields.push(domainField);
    }

    return fields;
  }, [type, parentDomain, domainTypeArray, t]);

  const ownerField: FieldProp = {
    name: 'owners',
    id: 'root/owner',
    required: false,
    label: t('label.owner-plural'),
    type: FieldTypes.USER_TEAM_SELECT_MUI,
    props: {
      multipleUser: true,
      multipleTeam: false,
      label: t('label.owner-plural'),
    },
    formItemProps: {
      valuePropName: 'value',
      trigger: 'onChange',
    },
  };

  const expertsField: FieldProp = {
    name: 'experts',
    id: 'root/experts',
    required: false,
    label: t('label.expert-plural'),
    type: FieldTypes.USER_TEAM_SELECT_MUI,
    props: {
      userOnly: true,
      multipleUser: true,
      label: t('label.expert-plural'),
    },
    formItemProps: {
      valuePropName: 'value',
      trigger: 'onChange',
      initialValue: [],
    },
  };

  const reviewersField: FieldProp = {
    name: 'reviewers',
    id: 'root/reviewers',
    required: false,
    label: t('label.reviewer-plural'),
    type: FieldTypes.USER_TEAM_SELECT_MUI,
    props: {
      userOnly: true,
      multipleUser: true,
      label: t('label.reviewer-plural'),
    },
    formItemProps: {
      valuePropName: 'value',
      trigger: 'onChange',
      initialValue: [],
    },
  };

  const dataProductTypeField: FieldProp = {
    name: 'dataProductType',
    id: 'root/dataProductType',
    required: false,
    label: t('label.type'),
    type: FieldTypes.SELECT_MUI,
    props: {
      'data-testid': 'dataProductType',
      options: dataProductTypeOptions,
    },
    placeholder: t('label.select-entity', { entity: t('label.type') }),
  };

  const visibilityField: FieldProp = {
    name: 'visibility',
    id: 'root/visibility',
    required: false,
    label: t('label.visibility'),
    type: FieldTypes.SELECT_MUI,
    props: {
      'data-testid': 'visibility',
      options: visibilityOptions,
    },
    placeholder: t('label.select-entity', { entity: t('label.visibility') }),
  };

  const portfolioPriorityField: FieldProp = {
    name: 'portfolioPriority',
    id: 'root/portfolioPriority',
    required: false,
    label: t('label.portfolio-priority'),
    type: FieldTypes.SELECT_MUI,
    props: {
      'data-testid': 'portfolioPriority',
      options: portfolioPriorityOptions,
    },
    placeholder: t('label.select-entity', {
      entity: t('label.portfolio-priority'),
    }),
  };

  const extensionFields: FieldProp[] = useMemo(
    () =>
      extensionRequiredFields.map((rf): FieldProp => {
        const propertyName = rf.fieldPath.startsWith('extension.')
          ? rf.fieldPath.substring('extension.'.length)
          : rf.fieldPath;
        const definition = customProperties.find(
          (cp) => cp.name === propertyName
        );
        const propertyTypeName = definition?.propertyType?.name ?? 'string';
        const config = definition?.customPropertyConfig?.config;
        const requiredMessage =
          rf.errorMessage ||
          t('label.field-required', { field: rf.fieldLabel });
        const baseField: FieldProp = {
          name: ['extension', propertyName],
          id: `root/extension/${propertyName}`,
          label: rf.fieldLabel,
          required: true,
          placeholder: rf.fieldLabel,
          rules: [{ required: true, message: requiredMessage }],
          props: { 'data-testid': `extension-${propertyName}` },
          type: FieldTypes.TEXT_MUI,
        };

        let result = baseField;
        if (propertyTypeName === 'enum') {
          const enumConfig = config as
            | { values?: string[]; multiSelect?: boolean }
            | undefined;
          result = {
            ...baseField,
            type: FieldTypes.SELECT_MUI,
            props: {
              'data-testid': `extension-${propertyName}`,
              options: (enumConfig?.values ?? []).map((value) => ({
                label: value,
                value,
              })),
              multiple: enumConfig?.multiSelect,
            },
          };
        } else if (
          propertyTypeName === 'integer' ||
          propertyTypeName === 'number'
        ) {
          result = { ...baseField, type: FieldTypes.NUMBER };
        }

        return result;
      }),
    [extensionRequiredFields, customProperties, t]
  );

  const createPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const selectedOwners =
    Form.useWatch<EntityReference | EntityReference[]>('owners', form) ?? [];

  const ownersList = Array.isArray(selectedOwners)
    ? selectedOwners
    : [selectedOwners];

  const expertsList = Form.useWatch<EntityReference[]>('experts', form) ?? [];

  const reviewersList =
    Form.useWatch<EntityReference[]>('reviewers', form) ?? [];

  const handleFormSubmit: FormProps['onFinish'] = (formData) => {
    const updatedData = omit(
      formData,
      'color',
      'iconURL',
      'glossaryTerms'
      // Keep 'coverImage' - parent will extract and remove it before API call
      // Don't exclude 'domains' - we need it for DataProducts
    );
    const style = {
      color: formData.color,
      iconURL: formData.iconURL,
      // Don't include coverImage here - it's not uploaded yet
      // Parent will add it to style after upload
    };

    // Build the data object
    const data: CreateDomain | CreateDataProduct = {
      ...updatedData,
      style,
      experts: expertsList.map((item) => item.name ?? ''),
      owners: ownersList ?? [],
      tags: [...(formData.tags ?? []), ...(formData.glossaryTerms ?? [])],
    } as CreateDomain | CreateDataProduct;

    // Handle domains field based on form type
    if (type === DomainFormType.DATA_PRODUCT) {
      (data as CreateDataProduct).reviewers = reviewersList;
      // For DataProduct, set domains as array
      if (formData.domains) {
        (data as CreateDataProduct).domains = [
          formData.domains.fullyQualifiedName,
        ];
      } else if (parentDomain?.fullyQualifiedName) {
        // If creating within a domain context, use parent domain
        (data as CreateDataProduct).domains = [parentDomain.fullyQualifiedName];
      }
    } else {
      // For Domain/SubDomain, remove domains field if it exists
      delete (data as CreateDomain & { domains?: unknown }).domains;
    }

    onSubmit(data)
      .then(() => form.resetFields())
      .catch(() => {
        // Form will not be reset on error
        // Error is already handled by parent component
      });
  };

  return (
    <Form
      data-testid="add-domain"
      form={form}
      layout="vertical"
      onFinish={handleFormSubmit}>
      {/* Cover Image */}
      {coverImageField && (
        <div className="tw:mb-2">{getField(coverImageField)}</div>
      )}

      {/* Icon and Color row */}
      <div className="tw:flex tw:items-start tw:gap-2">
        <div>{getField(iconField)}</div>
        <div className="tw:ml-auto">{getField(colorField)}</div>
      </div>

      {/* Name and Display Name row */}
      <Row gutter={16}>
        <Col span={12}>{getField(applyIntakeFormRequired(nameField))}</Col>
        <Col span={12}>
          {getField(applyIntakeFormRequired(displayNameField))}
        </Col>
      </Row>

      {/* Remaining fields */}
      {generateFormFields(
        [...formFields, ...additionalFields].map(applyIntakeFormRequired)
      )}
      {isDataProduct && (
        <>
          <div className="m-t-xss">
            {getField(applyIntakeFormRequired(dataProductTypeField))}
          </div>
          <div className="m-t-xss">
            {getField(applyIntakeFormRequired(visibilityField))}
          </div>
          <div className="m-t-xss">
            {getField(applyIntakeFormRequired(portfolioPriorityField))}
          </div>
        </>
      )}
      <div className="m-t-xss">
        {getField(applyIntakeFormRequired(ownerField))}
      </div>
      <div className="m-t-xss">
        {getField(applyIntakeFormRequired(expertsField))}
      </div>
      {isDataProduct && (
        <div className="m-t-xss">
          {getField(applyIntakeFormRequired(reviewersField))}
        </div>
      )}
      {extensionFields.map((field) => (
        <div className="m-t-xss" key={field.id}>
          {getField(field)}
        </div>
      ))}

      {!isFormInDialog && (
        <Space
          className="w-full justify-end"
          data-testid="cta-buttons"
          size={16}>
          <Button data-testid="cancel-domain" type="link" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="save-domain"
            disabled={!createPermission}
            htmlType="submit"
            loading={loading}
            type="primary">
            {t('label.save')}
          </Button>
        </Space>
      )}
    </Form>
  );
};

export default AddDomainForm;
