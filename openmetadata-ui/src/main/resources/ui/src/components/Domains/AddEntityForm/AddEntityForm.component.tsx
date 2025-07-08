/*
 *  Copyright 2025 Collate.
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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Col, Form, Input, Popover, Row, Select, Space } from 'antd';
import { omit } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CheckIcon } from '../../../assets/svg/check-colored.svg';
import { ReactComponent as LayersIcon } from '../../../assets/svg/ic-layers-white.svg';
import { COLOR_PALETTE } from '../../../constants/AddEntityForm.constants';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  CreateDataProduct,
  TagSource,
} from '../../../generated/api/domains/createDataProduct';
import {
  CreateDomain,
  DomainType,
} from '../../../generated/api/domains/createDomain';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/entity/type';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../interface/FormUtils.interface';
import { domainTypeTooltipDataRender } from '../../../utils/DomainUtils';
import { getField } from '../../../utils/formUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { DomainFormType } from '../../Domain/DomainPage.interface';
import { Panel } from '../../Panel/Panel.component';
import {
  AddEntityFormProps,
  CreateEntityType,
  FormValues,
} from './AddEntityForm.interface';
import './AddEntityForm.less';

function AddEntityForm<T extends CreateEntityType>({
  open,
  onClose,
  loading = false,
  config,
}: AddEntityFormProps<T>) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { permissions } = usePermissionProvider();
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [iconUrlInput, setIconUrlInput] = useState('');

  const {
    entityType,
    onSubmit,
    title,
    showDomainType = true,
    showDomainSelector = false,
    defaultValues,
    parentDomain,
    availableDomains = [],
  } = config;

  const domainTypeArray = Object.keys(DomainType).map((key) => ({
    key,
    value: DomainType[key as keyof typeof DomainType],
  }));

  const defaultColor = COLOR_PALETTE[0];

  // Set default values
  useEffect(() => {
    const initialValues: Partial<FormValues> = {
      color: defaultColor,
      ...defaultValues,
    };

    if (parentDomain) {
      initialValues.parent = parentDomain;
    }

    form.setFieldsValue(initialValues);
  }, [form, defaultColor, defaultValues, parentDomain]);

  const handleIconUrlSubmit = () => {
    if (iconUrlInput.trim()) {
      form.setFieldValue('iconURL', iconUrlInput.trim());
      setIconUrlInput('');
      setIsIconModalOpen(false);
    }
  };

  const handleIconModalCancel = () => {
    setIconUrlInput('');
    setIsIconModalOpen(false);
  };

  const handleIconClick = () => {
    setIsIconModalOpen(!isIconModalOpen);
  };

  const handleCoverImageUrlChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const url = e.target.value;
    setCoverImageUrl(url);
    form.setFieldValue('coverImageURL', url);
  };

  // Common form fields
  const nameField: FieldProp = {
    name: 'name',
    id: 'root/name',
    label: t('label.name'),
    required: true,
    placeholder: t('label.name'),
    type: FieldTypes.TEXT,
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
    type: FieldTypes.TEXT,
    props: {
      'data-testid': 'display-name',
    },
  };

  const descriptionField: FieldProp = {
    name: 'description',
    required: true,
    label: t('label.description'),
    id: 'root/description',
    type: FieldTypes.DESCRIPTION,
    props: {
      'data-testid': 'description',
      initialValue: '',
    },
  };

  const tagsField: FieldProp = {
    name: 'tags',
    required: false,
    label: t('label.tag-plural'),
    id: 'root/tags',
    type: FieldTypes.TAG_SUGGESTION,
    props: {
      selectProps: {
        'data-testid': 'tags-container',
      },
    },
  };

  const glossaryTermsField: FieldProp = {
    name: 'glossaryTerms',
    required: false,
    label: t('label.glossary-term-plural'),
    id: 'root/glossaryTerms',
    type: FieldTypes.TAG_SUGGESTION,
    props: {
      selectProps: {
        'data-testid': 'glossary-terms-container',
      },
      open: false,
      hasNoActionButtons: true,
      isTreeSelect: true,
      tagType: TagSource.Glossary,
      placeholder: t('label.select-field', {
        field: t('label.glossary-term-plural'),
      }),
    },
  };

  const domainTypeField: FieldProp = {
    name: 'domainType',
    required: true,
    label: t('label.domain-type'),
    id: 'root/domainType',
    type: FieldTypes.SELECT,
    helperText: domainTypeTooltipDataRender(),
    props: {
      'data-testid': 'domainType',
      options: domainTypeArray,
      overlayClassName: 'domain-type-tooltip-container',
      tooltipPlacement: 'topLeft',
      tooltipAlign: { targetOffset: [18, 0] },
    },
  };

  const ownerField: FieldProp = {
    name: 'owners',
    id: 'root/owner',
    required: false,
    label: t('label.owner-plural'),
    type: FieldTypes.USER_TEAM_SELECT,
    props: {
      hasPermission: true,
      children: (
        <Button
          data-testid="add-owner"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
      multiple: { user: true, team: false },
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'owners',
      trigger: 'onUpdate',
    },
  };

  const expertsField: FieldProp = {
    name: 'experts',
    id: 'root/experts',
    required: false,
    label: t('label.expert-plural'),
    type: FieldTypes.USER_MULTI_SELECT,
    props: {
      hasPermission: true,
      popoverProps: { placement: 'topLeft' },
      children: (
        <Button
          data-testid="add-experts"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'selectedUsers',
      trigger: 'onUpdate',
      initialValue: [],
    },
  };

  const createPermission = useMemo(
    () => checkPermission(Operation.Create, ResourceEntity.DOMAIN, permissions),
    [permissions]
  );

  const selectedOwners =
    Form.useWatch<EntityReference | EntityReference[]>('owners', form) ?? [];
  const ownersList = Array.isArray(selectedOwners)
    ? selectedOwners
    : [selectedOwners];

  const expertsList = Form.useWatch<EntityReference[]>('experts', form) ?? [];
  const selectedColor = Form.useWatch<string>('color', form);

  // Get entity-specific title
  const getEntityTitle = () => {
    if (title) {
      return title;
    }

    switch (entityType) {
      case DomainFormType.DOMAIN:
        return t('label.add-new-entity', { entity: t('label.domain') });
      case DomainFormType.SUBDOMAIN:
        return t('label.add-new-entity', { entity: t('label.sub-domain') });
      case DomainFormType.DATA_PRODUCT:
        return t('label.add-new-entity', { entity: t('label.data-product') });
      default:
        return t('label.add-new-entity', { entity: t('label.entity') });
    }
  };

  const handleFormSubmit = async (formData: FormValues): Promise<void> => {
    const updatedData = omit(
      formData,
      'color',
      'iconURL',
      'glossaryTerms',
      'coverImageURL'
    );

    const style = {
      color: formData.color,
      iconURL: formData.iconURL || '',
    };

    // Store cover image and other extension data
    // Note: coverImageURL is stored in extension field until API schema supports it directly
    const extension = {
      ...(formData.extension || {}),
      ...(formData.coverImageURL && { coverImageURL: formData.coverImageURL }),
    };

    const expertsArray = Array.isArray(expertsList) ? expertsList : [];

    // Type-specific processing
    if (entityType === DomainFormType.DATA_PRODUCT) {
      // For data products, ensure domain is set and required
      const domain = formData.domain || parentDomain;
      if (!domain) {
        throw new Error('Domain is required for data products');
      }

      const dataProductData: CreateDataProduct = {
        ...updatedData,
        style,
        domain,
        experts: expertsArray.map((item) => item.name ?? ''),
        owners: ownersList ?? [],
        tags: [
          ...(Array.isArray(formData.tags) ? formData.tags : []),
          ...(Array.isArray(formData.glossaryTerms)
            ? formData.glossaryTerms
            : []),
        ],
        ...(Object.keys(extension).length > 0 && { extension }),
      };

      await onSubmit(dataProductData as T);
    } else {
      // For domains and subdomains
      const domainData: CreateDomain = {
        ...updatedData,
        style,
        domainType: (formData.domainType as DomainType) || DomainType.Aggregate,
        experts: expertsArray.map((item) => item.name ?? ''),
        owners: ownersList ?? [],
        tags: [
          ...(Array.isArray(formData.tags) ? formData.tags : []),
          ...(Array.isArray(formData.glossaryTerms)
            ? formData.glossaryTerms
            : []),
        ],
        ...(parentDomain && { parent: parentDomain }),
        ...(Object.keys(extension).length > 0 && { extension }),
      };

      await onSubmit(domainData as T);
    }
  };

  const iconPopoverContent = (
    <div>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontWeight: 500 }}>
          {t('label.enter-entity', { entity: t('label.url-uppercase') })}
        </label>
      </div>
      <Input
        placeholder="Enter icon URL"
        value={iconUrlInput}
        onChange={(e) => setIconUrlInput(e.target.value)}
        onPressEnter={handleIconUrlSubmit}
      />
      <div
        className="url-input-actions"
        style={{
          marginTop: '12px',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}>
        <Button onClick={handleIconModalCancel}>{t('label.cancel')}</Button>
        <Button
          disabled={!iconUrlInput.trim()}
          type="primary"
          onClick={handleIconUrlSubmit}>
          {t('label.add')}
        </Button>
      </div>
    </div>
  );

  return (
    <Panel
      cancelLabel={t('label.cancel')}
      open={open}
      placement="right"
      saveDisabled={!createPermission}
      saveLabel={t('label.save')}
      saveLoading={loading}
      size={670}
      title={getEntityTitle()}
      onClose={onClose}
      onSave={() => form.submit()}>
      <Form
        className="add-entity-form-v2"
        form={form}
        layout="vertical"
        onFinish={handleFormSubmit}>
        {/* Cover Image URL Section */}
        <div className="cover-section">
          <Form.Item label={t('label.cover')} name="coverImageURL">
            <Input value={coverImageUrl} onChange={handleCoverImageUrlChange} />
          </Form.Item>
        </div>

        {/* Icon and Theme Section */}
        <div className="icon-theme-section">
          <Row gutter={12}>
            <Col span={3}>
              <Form.Item
                label={t('label.icon')}
                tooltip={t('message.icon-tooltip')}>
                <div className="icon-selector">
                  <Popover
                    content={iconPopoverContent}
                    open={isIconModalOpen}
                    placement="bottomLeft"
                    trigger="click"
                    onOpenChange={setIsIconModalOpen}>
                    <div
                      className="selected-icon clickable"
                      style={{ backgroundColor: selectedColor || defaultColor }}
                      onClick={handleIconClick}>
                      <LayersIcon
                        className="domain-icon"
                        data-testid="domain-icon"
                      />
                    </div>
                  </Popover>
                </div>
              </Form.Item>
            </Col>
            <Col span={21}>
              <Form.Item label={t('label.theme')}>
                <div className="color-palette">
                  {COLOR_PALETTE.map((color) => (
                    <div
                      className={`color-option ${
                        selectedColor === color ? 'selected' : ''
                      }`}
                      key={color}
                      style={{ backgroundColor: color }}
                      onClick={() => form.setFieldValue('color', color)}>
                      {selectedColor === color && (
                        <CheckIcon
                          className="check-icon"
                          style={{ color: 'white' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Name and Display Name Row */}
        <Row gutter={16}>
          <Col span={12}>{getField(nameField)}</Col>
          <Col span={12}>{getField(displayNameField)}</Col>
        </Row>

        {/* Description */}
        {getField(descriptionField)}

        {/* Tags */}
        {getField(tagsField)}

        {/* Glossary Terms */}
        {getField(glossaryTermsField)}

        {/* Domain Selector - only for data products */}
        {showDomainSelector && (
          <Form.Item
            label={t('label.domain')}
            name="domain"
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.domain'),
                }),
              },
            ]}>
            <Select
              data-testid="domain-selector"
              options={availableDomains}
              placeholder={t('label.select-field', {
                field: t('label.domain'),
              })}
            />
          </Form.Item>
        )}

        {/* Domain Type - only for domains and subdomains */}
        {showDomainType && getField(domainTypeField)}

        {/* Owner */}
        <div className="owner-section">
          {getField(ownerField)}
          {Boolean(ownersList.length) && (
            <Space wrap data-testid="owner-container" size={[8, 8]}>
              <OwnerLabel owners={ownersList} />
            </Space>
          )}
        </div>

        {/* Experts */}
        <div className="experts-section">
          {getField(expertsField)}
          {Boolean(expertsList.length) && (
            <Space
              wrap
              className="experts-list"
              data-testid="experts-container"
              size={[8, 8]}>
              <OwnerLabel owners={expertsList} />
            </Space>
          )}
        </div>

        {/* Hidden color field for form data */}
        <Form.Item hidden initialValue={defaultColor} name="color">
          <input type="hidden" />
        </Form.Item>
      </Form>
    </Panel>
  );
}

export default AddEntityForm;
