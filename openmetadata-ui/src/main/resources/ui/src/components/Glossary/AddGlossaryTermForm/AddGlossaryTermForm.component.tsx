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
import { PlusOutlined } from '@ant-design/icons';
import { Owner } from '@openmetadata/ui-core-components';
import { Button, Col, Form, FormProps, Input, Row, Space } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { isEmpty, isString } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { HEX_COLOR_CODE_REGEX } from '../../../constants/regex.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
    CustomProperty,
    EntityReference
} from '../../../generated/entity/type';
import {
    FieldKind,
    IntakeForm,
    IntakeFormField,
    TargetEntityType
} from '../../../generated/governance/intakeForm';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useEntityRules } from '../../../hooks/useEntityRules';
import {
    FieldProp,
    FieldTypes,
    FormItemLayout,
    HelperTextType
} from '../../../interface/FormUtils.interface';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import { generateFormFields, getField } from '../../../utils/formUtils';
import { referenceURLValidator } from '../../../utils/GlossaryPureUtils';
import { getIntakeFormFields } from '../../../utils/IntakeFormUtils';
import { toOwnerRefs } from '../../../utils/Owner/ownerConversionUtils';
import { fetchGlossaryList } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AddGlossaryTermFormProps } from './AddGlossaryTermForm.interface';
import GlossaryTermIntakeFields, {
    GlossaryTermIntakeFieldsHandle
} from './GlossaryTermIntakeFields.component';

const ARRAY_VALUED_NATIVE_FIELDS = new Set(['tags', 'synonyms']);

const AddGlossaryTermForm = ({
  editMode,
  onSave,
  glossaryTerm,
  formRef: form,
}: AddGlossaryTermFormProps) => {
  const { currentUser } = useApplicationStore();
  const { entityRules } = useEntityRules(EntityType.GLOSSARY_TERM);
  const selectedOwners =
    Form.useWatch<EntityReference | EntityReference[]>('owners', form) ?? [];
  const { t } = useTranslation();
  const [intakeForm, setIntakeForm] = useState<IntakeForm | null>(null);
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );
  const [customPropertiesLoaded, setCustomPropertiesLoaded] = useState(false);
  const intakeFieldsRef = useRef<GlossaryTermIntakeFieldsHandle>(null);

  useEffect(() => {
    let cancelled = false;

    if (editMode) {
      setIntakeForm(null);

      return;
    }

    getIntakeFormByEntityType(TargetEntityType.GlossaryTerm)
      .then((result) => {
        if (!cancelled) {
          setIntakeForm(result);
        }
      })
      .catch((error: AxiosError) => {
        if (!cancelled) {
          setIntakeForm(null);
          showErrorToast(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editMode]);

  useEffect(() => {
    let cancelled = false;

    if (editMode) {
      setCustomProperties([]);
      setCustomPropertiesLoaded(true);

      return;
    }
    setCustomPropertiesLoaded(false);

    getCustomPropertiesByEntityType(TargetEntityType.GlossaryTerm)
      .then((properties) => {
        if (!cancelled) {
          setCustomProperties(properties ?? []);
          setCustomPropertiesLoaded(true);
        }
      })
      .catch((error: AxiosError) => {
        if (!cancelled) {
          setCustomProperties([]);
          setCustomPropertiesLoaded(true);
          showErrorToast(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editMode]);

  const nativeRequiredFieldsByPath = useMemo(() => {
    const fields = new Map<string, IntakeFormField>();

    getIntakeFormFields(intakeForm).forEach((field) => {
      const isCustomProperty =
        field.fieldKind === FieldKind.CustomProperty ||
        field.fieldPath.startsWith('extension.');

      if (field.required && !isCustomProperty) {
        fields.set(field.fieldPath, field);
      }
    });

    return fields;
  }, [intakeForm]);

  const extensionFormFields = useMemo(
    () =>
      getIntakeFormFields(intakeForm).filter(
        (field) =>
          field.fieldKind === FieldKind.CustomProperty ||
          field.fieldPath.startsWith('extension.')
      ),
    [intakeForm]
  );

  const applyIntakeFormRequired = useCallback(
    (field: FieldProp): FieldProp => {
      const requiredField = nativeRequiredFieldsByPath.get(
        field.name.toString()
      );

      if (!requiredField) {
        return field;
      }

      const isArrayValuedField = ARRAY_VALUED_NATIVE_FIELDS.has(
        field.name.toString()
      );

      return {
        ...field,
        required: true,
        rules: [
          ...(field.rules ?? []),
          {
            required: true,
            ...(isArrayValuedField ? { type: 'array' as const } : {}),
            message:
              requiredField.errorMessage ||
              t('label.field-required', {
                field: requiredField.fieldLabel,
              }),
          },
        ],
      };
    },
    [nativeRequiredFieldsByPath, t]
  );

  const ownersList = Array.isArray(selectedOwners)
    ? selectedOwners
    : [selectedOwners];

  const reviewersData =
    Form.useWatch<EntityReference | EntityReference[]>('reviewers', form) ?? [];

  const reviewersList = Array.isArray(reviewersData)
    ? reviewersData
    : [reviewersData];

  const isMutuallyExclusive = Form.useWatch<boolean | undefined>(
    'mutuallyExclusive',
    form
  );

  const getRelatedTermFqnList = (relatedTerms: DefaultOptionType[]): string[] =>
    relatedTerms.map((tag: DefaultOptionType) => tag.value as string);

  const handleSave: FormProps['onFinish'] = async (formObj) => {
    const {
      name,
      displayName = '',
      description = '',
      synonyms = [],
      tags = [],
      mutuallyExclusive = false,
      references = [],
      relatedTerms = [],
      color,
      iconURL,
    } = formObj;

    // The intake custom properties live in their own RHF form outside this antd
    // Form, so antd's own validation pass cannot see them — validate explicitly
    // and abort so RHF renders the inline errors.
    if (!editMode && !(await (intakeFieldsRef.current?.validate() ?? true))) {
      return;
    }

    const selectedOwners =
      ownersList.length > 0
        ? ownersList
        : [
            {
              id: currentUser?.id ?? '',
              type: 'user',
            },
          ];

    const style = {
      color,
      iconURL,
    };

    const extension = editMode
      ? {}
      : intakeFieldsRef.current?.getExtension() ?? {};

    const data = {
      name: name.trim(),
      displayName: displayName?.trim(),
      description: description,
      reviewers: reviewersList,
      relatedTerms: editMode
        ? relatedTerms.map((term: DefaultOptionType) => {
            if (isString(term)) {
              return glossaryTerm?.relatedTerms?.find(
                (r) => r.fullyQualifiedName === term
              )?.id;
            }
            if (term.data) {
              return term.data.id;
            }

            return glossaryTerm?.relatedTerms?.find(
              (r) => r.fullyQualifiedName === term.value
            )?.id;
          })
        : getRelatedTermFqnList(relatedTerms),
      references: references.length > 0 ? references : undefined,
      synonyms: synonyms,
      mutuallyExclusive,
      tags: tags,
      owners: selectedOwners,
      style: isEmpty(style) ? undefined : style,
      ...(!editMode && !isEmpty(extension) ? { extension } : {}),
    };

    await onSave(data);
  };

  useEffect(() => {
    if (glossaryTerm?.reviewers && glossaryTerm.reviewers.length > 0) {
      form.setFieldValue('reviewers', glossaryTerm?.reviewers);
    }
    if (editMode && glossaryTerm) {
      const {
        name,
        displayName,
        description,
        synonyms,
        tags,
        references,
        mutuallyExclusive,
        reviewers,
        owners,
        relatedTerms,
        style,
      } = glossaryTerm;

      form.setFieldsValue({
        name,
        displayName,
        description,
        synonyms,
        tags,
        references,
        mutuallyExclusive,
        relatedTerms: relatedTerms?.map((r) => r.fullyQualifiedName ?? ''),
      });

      if (reviewers) {
        form.setFieldValue('reviewers', reviewers);
      }
      if (style?.color) {
        form.setFieldValue('style.color', style.color);
      }
      if (style?.iconURL) {
        form.setFieldValue('style.iconURL', style.iconURL);
      }

      if (owners) {
        form.setFieldValue('owners', owners);
      }
    }
  }, [editMode, glossaryTerm, glossaryTerm?.reviewers, form]);

  const formFields: FieldProp[] = [
    {
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
    },
    {
      name: 'displayName',
      id: 'root/displayName',
      label: t('label.display-name'),
      required: false,
      placeholder: t('label.display-name'),
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'display-name',
      },
    },
    {
      name: 'description',
      required: true,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: glossaryTerm?.description,
        height: 'auto',
      },
      rules: [
        {
          required: true,
          whitespace: true,
          message: t('label.field-required', {
            field: t('label.description'),
          }),
        },
      ],
    },
    {
      name: 'tags',
      required: false,
      label: t('label.tag-plural'),
      id: 'root/tags',
      type: FieldTypes.TAG_SUGGESTION,
      props: {
        'data-testid': 'tags-container',
        initialOptions: glossaryTerm?.tags?.map((data) => ({
          label: data.tagFQN,
          value: data.tagFQN,
          data,
        })),
      },
    },
    {
      name: 'synonyms',
      required: false,
      label: t('label.synonym-plural'),
      id: 'root/synonyms',
      type: FieldTypes.SELECT,
      props: {
        className: 'glossary-select',
        'data-testid': 'synonyms',
        mode: 'tags',
        placeholder: t('message.synonym-placeholder'),
        open: false,
      },
    },
    {
      name: 'relatedTerms',
      required: false,
      label: t('label.related-term-plural'),
      id: 'root/relatedTerms',
      type: FieldTypes.TREE_ASYNC_SELECT_LIST,
      props: {
        className: 'glossary-select',
        'data-testid': 'related-terms',
        mode: 'multiple',
        placeholder: t('label.add-entity', {
          entity: t('label.related-term-plural'),
        }),
        open: false,
        hasNoActionButtons: true,
        fetchOptions: fetchGlossaryList,
        initialOptions: glossaryTerm?.relatedTerms?.map((data) => ({
          label: data.fullyQualifiedName,
          value: data.fullyQualifiedName,
          data,
        })),
        filterOptions: [glossaryTerm?.fullyQualifiedName ?? ''],
      },
    },
    {
      name: 'iconURL',
      id: 'root/iconURL',
      label: t('label.icon-url'),
      required: false,
      placeholder: t('label.icon-url'),
      type: FieldTypes.TEXT,
      helperText: t('message.govern-url-size-message'),
      props: {
        'data-testid': 'icon-url',
        tooltipPlacement: 'right',
      },
    },
    {
      name: 'color',
      id: 'root/color',
      label: t('label.color'),
      required: false,
      type: FieldTypes.COLOR_PICKER,
      rules: [
        {
          pattern: HEX_COLOR_CODE_REGEX,
          message: t('message.hex-color-validation'),
        },
      ],
    },
    {
      name: 'mutuallyExclusive',
      label: t('label.mutually-exclusive'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        'data-testid': 'mutually-exclusive-button',
      },
      id: 'root/mutuallyExclusive',
      formItemLayout: FormItemLayout.HORIZONTAL,
      helperText: t('message.mutually-exclusive-alert', {
        entity: t('label.glossary-term'),
        'child-entity': t('label.glossary-term'),
      }),
      helperTextType: HelperTextType.ALERT,
      showHelperText: Boolean(isMutuallyExclusive),
    },
  ];
  const intakeAwareFormFields = formFields.map(applyIntakeFormRequired);

  const ownerField: FieldProp = {
    name: 'owners',
    id: 'root/owner',
    required: false,
    label: t('label.owner-plural'),
    type: FieldTypes.USER_TEAM_SELECT,
    props: {
      owner: ownersList,
      hasPermission: true,
      children: (
        <Button
          data-testid="add-owner"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
      multiple: {
        user: entityRules.canAddMultipleUserOwners,
        team: entityRules.canAddMultipleTeamOwner,
      },
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'owners',
      trigger: 'onUpdate',
    },
  };

  const reviewersField: FieldProp = applyIntakeFormRequired({
    name: 'reviewers',
    id: 'root/reviewers',
    required: false,
    label: t('label.reviewer-plural'),
    type: FieldTypes.USER_TEAM_SELECT,
    props: {
      owner: reviewersList,
      hasPermission: true,
      filterCurrentUser: true,
      popoverProps: { placement: 'topLeft' },
      multiple: { user: true, team: false },
      previewSelected: true,
      label: t('label.reviewer-plural'),
      children: (
        <Button
          data-testid="add-reviewers"
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
    },
  });

  return (
    <>
      <Form
        form={form}
        initialValues={{
          description: editMode && glossaryTerm ? glossaryTerm.description : '',
        }}
        layout="vertical"
        onFinish={handleSave}>
        {generateFormFields(intakeAwareFormFields)}

        <Form.List name="references">
          {(fields, { add, remove }) => (
            <>
              <Form.Item
                className="form-item-horizontal"
                colon={false}
                label={t('label.reference-plural')}>
                <Button
                  data-testid="add-reference"
                  icon={
                    <PlusOutlined
                      style={{ color: 'white', fontSize: '12px' }}
                    />
                  }
                  size="small"
                  type="primary"
                  onClick={() => {
                    add();
                  }}
                />
              </Form.Item>

              {fields.map((field, index) => (
                <Row gutter={[8, 0]} key={field.key}>
                  <Col span={11}>
                    <Form.Item
                      name={[field.name, 'name']}
                      rules={[
                        {
                          required: true,
                          message: `${t('message.field-text-is-required', {
                            fieldText: t('label.name'),
                          })}`,
                        },
                      ]}>
                      <Input
                        id={`name-${index}`}
                        placeholder={t('label.name')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={11}>
                    <Form.Item
                      name={[field.name, 'endpoint']}
                      rules={[
                        {
                          required: true,
                          message: t('message.valid-url-endpoint'),
                          type: 'url',
                        },
                        {
                          validator: referenceURLValidator,
                        },
                      ]}>
                      <Input
                        id={`url-${index}`}
                        placeholder={t('label.endpoint')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={2}>
                    <Button
                      icon={<DeleteIcon width={16} />}
                      size="small"
                      type="text"
                      onClick={() => {
                        remove(field.name);
                      }}
                    />
                  </Col>
                </Row>
              ))}
            </>
          )}
        </Form.List>

        <div className="m-t-xss">
          {getField(ownerField)}

          {Boolean(ownersList.length) && (
            <Space wrap data-testid="owner-container" size={[8, 8]}>
              <Owner owners={toOwnerRefs(ownersList)} />
            </Space>
          )}
        </div>
        <div className="m-t-xss">
          {getField(reviewersField)}
          {Boolean(reviewersList.length) && (
            <Space wrap data-testid="reviewers-container" size={[8, 8]}>
              <Owner owners={toOwnerRefs(reviewersList)} />
            </Space>
          )}
        </div>
      </Form>

      {/* Rendered as a sibling of the antd Form, not inside it: this emits its
          own <form> element and nesting forms is invalid HTML. The modal's Save
          button sits in the footer outside both forms, so it still drives
          submission via the antd instance. */}
      {!editMode &&
        customPropertiesLoaded &&
        extensionFormFields.length > 0 && (
          <GlossaryTermIntakeFields
            customProperties={customProperties}
            formFields={extensionFormFields}
            ref={intakeFieldsRef}
          />
        )}
    </>
  );
};

export default AddGlossaryTermForm;
