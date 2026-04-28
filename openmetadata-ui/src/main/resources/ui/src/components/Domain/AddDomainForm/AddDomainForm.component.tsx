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
  Avatar,
  Box,
  Button,
  Dot,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  FormSelectItem,
  getField,
  HintText,
  HookForm,
} from '@openmetadata/ui-core-components';
import { Users01 } from '@untitledui/icons';
import { debounce, omit } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import imageClassBase from '../../../components/BlockEditor/Extensions/image/ImageClassBase';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
import {
  CreateDomain,
  DomainType,
} from '../../../generated/api/domains/createDomain';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/entity/type';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { searchDomains } from '../../../rest/domainAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { formatTeamsResponse } from '../../../utils/APIUtils';
import { getRandomColor } from '../../../utils/CommonUtils';
import {
  getEntityName,
  getEntityReferenceListFromEntities,
} from '../../../utils/EntityUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getTermQuery } from '../../../utils/SearchUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { getTagDisplay } from '../../../utils/TagsUtils';
import {
  AVAILABLE_ICONS,
  DEFAULT_DATA_PRODUCT_ICON,
  DEFAULT_DOMAIN_ICON,
} from '../../common/IconPicker';
import MUIGlossaryTagSuggestion from '../../common/MUIGlossaryTagSuggestion/MUIGlossaryTagSuggestion';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import '../domain.less';
import { DomainFormType } from '../DomainPage.interface';
import {
  AddDomainFormProps,
  DomainFormSelectItem,
  DomainFormValues,
} from './AddDomainForm.interface';

const COVER_IMAGE_ACCEPTED_TYPES = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/gif',
];

export const DOMAIN_FORM_DEFAULTS: DomainFormValues = {
  name: '',
  displayName: '',
  description: '',
  color: '',
  iconURL: '',
  coverImage: null,
  tags: [],
  glossaryTerms: [],
  owners: [],
  experts: [],
  domainType: null,
  domains: undefined,
};

export const transformDomainFormData = (
  formData: DomainFormValues,
  type: DomainFormType,
  parentDomain?: Domain
): CreateDomain | CreateDataProduct => {
  const tags = formData.tags.map((item) => item.value as TagLabel);
  const expertsList = formData.experts.map(
    (item) => item.value as EntityReference
  );
  const ownersList = formData.owners.map(
    (item) => item.value as EntityReference
  );

  const updatedData = omit(
    formData,
    'color',
    'iconURL',
    'glossaryTerms',
    'tags',
    'owners',
    'experts',
    'domains',
    'domainType'
  );
  const style: { color?: string; iconURL?: string } = {};
  if (formData.color) {
    style.color = formData.color;
  }
  if (formData.iconURL) {
    style.iconURL = formData.iconURL;
  }

  const data: CreateDomain | CreateDataProduct = {
    ...updatedData,
    domainType: (formData.domainType?.value as DomainType) ?? undefined,
    experts: expertsList.map((item) => item.name ?? ''),
    owners: ownersList,
    style,
    tags: [...tags, ...formData.glossaryTerms],
  } as CreateDomain | CreateDataProduct;

  if (type === DomainFormType.DATA_PRODUCT) {
    const domainRef = formData.domains?.value as EntityReference | undefined;
    if (domainRef?.fullyQualifiedName) {
      (data as CreateDataProduct).domains = [domainRef.fullyQualifiedName];
    } else if (parentDomain?.fullyQualifiedName) {
      (data as CreateDataProduct).domains = [parentDomain.fullyQualifiedName];
    }
  } else {
    delete (data as CreateDomain & { domains?: unknown }).domains;
  }

  return data;
};

const createTagLabel = ({
  description,
  displayName,
  name,
  source,
  style,
  tagFQN,
}: {
  description?: string;
  displayName?: string;
  name?: string;
  source: TagSource;
  style?: TagLabel['style'];
  tagFQN: string;
}): TagLabel => ({
  description,
  displayName,
  labelType: LabelType.Manual,
  name,
  source,
  state: State.Confirmed,
  style,
  tagFQN,
});

const mapTagLabelToOption = (tagLabel: TagLabel): DomainFormSelectItem => ({
  id: tagLabel.tagFQN,
  label:
    getTagDisplay(tagLabel.displayName || tagLabel.name) || tagLabel.tagFQN,
  supportingText: tagLabel.displayName || tagLabel.name,
  icon: tagLabel.style?.color ? (
    <Dot size="sm" style={{ color: tagLabel.style.color }} />
  ) : undefined,
  value: tagLabel,
});

const mapEntityReferenceToOption = (
  reference: EntityReference
): DomainFormSelectItem => ({
  id: reference.id,
  label: getEntityName(reference),
  supportingText: reference.fullyQualifiedName || reference.type,
  value: reference,
});

const AddDomainForm = ({
  form,
  isFormInDialog,
  loading,
  onCancel,
  onSubmit,
  type,
  parentDomain,
}: AddDomainFormProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const [tagOptions, setTagOptions] = useState<DomainFormSelectItem[]>([]);
  const [domainOptions, setDomainOptions] = useState<DomainFormSelectItem[]>(
    []
  );
  const [userTeamOptions, setUserTeamOptions] = useState<
    DomainFormSelectItem[]
  >([]);
  const [userOnlyOptions, setUserOnlyOptions] = useState<
    DomainFormSelectItem[]
  >([]);
  const [descriptionEditorKey, setDescriptionEditorKey] = useState(0);

  const domainTypeOptions = Object.keys(DomainType).map((key) => {
    const domainTypeValue = DomainType[key as keyof typeof DomainType];

    return {
      label: domainTypeValue,
      id: domainTypeValue,
      value: domainTypeValue,
    };
  });
  const selectedColor = useWatch({
    control: form.control,
    name: 'color',
  });

  const { onImageUpload } =
    imageClassBase.getBlockEditorAttachmentProps() ?? {};
  const isCoverImageUploadAvailable = !!onImageUpload;

  const createPermission = useMemo(() => {
    const resourceEntity =
      type === DomainFormType.DATA_PRODUCT
        ? ResourceEntity.DATA_PRODUCT
        : ResourceEntity.DOMAIN;

    return checkPermission(Operation.Create, resourceEntity, permissions);
  }, [permissions, type]);
  const defaultIcon = useMemo(
    () =>
      type === DomainFormType.DATA_PRODUCT
        ? DEFAULT_DATA_PRODUCT_ICON
        : DEFAULT_DOMAIN_ICON,
    [type]
  );

  const iconOptions = useMemo<DomainFormSelectItem[]>(() => {
    return [
      defaultIcon,
      ...AVAILABLE_ICONS.filter((icon) => icon.name !== defaultIcon.name),
    ].map((icon) => ({
      id: icon.name,
      icon: icon.component,
      label: icon.name,
      value: icon.name,
    }));
  }, [defaultIcon]);

  const domainTypeFieldRequired = useMemo(
    () => type === DomainFormType.DOMAIN || type === DomainFormType.SUBDOMAIN,
    [type]
  );

  const fetchTagOptions = useCallback(async (searchText = '') => {
    try {
      const response = await tagClassBase.getTags(searchText, 1, true);
      const nextOptions = (response?.data ?? [])
        .map((option) => {
          const tag = option.data as {
            description?: string;
            displayName?: string;
            fullyQualifiedName?: string;
            name?: string;
            style?: TagLabel['style'];
          };

          if (!tag?.fullyQualifiedName) {
            return null;
          }

          return mapTagLabelToOption(
            createTagLabel({
              description: tag.description,
              displayName: tag.displayName,
              name: tag.name,
              source: TagSource.Classification,
              style: tag.style,
              tagFQN: tag.fullyQualifiedName,
            })
          );
        })
        .filter((option): option is DomainFormSelectItem => option !== null);

      setTagOptions(nextOptions);
    } catch {
      setTagOptions([]);
    }
  }, []);

  const fetchDomainOptions = useCallback(async (searchText = '') => {
    try {
      const domains = await searchDomains(searchText, 1);
      const nextOptions = domains.map((domain: Domain) =>
        mapEntityReferenceToOption({
          displayName: domain.displayName,
          fullyQualifiedName: domain.fullyQualifiedName,
          id: domain.id,
          name: domain.name,
          type: EntityType.DOMAIN,
        })
      );

      setDomainOptions(nextOptions);
    } catch {
      setDomainOptions([]);
    }
  }, []);

  const fetchUserTeamOptions = useCallback(async (searchText = '') => {
    try {
      const [usersResponse, teamsResponse] = await Promise.all([
        searchQuery({
          pageNumber: 1,
          pageSize: PAGE_SIZE_MEDIUM,
          query: searchText,
          queryFilter: getTermQuery({ isBot: 'false' }),
          searchIndex: SearchIndex.USER,
          sortField: 'displayName.keyword',
          sortOrder: 'asc',
        }),
        searchQuery({
          pageNumber: 1,
          pageSize: PAGE_SIZE_MEDIUM,
          query: searchText,
          queryFilter: getTermQuery({}, 'must', undefined, {
            matchTerms: { teamType: 'Group' },
          }),
          searchIndex: SearchIndex.TEAM,
          sortField: 'displayName.keyword',
          sortOrder: 'asc',
        }),
      ]);

      const userOptions = usersResponse.hits.hits.map((hit) => {
        const source = hit._source;

        const name = getEntityName(source);
        const { color, backgroundColor, character } = getRandomColor(
          source.displayName ?? source.name ?? ''
        );

        return {
          id: source.id,
          label: name,
          supportingText: source.fullyQualifiedName ?? EntityType.USER,
          icon: (
            <Avatar
              initials={character}
              size="xs"
              src={source.profile?.images?.image ?? undefined}
              style={{ color, backgroundColor }}
            />
          ),
          value: {
            id: source.id,
            type: EntityType.USER,
            name: source.name,
            displayName: source.displayName,
            fullyQualifiedName: source.fullyQualifiedName,
          },
        };
      });

      const teams = getEntityReferenceListFromEntities(
        formatTeamsResponse(teamsResponse.hits.hits),
        EntityType.TEAM
      );

      setUserOnlyOptions(userOptions);
      setUserTeamOptions([
        ...userOptions,
        ...teams.map((reference) => ({
          ...mapEntityReferenceToOption(reference),
          icon: <Avatar placeholderIcon={Users01} size="xs" />,
        })),
      ]);
    } catch {
      setUserOnlyOptions([]);
      setUserTeamOptions([]);
    }
  }, []);

  const handleTagFocus = useCallback(() => {
    void fetchTagOptions();
  }, [fetchTagOptions]);

  const handleDomainFocus = useCallback(() => {
    void fetchDomainOptions();
  }, [fetchDomainOptions]);

  const handleUserTeamFocus = useCallback(() => {
    void fetchUserTeamOptions();
  }, [fetchUserTeamOptions]);

  const debouncedTagSearch = useMemo(
    () =>
      debounce((searchText: string) => void fetchTagOptions(searchText), 250),
    [fetchTagOptions]
  );

  const debouncedDomainSearch = useMemo(
    () =>
      debounce(
        (searchText: string) => void fetchDomainOptions(searchText),
        250
      ),
    [fetchDomainOptions]
  );

  const debouncedUserTeamSearch = useMemo(
    () =>
      debounce(
        (searchText: string) => void fetchUserTeamOptions(searchText),
        250
      ),
    [fetchUserTeamOptions]
  );

  useEffect(
    () => () => {
      debouncedTagSearch.cancel();
      debouncedDomainSearch.cancel();
      debouncedUserTeamSearch.cancel();
    },
    [debouncedDomainSearch, debouncedTagSearch, debouncedUserTeamSearch]
  );

  useEffect(() => {
    if (form.formState.isSubmitSuccessful) {
      setDescriptionEditorKey((prev) => prev + 1);
    }
  }, [form.formState.isSubmitSuccessful]);

  const nameField: FieldProp = {
    id: 'root/name',
    label: t('label.name'),
    name: 'name',
    placeholder: t('label.name'),
    props: { 'data-testid': 'name' },
    required: true,
    rules: {
      required: t('label.field-required', { field: t('label.name') }),
      maxLength: {
        message: t('message.entity-size-in-between', {
          entity: t('label.name'),
          max: 128,
          min: 1,
        }),
        value: 128,
      },
      minLength: {
        message: t('message.entity-size-in-between', {
          entity: t('label.name'),
          max: 128,
          min: 1,
        }),
        value: 1,
      },
      pattern: {
        message: t('message.entity-name-validation'),
        value: ENTITY_NAME_REGEX,
      },
    },
    type: FieldTypes.TEXT,
  };

  const displayNameField: FieldProp = {
    id: 'root/displayName',
    label: t('label.display-name'),
    name: 'displayName',
    placeholder: t('label.display-name'),
    props: { 'data-testid': 'display-name' },
    type: FieldTypes.TEXT,
  };

  const coverImageField: FieldProp = {
    id: 'root/coverImage',
    label: t('label.cover-image'),
    name: 'coverImage',
    placeholder: t('label.upload-cover-image'),
    props: {
      acceptedFileTypes: COVER_IMAGE_ACCEPTED_TYPES,
    },
    type: FieldTypes.COVER_IMAGE_UPLOAD,
  };

  const iconField: FieldProp = {
    id: 'root/iconURL',
    label: t('label.icon'),
    name: 'iconURL',
    placeholder: t('label.select-field', { field: t('label.icon') }),
    props: {
      allowUrl: true,
      'data-testid': 'icon-url',
      backgroundColor: selectedColor,
      defaultIcon,
      options: iconOptions,
      labels: {
        customIconUrl: t('label.icon-url'),
        emptyState: t('message.no-entity-available', {
          entity: t('label.icon-plural'),
        }),
        enterIconUrl: t('label.enter-entity', {
          entity: t('label.icon-url'),
        }),
        iconsTab: t('label.icon-plural'),
        urlTab: t('label.url'),
      },
    },
    type: FieldTypes.ICON_PICKER,
  };

  const colorField: FieldProp = {
    id: 'root/color',
    label: t('label.color'),
    name: 'color',
    type: FieldTypes.COLOR_PICKER,
  };

  const tagsField: FieldProp = {
    id: 'root/tags',
    label: t('label.tag-plural'),
    name: 'tags',
    placeholder: t('label.select-field', { field: t('label.tag-plural') }),
    props: {
      'data-testid': 'tags-container',
      filterOption: () => true,
      multiple: true,
      onFocus: handleTagFocus,
      onSearchChange: (searchText: string) => debouncedTagSearch(searchText),
      options: tagOptions,
      renderItem: (item: FormSelectItem) => (
        <Autocomplete.Item
          avatarUrl={item.avatarUrl}
          data-testid={`tag-option-${item.id}`}
          icon={item.icon}
          id={item.id}
          isDisabled={item.isDisabled}
          key={item.id}
          label={item.label}
          supportingText={item.supportingText}
        />
      ),
    },
    type: FieldTypes.TAG_SUGGESTION,
  };

  const domainTypeField: FieldProp = {
    label: t('label.domain-type'),
    name: 'domainType',
    placeholder: t('label.select-entity', {
      entity: t('label.domain-type'),
    }),
    props: {
      options: domainTypeOptions,
      size: 'sm',
      fontSize: 'sm',
    },
    required: domainTypeFieldRequired,
    rules: domainTypeFieldRequired
      ? {
          required: t('label.field-required', {
            field: t('label.domain-type'),
          }),
        }
      : undefined,
    type: FieldTypes.SELECT,
  };

  const domainField: FieldProp = {
    id: 'root/domains',
    label: t('label.domain'),
    name: 'domains',
    placeholder: t('label.select-field', { field: t('label.domain') }),
    props: {
      filterOption: () => true,
      onFocus: handleDomainFocus,
      onSearchChange: (searchText: string) => debouncedDomainSearch(searchText),
      options: domainOptions,
    },
    required: true,
    rules: {
      required: t('label.field-required', {
        field: t('label.domain'),
      }),
    },
    type: FieldTypes.DOMAIN_SELECT,
  };

  const ownersField: FieldProp = {
    id: 'root/owners',
    label: t('label.owner-plural'),
    name: 'owners',
    placeholder: t('label.select-field', {
      field: t('label.owner-plural'),
    }),
    props: {
      filterOption: () => true,
      multiple: true,
      onFocus: handleUserTeamFocus,
      onSearchChange: (searchText: string) =>
        debouncedUserTeamSearch(searchText),
      options: userTeamOptions,
    },
    type: FieldTypes.USER_TEAM_SELECT_INPUT,
  };

  const expertsField: FieldProp = {
    id: 'root/experts',
    label: t('label.expert-plural'),
    name: 'experts',
    placeholder: t('label.select-field', {
      field: t('label.expert-plural'),
    }),
    props: {
      filterOption: () => true,
      multiple: true,
      onFocus: handleUserTeamFocus,
      onSearchChange: (searchText: string) =>
        debouncedUserTeamSearch(searchText),
      options: userOnlyOptions,
    },
    type: FieldTypes.USER_TEAM_SELECT,
  };

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-6"
      data-testid="add-domain-form"
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}>
      {isCoverImageUploadAvailable && <div>{getField(coverImageField)}</div>}

      <Box align="start" gap={4}>
        <div className="tw:min-w-[40px] tw:basis-[10%] tw:flex-[0_0_10%]">
          {getField(iconField)}
        </div>
        <div className="tw:min-w-0 tw:basis-[90%] tw:flex-[0_0_90%]">
          {getField(colorField)}
        </div>
      </Box>

      <Box gap={4}>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(nameField)}
        </div>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(displayNameField)}
        </div>
      </Box>

      <FormField
        control={form.control}
        name="description"
        rules={{
          required: t('label.field-required', {
            field: t('label.description'),
          }),
        }}>
        {({ field, fieldState }) => (
          <Box
            aria-invalid={fieldState.invalid || undefined}
            className="tw:gap-[6px]"
            direction="col">
            <FormItemLabel required label={t('label.description')} />
            <RichTextEditor
              className="add-domain-form-description new-form-style"
              initialValue={typeof field.value === 'string' ? field.value : ''}
              key={descriptionEditorKey}
              onTextChange={field.onChange}
            />
            {fieldState.error?.message && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      <div>{getField(tagsField)}</div>
      <FormField control={form.control} name="glossaryTerms">
        {({ field }) => (
          <MUIGlossaryTagSuggestion
            data-testid="glossary-terms"
            label={t('label.glossary-term-plural')}
            placeholder={t('label.select-field', {
              field: t('label.glossary-term-plural'),
            })}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      </FormField>

      {(type === DomainFormType.DOMAIN ||
        type === DomainFormType.SUBDOMAIN) && (
        <div data-testid="domainType">{getField(domainTypeField)}</div>
      )}

      {type === DomainFormType.DATA_PRODUCT && !parentDomain && (
        <div data-testid="domain-select">{getField(domainField)}</div>
      )}

      <div>{getField(ownersField)}</div>
      <div>{getField(expertsField)}</div>

      {!isFormInDialog && (
        <Box data-testid="cta-buttons" gap={4} justify="end">
          <Button
            color="tertiary"
            data-testid="cancel-domain"
            onPress={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            data-testid="save-domain"
            isDisabled={!createPermission}
            isLoading={loading}
            type="submit">
            {t('label.save')}
          </Button>
        </Box>
      )}
    </HookForm>
  );
};

export default AddDomainForm;
