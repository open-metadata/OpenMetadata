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
import { Form, FormProps, Modal } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEqual, isNil, isUndefined } from 'lodash';

import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DataAssetAsyncSelectList from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
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
import { getEntityName } from '../../../utils/EntityUtils';
import { generateFormFields } from '../../../utils/formUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import { getTagsWithoutTier } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

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

  const { classification, glossaries, initialValues } = useMemo(() => {
    if (isUndefined(quickLink)) {
      return { initialValues: {}, classification: [], glossaries: [] };
    }

    const tagsWithoutTier = getTagsWithoutTier(quickLink.tags ?? []);

    const { Classification: classification, Glossary: glossaries } =
      getFilterTags(tagsWithoutTier);

    return {
      initialValues: {
        displayName: quickLink?.displayName,
        url: (quickLink.page as QuickLink)?.url,
        description: quickLink?.description,
        tags: classification,
        glossaryTerms: glossaries,
      },
      classification,
      glossaries,
    };
  }, [quickLink]);

  const {
    defaultDataAssetsValues,
    initialDataAssetsOptions,
    restRelatedDataAssets,
  } = useMemo(() => {
    if (isUndefined(quickLink)) {
      return {
        initialDataAssetsOptions: [],
        defaultDataAssetsValues: [],
        filteredRelatedDataAssets: [],
        restRelatedDataAssets: [],
      };
    }

    const relatedDataAssets = quickLink.relatedEntities ?? [];

    const { filteredRelatedDataAssets, restRelatedDataAssets } =
      relatedDataAssets.reduce(
        (acc, item) => {
          // filter out team and user as they are not data assets
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
      filteredRelatedDataAssets.map((item) => {
        return {
          displayName: getEntityName(item),
          reference: item,
          label: getEntityName(item),
          value: item.id,
        };
      });

    const defaultDataAssetsValues = filteredRelatedDataAssets.map(
      (item) => item.id
    );

    return {
      initialDataAssetsOptions,
      defaultDataAssetsValues,
      filteredRelatedDataAssets,
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

    // derive the new tags
    const newTags = tags.filter(
      (tag) => !existingTags.find((t) => t.tagFQN === tag.tagFQN)
    );

    // update the existing tags with the new tags
    existingTags = existingTags.filter((tag) =>
      tags.find((t) => t.tagFQN === tag.tagFQN)
    );

    const updatedKnowledgePage: KnowledgePage = {
      ...currentKnowledgePage,
      displayName: formData.displayName,
      description: formData.description,
      tags: [...existingTags, ...newTags],
      page: {
        ...currentKnowledgePage.page,
        url: formData.url,
      },
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
        {
          fields: getKnowledgePageFields(),
        }
      );

      const updatedData = {
        displayName: response.displayName,
        description: response.description,
        tags: response.tags,
        url: (response.page as QuickLink)?.url,
        relatedEntities: response?.relatedEntities,
      };
      onSave(updatedData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmit: FormProps<
    Omit<QuickLinkFormModalFormData, 'relatedEntities'> & {
      relatedEntities?: DataAssetOption[];
    }
  >['onFinish'] = (values) => {
    // filter out empty values
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

    const updatedValues = { ...values, relatedEntities };

    if (!isUndefined(quickLink)) {
      handleQuickLinkUpdate(quickLink, updatedValues);
    } else {
      onSave(updatedValues);
    }
  };

  const formFields: FieldProp[] = [
    {
      name: 'displayName',
      id: 'root/displayName',
      required: false,
      label: t('label.display-name'),
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'displayName',
        disabled: !(permissions.EditAll || permissions.EditDisplayName),
      },
      placeholder: t('label.display-name'),
    },
    {
      name: 'url',
      id: 'root/url',
      required: true,
      label: t('label.url-uppercase'),
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'url',
        type: 'url',
        disabled: !permissions.EditAll,
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
        initialValue: '',
        readonly: !(permissions.EditAll || permissions.EditDescription),
      },
    },
    {
      name: 'tags',
      required: false,
      label: t('label.tag-plural'),
      id: 'root/tags',
      type: FieldTypes.TAG_SUGGESTION,
      props: {
        'data-testid': 'tags-container',
        initialOptions: classification.map((tag) => ({
          label: tag.tagFQN,
          value: tag.tagFQN,
          data: tag,
        })),
        disabled: !(permissions.EditAll || permissions.EditTags),
      },
    },
    {
      name: 'glossaryTerms',
      required: false,
      label: t('label.glossary-term'),
      id: 'root/glossaryTerms',
      type: FieldTypes.TAG_SUGGESTION,
      props: {
        'data-testid': 'glossaryTerms-container',
        open: false,
        hasNoActionButtons: true,
        isTreeSelect: true,
        tagType: TagSource.Glossary,
        placeholder: t('label.select-field', {
          field: t('label.glossary-term'),
        }),
        initialOptions: glossaries.map((glossary) => ({
          label: glossary.tagFQN,
          value: glossary.tagFQN,
          data: glossary,
        })),
        disabled: !(permissions.EditAll || permissions.EditTags),
      },
    },
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      centered
      cancelText={t('label.back')}
      maskClosable={false}
      okButtonProps={{
        htmlType: 'submit',
        id: 'quick-link-form',
        form: 'quick-link-form',
        loading: isUpdating,
      }}
      okText={t('label.save')}
      open={isOpen}
      title={
        isUndefined(quickLink)
          ? t('label.add-entity', { entity: t('label.quick-link') })
          : `${t('label.edit-entity', { entity: t('label.quick-link') })} ${
              quickLink.displayName ?? t('label.untitled')
            }`
      }
      width={780}
      onCancel={onCancel}>
      <Form
        data-testid="quick-link-form"
        form={form}
        id="quick-link-form"
        initialValues={{
          ...initialValues,
          relatedEntities: defaultDataAssetsValues,
        }}
        layout="vertical"
        onFinish={handleSubmit}>
        {generateFormFields(formFields)}
        <Form.Item label={t('label.data-asset-plural')} name="relatedEntities">
          <DataAssetAsyncSelectList
            initialOptions={initialDataAssetsOptions}
            mode="multiple"
            placeholder={t('label.data-asset-plural')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
