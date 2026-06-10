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
import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { Form } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEqual, isNil, isUndefined } from 'lodash';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DataAssetAsyncSelectList from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { KNOWLEDGE_CENTER_CLASSIFICATION } from '../../../constants/constants';
import { getKnowledgePageFields } from '../../../constants/KnowledgeCenter.constant';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityReference } from '../../../generated/entity/type';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import {
  CreateKnowledgePage,
  KnowledgePage,
  QuickLink,
} from '../../../interface/knowledge-center.interface';
import {
  getKnowledgePageByFqn,
  patchKnowledgePage,
} from '../../../rest/knowledgeCenterAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  generateFormFields,
  getPopupContainer,
} from '../../../utils/formUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import { getTagsWithoutTier } from '../../../utils/TablePureUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

export interface QuickLinkFormModalFormData
  extends Pick<CreateKnowledgePage, 'description' | 'displayName'> {
  url: string;
  tags?: TagLabel[];
  glossaryTerms?: TagLabel[];
  relatedEntities?: EntityReference[];
}

export interface QuickLinkFormModalProps {
  isOpen: boolean;
  quickLink?: KnowledgePage;
  permissions: OperationPermission;
  onSave: (data: QuickLinkFormModalFormData) => void;
  onCancel: () => void;
}

export const QuickLinkFormModal: FC<QuickLinkFormModalProps> = ({
  isOpen,
  quickLink,
  permissions,
  onCancel,
  onSave,
}) => {
  const [form] = Form.useForm();
  const { t } = useTranslation('translation', { i18n });

  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      tagClassBase.setFilterClassification([]);
    } else {
      tagClassBase.setFilterClassification([KNOWLEDGE_CENTER_CLASSIFICATION]);
    }

    return () => {
      tagClassBase.setFilterClassification([KNOWLEDGE_CENTER_CLASSIFICATION]);
    };
  }, [isOpen]);

  const { initialValues, initialDataAssetsOptions, restRelatedDataAssets } =
    useMemo(() => {
      if (isUndefined(quickLink)) {
        return {
          initialValues: {},
          initialDataAssetsOptions: [],
          restRelatedDataAssets: [],
        };
      }

      const tagsWithoutTier = getTagsWithoutTier(quickLink.tags ?? []);
      const { Classification: classification, Glossary: glossaries } =
        getFilterTags(tagsWithoutTier);

      const relatedDataAssets = quickLink.relatedEntities ?? [];
      const { filteredRelatedDataAssets, restRelatedDataAssets } =
        relatedDataAssets.reduce(
          (acc, item) => {
            if (!['team', 'user'].includes(item.type)) {
              acc.filteredRelatedDataAssets.push(item);
            } else {
              acc.restRelatedDataAssets.push(item);
            }

            return acc;
          },
          {
            filteredRelatedDataAssets: [] as EntityReference[],
            restRelatedDataAssets: [] as EntityReference[],
          }
        );

      const initialDataAssetsOptions: DataAssetOption[] =
        filteredRelatedDataAssets.map((item) => ({
          displayName: getEntityName(item),
          reference: item,
          label: getEntityName(item),
          value: item.id,
        }));

      return {
        initialValues: {
          displayName: quickLink.displayName,
          url: (quickLink.page as QuickLink)?.url,
          description: quickLink.description,
          tags: classification,
          glossaryTerms: glossaries,
          relatedEntities: filteredRelatedDataAssets.map((item) => item.id),
        },
        initialDataAssetsOptions,
        restRelatedDataAssets,
      };
    }, [quickLink]);

  const handleQuickLinkUpdate = async (
    knowledgePage: KnowledgePage,
    formData: QuickLinkFormModalFormData
  ) => {
    const currentKnowledgePage = cloneDeep(knowledgePage);
    const tags = [...(formData.tags ?? []), ...(formData.glossaryTerms ?? [])];
    let existingTags = currentKnowledgePage.tags ?? [];

    const newTags = tags.filter(
      (tag) => !existingTags.find((t) => t.tagFQN === tag.tagFQN)
    );
    existingTags = existingTags.filter((tag) =>
      tags.find((t) => t.tagFQN === tag.tagFQN)
    );

    const updatedKnowledgePage: KnowledgePage = {
      ...currentKnowledgePage,
      displayName: formData.displayName,
      description: formData.description,
      tags: [...existingTags, ...newTags],
      page: { ...currentKnowledgePage.page, url: formData.url },
      relatedEntities: formData?.relatedEntities,
    };

    if (isEqual(currentKnowledgePage, updatedKnowledgePage)) {
      onCancel();

      return;
    }

    try {
      setIsUpdating(true);
      const patch = compare(currentKnowledgePage, updatedKnowledgePage);
      await patchKnowledgePage(currentKnowledgePage.id, patch);
      const response = await getKnowledgePageByFqn(
        currentKnowledgePage.fullyQualifiedName,
        { fields: getKnowledgePageFields() }
      );

      showSuccessToast(
        t('message.entity-saved-successfully', {
          entity: t('label.quick-link'),
        })
      );
      onSave({
        displayName: response.displayName,
        description: response.description,
        tags: response.tags,
        url: (response.page as QuickLink)?.url,
        relatedEntities: response?.relatedEntities,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const handleFormFinish = (
    values: Omit<QuickLinkFormModalFormData, 'relatedEntities'> & {
      relatedEntities?: DataAssetOption[];
    }
  ) => {
    const relatedEntitiesData = values['relatedEntities']?.filter(
      (entity) => !isNil(entity)
    );

    const mappedRelatedDataAssets = relatedEntitiesData?.reduce((acc, item) => {
      let reference;
      if (typeof item === 'string') {
        const foundOption = initialDataAssetsOptions.find(
          (option) => option.reference.id === item
        );
        reference = foundOption?.reference;
      } else {
        reference = item.reference;
      }
      if (!isNil(reference)) {
        acc.push(reference);
      }

      return acc;
    }, [] as EntityReference[]);

    const relatedEntities = [
      ...restRelatedDataAssets,
      ...(mappedRelatedDataAssets ?? []),
    ];

    const updatedValues: QuickLinkFormModalFormData = {
      ...values,
      relatedEntities,
    };

    if (!isUndefined(quickLink)) {
      handleQuickLinkUpdate(quickLink, updatedValues);
    } else {
      onSave(updatedValues);
    }
  };

  const formFields: FieldProp[] = [
    {
      name: 'displayName',
      required: false,
      label: t('label.display-name'),
      id: 'root/displayName',
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'displayName',
        disabled: !(permissions.EditAll || permissions.EditDisplayName),
      },
      placeholder: t('label.display-name'),
    },
    {
      name: 'url',
      required: true,
      label: t('label.url-uppercase'),
      id: 'root/url',
      type: FieldTypes.TEXT,
      rules: [
        {
          required: true,
          message: t('label.field-required', {
            field: t('label.url-uppercase'),
          }),
        },
      ],
      props: {
        'data-testid': 'url',
        disabled: !permissions.EditAll,
        type: 'url',
      },
      placeholder: t('label.url-uppercase'),
    },
    {
      name: 'description',
      required: false,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: quickLink?.description ?? '',
        readonly: !(permissions.EditAll || permissions.EditDescription),
      },
    },
    {
      name: 'tags',
      required: false,
      label: t('label.tag-plural'),
      id: 'tags',
      type: FieldTypes.TAG_SUGGESTION,
      props: {
        'data-testid': 'tags-container',
        selectProps: {
          getPopupContainer,
          id: 'root/tags',
          disabled: !(permissions.EditAll || permissions.EditTags),
        },
        newLook: true,
      },
    },
    {
      name: 'glossaryTerms',
      required: false,
      label: t('label.glossary-term-plural'),
      id: 'glossaryTerms',
      type: FieldTypes.TAG_SUGGESTION,
      props: {
        'data-testid': 'glossaryTerms-container',
        selectProps: {
          getPopupContainer,
          id: 'root/glossaryTerms',
          disabled: !(permissions.EditAll || permissions.EditTags),
        },
        open: false,
        hasNoActionButtons: true,
        newLook: true,
        isTreeSelect: true,
        tagType: TagSource.Glossary,
        placeholder: t('label.select-field', {
          field: t('label.glossary-term-plural'),
        }),
      },
    },
  ];

  const title = isUndefined(quickLink)
    ? t('label.add-entity', { entity: t('label.quick-link') })
    : `${t('label.edit-entity', { entity: t('label.quick-link') })} ${
        getEntityName(quickLink) || t('label.untitled')
      }`;

  return (
    <ModalOverlay
      isDismissable
      isOpen={isOpen}
      style={{ zIndex: 999 }}
      onOpenChange={(open) => !open && handleCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          className="quick-link-form-modal"
          width={600}
          onClose={handleCancel}>
          <Dialog.Header title={title} />
          <Dialog.Content className="tw:max-h-[60vh] tw:overflow-y-auto tw:overflow-x-visible">
            <Form
              className="new-form-style"
              data-testid="quick-link-form"
              form={form}
              id="quick-link-form"
              initialValues={initialValues}
              layout="vertical"
              onFinish={handleFormFinish}>
              {generateFormFields(formFields)}

              <Form.Item
                label={t('label.data-asset-plural')}
                name="relatedEntities">
                <DataAssetAsyncSelectList
                  getPopupContainer={getPopupContainer}
                  initialOptions={initialDataAssetsOptions}
                  mode="multiple"
                  placeholder={t('label.data-asset-plural')}
                />
              </Form.Item>
            </Form>
          </Dialog.Content>

          <Dialog.Footer className="quick-link-modal-footer">
            <Button color="secondary" onClick={handleCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              isLoading={isUpdating}
              onClick={() => form.submit()}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
