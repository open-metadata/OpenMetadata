/*
 *  Copyright 2022 Collate.
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
  Badge,
  Button as CoreButton,
  SelectItemType,
  SlideoutMenu,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Button, Col, Form, FormInstance, Row } from 'antd';
import { AxiosError } from 'axios';
import { ReactComponent as ColumnIcon } from '../../../../assets/svg/ic-column.svg';

import { isArray, isUndefined, map, omit, omitBy, startCase } from 'lodash';
import { FocusEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CUSTOM_PROPERTIES_ICON_MAP,
  ENTITY_REFERENCE_OPTIONS,
  PROPERTY_TYPES_WITH_ENTITY_REFERENCE,
  PROPERTY_TYPES_WITH_FORMAT,
  SUPPORTED_FORMAT_MAP,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../../constants/CustomProperty.constants';
import { GlobalSettingsMenuCategory } from '../../../../constants/GlobalSettings.constants';
import { CUSTOM_PROPERTY_NAME_REGEX } from '../../../../constants/regex.constants';
import {
  CUSTOM_PROPERTY_CATEGORY,
  OPEN_METADATA,
} from '../../../../constants/service-guide.constant';
import { EntityType } from '../../../../enums/entity.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { Category, Type } from '../../../../generated/entity/type';
import { CustomProperty } from '../../../../generated/type/customProperty';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import {
  addPropertyToEntity,
  getTypeByFQN,
  getTypeListByCategory,
} from '../../../../rest/metadataTypeAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { generateFormFields } from '../../../../utils/formUtils';
import { getSettingOptionByEntityType } from '../../../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';

interface AddCustomPropertyProps {
  formRef?: FormInstance;
  onCancel?: () => void;
  onSubmit?: (data: CustomProperty) => void;
  loading?: boolean;
  entityType?: EntityType;
  open?: boolean;
  onClose?: () => void;
}

const AddCustomProperty = ({
  formRef,
  onSubmit,
  loading,
  entityType: entityTypeProp,
  open,
  onClose,
  onCancel,
}: AddCustomPropertyProps) => {
  const [localForm] = Form.useForm();
  const form = formRef ?? localForm;
  const { entityType: entityTypeParam } = useRequiredParams<{
    entityType: EntityType;
  }>();
  const entityType = entityTypeProp ?? entityTypeParam;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [typeDetail, setTypeDetail] = useState<Type>();

  const [propertyTypes, setPropertyTypes] = useState<Array<Type>>([]);
  const [activeField, setActiveField] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isFormInvalid, setIsFormInvalid] = useState<boolean>(true);
  const [showSidePanel, setShowSidePanel] = useState<boolean>(false);

  const watchedPropertyType = Form.useWatch('propertyType', form);

  const slashedBreadcrumb = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: getSettingPath(),
      },
      {
        name: t('label.custom-attribute-plural'),
        url: getSettingPath(
          GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
          getSettingOptionByEntityType(entityType)
        ),
      },
      {
        name: t('label.add-entity', {
          entity: t('label.custom-property'),
        }),
        url: '',
      },
    ],
    [entityType]
  );

  const propertyTypeOptions: SelectItemType[] = useMemo(() => {
    return map(propertyTypes, (type) => {
      const Icon =
        CUSTOM_PROPERTIES_ICON_MAP[
          type.name as keyof typeof CUSTOM_PROPERTIES_ICON_MAP
        ];

      // Remove -cp from the name and convert to start case
      const title = startCase(getEntityName(type).replaceAll('-cp', ''));

      return {
        id: type.id ?? '',
        label: title,
        icon: Icon,
      };
    });
  }, [propertyTypes]);

  const {
    hasEnumConfig,
    hasFormatConfig,
    hasEntityReferenceConfig,
    watchedTypeName,
    hasTableTypeConfig,
  } = useMemo(() => {
    const watchedTypeName =
      propertyTypes.find((type) => type.id === watchedPropertyType)?.name ?? '';

    const hasEnumConfig = watchedTypeName === 'enum';

    const hasTableTypeConfig = watchedTypeName === TABLE_TYPE_CUSTOM_PROPERTY;

    const hasFormatConfig =
      PROPERTY_TYPES_WITH_FORMAT.includes(watchedTypeName);

    const hasEntityReferenceConfig =
      PROPERTY_TYPES_WITH_ENTITY_REFERENCE.includes(watchedTypeName);

    return {
      hasEnumConfig,
      hasFormatConfig,
      hasEntityReferenceConfig,
      watchedTypeName,
      hasTableTypeConfig,
    };
  }, [watchedPropertyType, propertyTypes]);

  const fetchPropertyType = async () => {
    try {
      const response = await getTypeListByCategory(Category.Field);
      setPropertyTypes(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchTypeDetail = async (typeFQN: string) => {
    if (!typeFQN) {
      return;
    }
    try {
      const response = await getTypeByFQN(typeFQN);
      setTypeDetail(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  }, [navigate, onCancel]);

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLFormElement>) => {
    const isDescription = event.target.classList.contains('ProseMirror');
    const fieldName = isDescription ? 'root/description' : event.target.id;

    setActiveField(fieldName);
  }, []);

  const handleFieldsChange = useCallback(() => {
    // Internal validation logic for Drawer
    const hasErrors = form.getFieldsError().some(({ errors }) => errors.length);

    const { name, propertyType, description } = form.getFieldsValue();
    const isNameValid = !!name;
    const isPropertyTypeValid = !!propertyType;
    const isDescriptionValid = !!description;

    setIsFormInvalid(
      hasErrors || !isNameValid || !isPropertyTypeValid || !isDescriptionValid
    );
  }, [form]);

  useEffect(() => {
    if (entityType) {
      fetchTypeDetail(entityType);
    }
  }, [entityType]);

  useEffect(() => {
    fetchPropertyType();
  }, []);

  const getAppliesToField = useCallback(() => {
    return (
      <Badge
        className="flex items-center gap-1"
        color="gray"
        size="md"
        type="pill-color">
        <ColumnIcon height={14} width={14} />
        {t('label.table-column')}
      </Badge>
    );
  }, [t]);

  const supportedFormats = useMemo(() => {
    return (
      SUPPORTED_FORMAT_MAP[
        watchedTypeName as keyof typeof SUPPORTED_FORMAT_MAP
      ] ?? []
    );
  }, [watchedTypeName]);

  const formFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'name',
        required: true,
        label: t('label.name'),
        id: 'root/name',
        type: FieldTypes.UT_TEXT,
        props: {
          'data-testid': 'name',
          autoComplete: 'off',
        },
        placeholder: t('label.name'),
        rules: [
          {
            max: 256,
            message: t('message.entity-size-in-between', {
              entity: t('label.name'),
              min: 1,
              max: 256,
            }),
          },
          {
            pattern: CUSTOM_PROPERTY_NAME_REGEX,
            message: t('message.custom-property-name-validation'),
          },
        ],
      },
      {
        name: 'displayName',
        id: 'root/displayName',
        label: t('label.display-name'),
        required: false,
        placeholder: t('label.display-name'),
        type: FieldTypes.UT_TEXT,
        props: {
          'data-testid': 'display-name',
        },
      },
      {
        name: 'propertyType',
        required: true,
        label: t('label.type'),
        id: 'root/propertyType',
        type: FieldTypes.UT_SELECT,
        placeholder: `${t('label.select-field', {
          field: t('label.type'),
        })}`,
        props: {
          'data-testid': 'propertyType',
          items: propertyTypeOptions,
        },
      },
      ...(entityType === EntityType.TABLE_COLUMN
        ? [
            {
              name: 'appliesTo',
              required: false,
              label: t('label.applies-to'),
              id: 'root/appliesTo',
              type: FieldTypes.COMPONENT,
              props: {
                'data-testid': 'applies-to',
                children: getAppliesToField(),
              },
            },
          ]
        : []),
    ],
    [getAppliesToField, propertyTypeOptions, t, entityType]
  );

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'description',
      required: true,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
      },
    }),
    [t]
  );

  const enumConfigField: FieldProp = useMemo(
    () => ({
      name: 'enumConfig',
      required: false,
      label: t('label.enum-value-plural'),
      id: 'root/enumConfig',
      type: FieldTypes.SELECT,
      props: {
        'data-testid': 'enumConfig',
        mode: 'tags',
        placeholder: t('label.enum-value-plural'),
        open: false,
        className: 'trim-select',
        getPopupContainer: (triggerNode: HTMLElement) =>
          triggerNode.parentElement ?? document.body,
      },
      rules: [
        {
          required: true,
          message: t('label.field-required', {
            field: t('label.enum-value-plural'),
          }),
        },
      ],
    }),
    [t]
  );

  const multiSelectField: FieldProp = useMemo(
    () => ({
      name: 'multiSelect',
      label: t('label.multi-select'),
      type: FieldTypes.UT_SWITCH,
      required: false,
      props: {
        'data-testid': 'multiSelect',
      },
      id: 'root/multiSelect',
      formItemLayout: FormItemLayout.HORIZONTAL,
    }),
    [t]
  );

  const formatConfigField: FieldProp = useMemo(
    () => ({
      name: 'formatConfig',
      required: false,
      label: t('label.format'),
      id: 'root/formatConfig',
      type: FieldTypes.UT_SELECT,
      props: {
        'data-testid': 'formatConfig',
        items: supportedFormats.map((option) => ({
          id: option,
          label: option,
        })),
      },
      placeholder: t('label.format'),
      rules: [
        {
          validator: (_, value) => {
            if (value && !supportedFormats.includes(value)) {
              return Promise.reject(
                t('label.field-invalid', {
                  field: t('label.format'),
                })
              );
            }

            return Promise.resolve();
          },
        },
      ],
    }),
    [supportedFormats, t]
  );

  const entityReferenceConfigField: FieldProp = useMemo(
    () => ({
      name: 'entityReferenceConfig',
      required: true,
      label: t('label.entity-reference-types'),
      id: 'root/entityReferenceConfig',
      type: FieldTypes.SELECT,
      props: {
        mode: 'multiple',
        options: ENTITY_REFERENCE_OPTIONS,
        'data-testid': 'entityReferenceConfig',
        placeholder: `${t('label.select-field', {
          field: t('label.type'),
        })}`,
        getPopupContainer: (triggerNode: HTMLElement) =>
          triggerNode.parentElement ?? document.body,
      },
    }),
    [t]
  );

  const tableTypePropertyConfig: FieldProp[] = useMemo(
    () => [
      {
        name: 'columns',
        required: true,
        label: t('label.column-plural'),
        id: 'root/columns',
        type: FieldTypes.SELECT,
        props: {
          'data-testid': 'columns',
          mode: 'tags',
          placeholder: t('label.column-plural'),
          getPopupContainer: (triggerNode: HTMLElement) =>
            triggerNode.parentElement ?? document.body,
        },
        rules: [
          {
            required: true,
            validator: async (_, value) => {
              if (isArray(value)) {
                if (value.length > 3) {
                  throw t('message.maximum-count-allowed', {
                    count: 3,
                    label: t('label.column-plural'),
                  });
                }
              } else {
                throw t('label.field-required', {
                  field: t('label.column-plural'),
                });
              }
            },
          },
        ],
      },
    ],
    [t]
  );

  const handleFormSubmit = async (
    data: Exclude<CustomProperty, 'propertyType'> & {
      propertyType: string;
      enumConfig: string[];
      formatConfig: string;
      entityReferenceConfig: string[];
      multiSelect?: boolean;
      columns: string[];
    }
  ) => {
    if (isUndefined(typeDetail)) {
      return;
    }

    let customPropertyConfig;

    if (hasEnumConfig) {
      customPropertyConfig = {
        config: {
          multiSelect: Boolean(data?.multiSelect),
          values: data.enumConfig,
        },
      };
    }

    if (hasFormatConfig) {
      customPropertyConfig = {
        config: data.formatConfig,
      };
    }

    if (hasEntityReferenceConfig) {
      customPropertyConfig = {
        config: data.entityReferenceConfig,
      };
    }

    if (hasTableTypeConfig) {
      customPropertyConfig = {
        config: {
          columns: data.columns,
        },
      };
    }

    const payload = omitBy(
      {
        ...omit(data, [
          'multiSelect',
          'formatConfig',
          'entityReferenceConfig',
          'enumConfig',
          'columns',
        ]),
        propertyType: {
          id: data.propertyType,
          type: 'type',
        },
        customPropertyConfig,
      },
      isUndefined
    ) as unknown as CustomProperty;

    if (onSubmit) {
      onSubmit(payload);

      return;
    }

    try {
      setIsCreating(true);
      await addPropertyToEntity(typeDetail?.id ?? '', payload);
      navigate(-1);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsCreating(false);
    }
  };

  const formContent = (
    <Form
      className="m-t-md"
      data-testid="custom-property-form"
      form={form}
      layout="vertical"
      onFieldsChange={handleFieldsChange}
      onFinish={handleFormSubmit}
      onFocus={handleFieldFocus}>
      {generateFormFields(formFields)}
      {
        // Only show enum value field if the property type has enum config
        hasEnumConfig && generateFormFields([enumConfigField, multiSelectField])
      }
      {
        // Only show format field if the property type has format config
        hasFormatConfig && generateFormFields([formatConfigField])
      }

      {
        // Only show entity reference field if the property type has entity reference config
        hasEntityReferenceConfig &&
          generateFormFields([entityReferenceConfigField])
      }

      {hasTableTypeConfig && generateFormFields(tableTypePropertyConfig)}

      {generateFormFields([descriptionField])}
      {isUndefined(open) && (
        <Row justify="end">
          <Col>
            <Button
              data-testid="back-button"
              type="link"
              onClick={handleCancel}>
              {t('label.back')}
            </Button>
          </Col>
          <Col>
            <Button
              data-testid="create-button"
              htmlType="submit"
              loading={isCreating || loading}
              type="primary">
              {t('label.create')}
            </Button>
          </Col>
        </Row>
      )}
    </Form>
  );

  if (!isUndefined(open)) {
    const isDrawerLoading = loading || isCreating;

    return (
      <SlideoutMenu
        isDismissable
        className="tw:z-1000"
        data-testid="add-custom-property-drawer"
        isOpen={open}
        width={showSidePanel ? 1200 : 700}
        onOpenChange={(isDrawerOpen) => {
          if (!isDrawerOpen) {
            (onClose ?? handleCancel)();
          }
        }}>
        {({ close }) => (
          <>
            <SlideoutMenu.Header
              className="tw:flex tw:items-center tw:justify-between tw:gap-4 tw:border-b tw:border-secondary tw:py-4"
              onClose={close}>
              <Typography
                className="tw:text-primary"
                size="text-lg"
                weight="semibold">
                {t('label.add-entity', {
                  entity: t('label.custom-property'),
                })}
              </Typography>
              <div className="tw:mr-8 tw:flex tw:items-center tw:gap-2">
                <Toggle
                  data-testid="show-side-panel-switch"
                  isSelected={showSidePanel}
                  onChange={setShowSidePanel}
                />
                <Typography className="tw:text-secondary" size="text-sm">
                  {t('label.show-help-text')}
                </Typography>
              </div>
            </SlideoutMenu.Header>

            <SlideoutMenu.Content>
              <div className="tw:flex tw:size-full tw:gap-6">
                <div
                  className={
                    showSidePanel ? 'tw:w-3/5 tw:overflow-y-auto' : 'tw:w-full'
                  }>
                  {formContent}
                </div>
                {showSidePanel && (
                  <div className="tw:w-2/5 tw:overflow-y-auto tw:border-l tw:border-secondary tw:pl-6">
                    <div className="service-doc-panel">
                      <ServiceDocPanel
                        activeField={activeField}
                        serviceName={CUSTOM_PROPERTY_CATEGORY}
                        serviceType={OPEN_METADATA as ServiceCategory}
                      />
                    </div>
                  </div>
                )}
              </div>
            </SlideoutMenu.Content>

            <SlideoutMenu.Footer>
              <div className="tw:flex tw:justify-end tw:gap-4">
                <CoreButton
                  color="tertiary"
                  data-testid="cancel-button"
                  isDisabled={isDrawerLoading}
                  onClick={close}>
                  {t('label.cancel')}
                </CoreButton>
                <CoreButton
                  color="primary"
                  data-testid="create-button"
                  isDisabled={isDrawerLoading || isFormInvalid}
                  isLoading={isDrawerLoading}
                  onClick={() => form.submit()}>
                  {t('label.create')}
                </CoreButton>
              </div>
            </SlideoutMenu.Footer>
          </>
        )}
      </SlideoutMenu>
    );
  }

  const firstPanelChildren = (
    <>
      <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
      {formContent}
    </>
  );

  const secondPanelChildren = (
    <ServiceDocPanel
      activeField={activeField}
      serviceName={CUSTOM_PROPERTY_CATEGORY}
      serviceType={OPEN_METADATA as ServiceCategory}
    />
  );

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.custom-property'),
      })}
      secondPanel={{
        children: secondPanelChildren,
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default AddCustomProperty;
