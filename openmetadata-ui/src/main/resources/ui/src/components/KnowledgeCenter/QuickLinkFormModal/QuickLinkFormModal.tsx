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
    Autocomplete,
    Button,
    Dialog,
    FieldProp,
    FieldTypes,
    FormSelectItem,
    getField,
    HookForm,
    Modal,
    ModalOverlay
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, debounce, isEqual, isNil, isUndefined } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
    KNOWLEDGE_CENTER_CLASSIFICATION,
    PAGE_SIZE
} from '../../../constants/constants';
import { getKnowledgePageFields } from '../../../constants/KnowledgeCenter.constant';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import {
    LabelType,
    State,
    TagLabel,
    TagSource
} from '../../../generated/type/tagLabel';
import {
    CreateKnowledgePage,
    KnowledgePage,
    QuickLink
} from '../../../interface/knowledge-center.interface';
import { searchGlossaryTerms } from '../../../rest/glossaryAPI';
import {
    getKnowledgePageByFqn,
    patchKnowledgePage
} from '../../../rest/knowledgeCenterAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityReferenceUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { isValidUrl } from '../../../utils/SSOUtils';
import { escapeESReservedCharacters } from '../../../utils/StringUtils';
import { getTagsWithoutTier } from '../../../utils/TablePureUtils';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import tagClassBase from '../../../utils/TagClassBase';
import { getTagDisplay } from '../../../utils/TagsPureUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

export interface QuickLinkFormModalFormData
  extends Pick<CreateKnowledgePage, 'description' | 'displayName'> {
  url: string;
  tags?: TagLabel[];
  glossaryTerms?: TagLabel[];
  relatedEntities?: EntityReference[];
}

interface QuickLinkFormSelectItem extends FormSelectItem {
  value: TagLabel | EntityReference;
}

interface QuickLinkFormValues {
  displayName: string;
  url: string;
  description: string;
  tags: QuickLinkFormSelectItem[];
  glossaryTerms: QuickLinkFormSelectItem[];
  relatedEntities: QuickLinkFormSelectItem[];
}

export interface QuickLinkFormModalProps {
  isOpen: boolean;
  quickLink?: KnowledgePage;
  permissions: OperationPermission;
  onSave: (data: QuickLinkFormModalFormData) => void;
  onCancel: () => void;
}

const mapTagLabelToSelectItem = (tag: TagLabel): QuickLinkFormSelectItem => ({
  id: tag.tagFQN,
  label: getTagDisplay(tag.displayName || tag.name) || tag.tagFQN,
  supportingText: tag.tagFQN,
  value: tag,
});

const mapEntityReferenceToSelectItem = (
  ref: EntityReference
): QuickLinkFormSelectItem => ({
  id: ref.id,
  label: getEntityName(ref),
  supportingText: ref.fullyQualifiedName ?? ref.type,
  value: ref,
});

export const QuickLinkFormModal: FC<QuickLinkFormModalProps> = ({
  isOpen,
  quickLink,
  permissions,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation('translation', { i18n });
  const [isUpdating, setIsUpdating] = useState(false);
  const [tagOptions, setTagOptions] = useState<QuickLinkFormSelectItem[]>([]);
  const [glossaryOptions, setGlossaryOptions] = useState<
    QuickLinkFormSelectItem[]
  >([]);
  const [assetOptions, setAssetOptions] = useState<QuickLinkFormSelectItem[]>(
    []
  );

  const { initialValues, restRelatedDataAssets } = useMemo(() => {
    if (isUndefined(quickLink)) {
      return {
        initialValues: {
          displayName: '',
          url: '',
          description: '',
          tags: [],
          glossaryTerms: [],
          relatedEntities: [],
        },
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

    return {
      initialValues: {
        displayName: quickLink.displayName ?? '',
        url: (quickLink.page as QuickLink)?.url ?? '',
        description: quickLink.description ?? '',
        tags: classification.map(mapTagLabelToSelectItem),
        glossaryTerms: glossaries.map(mapTagLabelToSelectItem),
        relatedEntities: filteredRelatedDataAssets.map(
          mapEntityReferenceToSelectItem
        ),
      },
      restRelatedDataAssets,
    };
  }, [quickLink]);

  const form = useForm<QuickLinkFormValues>({ defaultValues: initialValues });

  useEffect(() => {
    form.reset(initialValues);
  }, [initialValues]);

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

  const fetchTagOptions = useCallback(async (searchText = '') => {
    try {
      const response = await tagClassBase.getTags(searchText, 1, true);
      const options = (response?.data ?? [])
        .map((option) => {
          const tag = option.data as {
            description?: string;
            displayName?: string;
            fullyQualifiedName?: string;
            name?: string;
          };
          if (!tag?.fullyQualifiedName) {
            return null;
          }

          return mapTagLabelToSelectItem({
            labelType: LabelType.Manual,
            source: TagSource.Classification,
            state: State.Confirmed,
            tagFQN: tag.fullyQualifiedName,
            displayName: tag.displayName,
            name: tag.name,
            description: tag.description,
          });
        })
        .filter((opt): opt is QuickLinkFormSelectItem => opt !== null);

      setTagOptions(options);
    } catch {
      setTagOptions([]);
    }
  }, []);

  const fetchGlossaryOptions = useCallback(async (searchText = '') => {
    try {
      const response = await searchGlossaryTerms(searchText);
      const hits = response?.hits?.hits ?? [];
      const options = hits.map(
        (hit: {
          _source: {
            fullyQualifiedName?: string;
            displayName?: string;
            name?: string;
            description?: string;
          };
        }) => {
          const source = hit._source;

          return mapTagLabelToSelectItem({
            labelType: LabelType.Manual,
            source: TagSource.Glossary,
            state: State.Confirmed,
            tagFQN: source.fullyQualifiedName ?? '',
            displayName: source.displayName,
            name: source.name,
            description: source.description,
          });
        }
      );

      setGlossaryOptions(options);
    } catch {
      setGlossaryOptions([]);
    }
  }, []);

  const fetchAssetOptions = useCallback(async (searchText = '') => {
    try {
      const escaped = escapeESReservedCharacters(searchText);
      const response = await searchQuery({
        query: escaped ? `*${escaped}*` : '*',
        pageNumber: 1,
        pageSize: PAGE_SIZE,
        searchIndex: SearchIndex.DATA_ASSET,
      });
      const options = response.hits.hits.map(({ _source }) => {
        const ref = getEntityReferenceFromEntity(
          _source as EntityReference,
          _source.entityType as EntityType
        );

        return mapEntityReferenceToSelectItem(ref);
      });

      setAssetOptions(options);
    } catch {
      setAssetOptions([]);
    }
  }, []);

  const debouncedTagSearch = useMemo(
    () => debounce((text: string) => void fetchTagOptions(text), 250),
    [fetchTagOptions]
  );

  const debouncedGlossarySearch = useMemo(
    () => debounce((text: string) => void fetchGlossaryOptions(text), 250),
    [fetchGlossaryOptions]
  );

  const debouncedAssetSearch = useMemo(
    () => debounce((text: string) => void fetchAssetOptions(text), 250),
    [fetchAssetOptions]
  );

  useEffect(
    () => () => {
      debouncedTagSearch.cancel();
      debouncedGlossarySearch.cancel();
      debouncedAssetSearch.cancel();
    },
    [debouncedAssetSearch, debouncedGlossarySearch, debouncedTagSearch]
  );

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
    form.reset();
    onCancel();
  };

  const handleFormSubmit = (values: QuickLinkFormValues) => {
    const relatedEntities = [
      ...restRelatedDataAssets,
      ...values.relatedEntities
        .map((item) => item.value as EntityReference)
        .filter((ref) => !isNil(ref)),
    ];

    const updatedValues: QuickLinkFormModalFormData = {
      displayName: values.displayName,
      url: values.url,
      description: values.description,
      tags: values.tags.map((item) => item.value as TagLabel),
      glossaryTerms: values.glossaryTerms.map((item) => item.value as TagLabel),
      relatedEntities,
    };

    if (!isUndefined(quickLink)) {
      handleQuickLinkUpdate(quickLink, updatedValues);
    } else {
      onSave(updatedValues);
    }
  };

  const displayNameField: FieldProp = {
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
  };

  const urlField: FieldProp = {
    name: 'url',
    required: true,
    label: t('label.url-uppercase'),
    id: 'root/url',
    type: FieldTypes.TEXT,
    rules: {
      required: t('label.field-required', {
        field: t('label.url-uppercase'),
      }),
      validate: (value: string) =>
        isValidUrl(value) || t('message.invalid-url'),
    },
    props: {
      'data-testid': 'url',
      disabled: !permissions.EditAll,
    },
    placeholder: t('label.url-uppercase'),
  };

  const descriptionField: FieldProp = {
    name: 'description',
    required: false,
    label: t('label.description'),
    id: 'root/description',
    type: FieldTypes.DESCRIPTION,
    props: {
      'data-testid': 'description',
      disabled: !(permissions.EditAll || permissions.EditDescription),
    },
    placeholder: t('label.description'),
  };

  const tagsField: FieldProp = {
    name: 'tags',
    required: false,
    label: t('label.tag-plural'),
    id: 'root/tags',
    type: FieldTypes.TAG_SUGGESTION,
    props: {
      'data-testid': 'tags-container',
      disabled: !(permissions.EditAll || permissions.EditTags),
      filterOption: () => true,
      multiple: true,
      onFocus: () => void fetchTagOptions(),
      onSearchChange: (text: string) => debouncedTagSearch(text),
      options: tagOptions,
      renderItem: (item: FormSelectItem) => (
        <Autocomplete.Item
          id={item.id}
          key={item.id}
          label={item.label}
          supportingText={item.supportingText}
        />
      ),
    },
    placeholder: t('label.select-field', { field: t('label.tag-plural') }),
  };

  const glossaryTermsField: FieldProp = {
    name: 'glossaryTerms',
    required: false,
    label: t('label.glossary-term-plural'),
    id: 'root/glossaryTerms',
    type: FieldTypes.GLOSSARY_TAG_SUGGESTION,
    props: {
      'data-testid': 'glossaryTerms-container',
      disabled: !(permissions.EditAll || permissions.EditTags),
      filterOption: () => true,
      multiple: true,
      onFocus: () => void fetchGlossaryOptions(),
      onSearchChange: (text: string) => debouncedGlossarySearch(text),
      options: glossaryOptions,
      renderItem: (item: FormSelectItem) => (
        <Autocomplete.Item
          id={item.id}
          key={item.id}
          label={item.label}
          supportingText={item.supportingText}
        />
      ),
    },
    placeholder: t('label.select-field', {
      field: t('label.glossary-term-plural'),
    }),
  };

  const relatedEntitiesField: FieldProp = {
    name: 'relatedEntities',
    required: false,
    label: t('label.data-asset-plural'),
    id: 'root/relatedEntities',
    type: FieldTypes.ASYNC_SELECT,
    props: {
      'data-testid': 'related-entities-container',
      filterOption: () => true,
      multiple: true,
      onFocus: () => void fetchAssetOptions(),
      onSearchChange: (text: string) => debouncedAssetSearch(text),
      options: assetOptions,
      renderItem: (item: FormSelectItem) => (
        <Autocomplete.Item
          id={item.id}
          key={item.id}
          label={item.label}
          supportingText={item.supportingText}
        />
      ),
    },
    placeholder: t('label.select-field', {
      field: t('label.data-asset-plural'),
    }),
  };

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
            <HookForm
              className="tw:flex tw:flex-col tw:gap-6"
              data-testid="quick-link-form"
              form={form}
              onSubmit={form.handleSubmit(handleFormSubmit)}>
              {getField(displayNameField)}
              <div>{getField(urlField)}</div>
              {getField(descriptionField)}
              {getField(tagsField)}
              {getField(glossaryTermsField)}
              {getField(relatedEntitiesField)}
            </HookForm>
          </Dialog.Content>

          <Dialog.Footer className="quick-link-modal-footer">
            <Button color="secondary" onClick={handleCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              isLoading={isUpdating}
              onClick={() => form.handleSubmit(handleFormSubmit)()}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
