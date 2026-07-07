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
  Avatar,
  Box,
  FieldProp,
  FormField,
  FormItemLabel,
  getField,
  Grid,
  HintText,
  HookForm,
  Toggle,
} from '@openmetadata/ui-core-components';
import { Users01 } from '@untitledui/icons';
import { debounce } from 'lodash';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityAttachmentProvider } from '../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import {
  AVAILABLE_ICONS,
  DEFAULT_TAG_ICON,
} from '../../components/common/IconPicker';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import { PAGE_SIZE_MEDIUM } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import { CreateTag } from '../../generated/api/classification/createTag';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { EntityReference } from '../../generated/entity/type';
import { useEntityRules } from '../../hooks/useEntityRules';
import { searchDomains } from '../../rest/domainAPI';
import { searchQuery } from '../../rest/searchAPI';
import { formatTeamsResponse } from '../../utils/APIUtils';
import { getRandomColor } from '../../utils/ColorUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { getEntityReferenceListFromEntities } from '../../utils/EntityReferenceUtils';
import { getTermQuery } from '../../utils/SearchPureUtils';
import tagClassBase from '../../utils/TagClassBase';
import {
  COLOR_FIELD,
  getDisabledField,
  getDisplayNameField,
  getDomainField,
  getIconField,
  getNameField,
  getOwnerField,
} from './tagFormFields';
import './TagsForm.less';
import {
  RenameFormProps,
  TagFormSelectItem,
  TagFormValues,
  TAG_FORM_DEFAULTS,
} from './TagsPage.interface';

const mapEntityReferenceToSelectItem = (
  ref: EntityReference
): TagFormSelectItem => ({
  id: ref.id,
  label: getEntityName(ref),
  supportingText: ref.fullyQualifiedName ?? ref.type,
  value: ref,
});

const convertToTagFormValues = (
  entity: Classification | Tag
): Partial<TagFormValues> => ({
  ...entity,
  owners: (entity.owners ?? []).map(mapEntityReferenceToSelectItem),
  domains: (entity.domains ?? []).map(mapEntityReferenceToSelectItem),
});

const toItemArray = (
  value: TagFormSelectItem | TagFormSelectItem[] | null | undefined
): TagFormSelectItem[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const resolveOwnerSelection = (
  previousItems: TagFormSelectItem[],
  nextItems: TagFormSelectItem[],
  canAddMultipleTeamOwner: boolean
): TagFormSelectItem[] => {
  if (canAddMultipleTeamOwner || nextItems.length <= previousItems.length) {
    return nextItems;
  }

  const addedItem = nextItems.find(
    (item) => !previousItems.some((prevItem) => prevItem.id === item.id)
  );

  if (!addedItem) {
    return nextItems;
  }

  const addedType = (addedItem.value as EntityReference).type;

  if (addedType === EntityType.TEAM) {
    return [addedItem];
  }

  if (addedType === EntityType.USER) {
    return nextItems.filter(
      (item) => (item.value as EntityReference).type !== EntityType.TEAM
    );
  }

  return nextItems;
};

const TagsForm = ({
  form,
  submitRef,
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
  const [userTeamOptions, setUserTeamOptions] = useState<TagFormSelectItem[]>(
    []
  );
  const [domainOptions, setDomainOptions] = useState<TagFormSelectItem[]>([]);
  const [descriptionEditorKey, setDescriptionEditorKey] = useState(0);

  const selectedColor = useWatch({
    control: form.control,
    name: 'style.color',
  });

  const ownersValue = useWatch({
    control: form.control,
    name: 'owners',
  });
  const previousOwnersRef = useRef<TagFormSelectItem[]>([]);

  useEffect(() => {
    const nextItems = toItemArray(ownersValue);
    const corrected = resolveOwnerSelection(
      previousOwnersRef.current,
      nextItems,
      entityRules.canAddMultipleTeamOwner
    );

    previousOwnersRef.current = corrected;

    if (corrected !== nextItems) {
      form.setValue('owners', corrected, { shouldDirty: true });
    }
  }, [ownersValue, entityRules.canAddMultipleTeamOwner, form]);

  useEffect(() => {
    if (initialValues) {
      form.reset(convertToTagFormValues(initialValues) as TagFormValues);
    } else {
      form.reset(TAG_FORM_DEFAULTS);
    }
  }, [initialValues, form]);

  useEffect(() => {
    if (form.formState.isSubmitSuccessful) {
      setDescriptionEditorKey((prev) => prev + 1);
    }
  }, [form.formState.isSubmitSuccessful]);

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
          } as EntityReference,
        };
      });

      const teams = getEntityReferenceListFromEntities(
        formatTeamsResponse(teamsResponse.hits.hits),
        EntityType.TEAM
      );

      setUserTeamOptions([
        ...userOptions,
        ...teams.map((reference) => ({
          ...mapEntityReferenceToSelectItem(reference),
          icon: <Avatar placeholderIcon={Users01} size="xs" />,
        })),
      ]);
    } catch {
      setUserTeamOptions([]);
    }
  }, []);

  const fetchDomainOptions = useCallback(async (searchText = '') => {
    try {
      const domains = await searchDomains(searchText, 1);
      const nextOptions = domains.map((domain) =>
        mapEntityReferenceToSelectItem({
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

  const handleUserTeamFocus = useCallback(() => {
    void fetchUserTeamOptions();
  }, [fetchUserTeamOptions]);

  const handleDomainFocus = useCallback(() => {
    void fetchDomainOptions();
  }, [fetchDomainOptions]);

  const debouncedUserTeamSearch = useMemo(
    () =>
      debounce(
        (searchText: string) => void fetchUserTeamOptions(searchText),
        250
      ),
    [fetchUserTeamOptions]
  );

  const debouncedDomainSearch = useMemo(
    () =>
      debounce(
        (searchText: string) => void fetchDomainOptions(searchText),
        250
      ),
    [fetchDomainOptions]
  );

  useEffect(
    () => () => {
      debouncedUserTeamSearch.cancel();
      debouncedDomainSearch.cancel();
    },
    [debouncedUserTeamSearch, debouncedDomainSearch]
  );

  const iconOptions = useMemo(
    () =>
      [
        DEFAULT_TAG_ICON,
        ...AVAILABLE_ICONS.filter(
          (icon) => icon.name !== DEFAULT_TAG_ICON.name
        ),
      ].map((icon) => ({
        id: icon.name,
        icon: icon.component,
        label: icon.name,
        value: icon.name,
      })),
    []
  );

  const handleSave = useCallback(
    async (formData: TagFormValues) => {
      const { id: _id, ...rest } = formData;
      const owners = toItemArray(rest.owners).map(
        (item) => item.value as EntityReference
      );
      const domainItems = toItemArray(rest.domains);

      let domainsData;
      if (domainItems.length > 0) {
        if (isEditing) {
          domainsData = domainItems.map(
            (item) => item.value as EntityReference
          );
        } else {
          domainsData = domainItems
            .map((item) => {
              const ref = item.value as EntityReference;

              return ref.fullyQualifiedName ?? ref.name;
            })
            .filter(Boolean);
        }
      }

      const submitData = {
        ...rest,
        owners: owners.length ? owners : undefined,
        domains: domainsData,
      } as CreateClassification | CreateTag;

      try {
        await onSubmit(submitData);
      } catch {
        // Parent will handle the error
      }
    },
    [onSubmit, isEditing]
  );

  useEffect(() => {
    if (submitRef) {
      submitRef.current = () => void form.handleSubmit(handleSave)();
    }
  }, [form, handleSave, submitRef]);

  const nameField = useMemo(() => {
    const field = getNameField(disableNameField || false, t);

    return {
      ...field,
      label: t(field.label as string),
      placeholder: t(field.placeholder ?? ''),
    };
  }, [t, disableNameField]);

  const displayNameField = useMemo(() => {
    const field = getDisplayNameField(disableDisplayNameField);

    return {
      ...field,
      label: t(field.label as string),
      placeholder: t(field.placeholder ?? ''),
    };
  }, [t, disableDisplayNameField]);

  const iconField = useMemo(
    () => getIconField(selectedColor, iconOptions as TagFormSelectItem[], t),
    [t, selectedColor, iconOptions]
  );

  const colorField = useMemo(
    () => ({
      ...COLOR_FIELD,
      label: t('label.color'),
    }),
    [t]
  );

  const ownerField = useMemo(
    (): FieldProp => ({
      ...getOwnerField({
        canAddMultipleUserOwners: entityRules.canAddMultipleUserOwners,
        options: userTeamOptions,
        onFocus: handleUserTeamFocus,
        onSearchChange: (searchText: string) =>
          debouncedUserTeamSearch(searchText),
      }),
      label: t('label.owner-plural'),
    }),
    [
      t,
      entityRules.canAddMultipleUserOwners,
      userTeamOptions,
      handleUserTeamFocus,
      debouncedUserTeamSearch,
    ]
  );

  const domainField = useMemo(
    (): FieldProp => ({
      ...getDomainField({
        canAddMultipleDomains: entityRules.canAddMultipleDomains,
        options: domainOptions,
        onFocus: handleDomainFocus,
        onSearchChange: (searchText: string) =>
          debouncedDomainSearch(searchText),
      }),
      label: t('label.domain-plural'),
    }),
    [
      t,
      entityRules.canAddMultipleDomains,
      domainOptions,
      handleDomainFocus,
      debouncedDomainSearch,
    ]
  );

  const disabledField = useMemo(() => {
    const field = getDisabledField({
      disabled: disableDisabledField,
    });

    return {
      ...field,
      label: t(field.label as string),
    };
  }, [t, initialValues, disableDisabledField]);

  const mutuallyExclusiveLabel = useMemo(
    () => t('label.mutually-exclusive'),
    [t]
  );

  const autoClassificationComponent = useMemo(
    () =>
      tagClassBase.getAutoClassificationComponent(isClassification || false),
    [isClassification]
  );

  return (
    <EntityAttachmentProvider
      entityFqn={initialValues?.fullyQualifiedName}
      entityType={
        isClassification ? EntityType.CLASSIFICATION : EntityType.TAG
      }>
      <HookForm
        className="tags-form tw:flex tw:flex-col tw:gap-6"
        data-testid="tags-form"
        form={form}
        onSubmit={form.handleSubmit(handleSave)}>
        <Box direction="col" gap={6}>
          <Grid colGap="4">
            <Grid.Item span={12}>{getField(nameField)}</Grid.Item>
            <Grid.Item span={12}>{getField(displayNameField)}</Grid.Item>
          </Grid>

          {!isClassification && (
            <Box align="start" gap={4}>
              <div className="tw:min-w-[40px] tw:basis-[10%] tw:flex-[0_0_10%]">
                {getField(iconField)}
              </div>
              <div className="tw:min-w-0 tw:basis-[90%] tw:flex-[0_0_90%]">
                {getField(colorField)}
              </div>
            </Box>
          )}

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
                  className="description-text-area new-form-style"
                  initialValue={initialValues?.description ?? ''}
                  key={descriptionEditorKey}
                  readonly={disableDescriptionField}
                  onTextChange={field.onChange}
                />
                {fieldState.error?.message && (
                  <HintText isInvalid>{fieldState.error.message}</HintText>
                )}
              </Box>
            )}
          </FormField>

          {isSystemTag && !isTier && <div>{getField(disabledField)}</div>}

          {showMutuallyExclusive && (
            <FormField control={form.control} name="mutuallyExclusive">
              {({ field }) => (
                <Box align="center" direction="row" gap={2}>
                  <Toggle
                    aria-label={mutuallyExclusiveLabel}
                    data-testid="mutually-exclusive-button"
                    isDisabled={disableMutuallyExclusiveField}
                    isSelected={field.value ?? false}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                  />
                  <FormItemLabel label={mutuallyExclusiveLabel} />
                </Box>
              )}
            </FormField>
          )}
          {getField(ownerField)}
          {getField(domainField)}
          {autoClassificationComponent && (
            <Suspense fallback={null}>{autoClassificationComponent}</Suspense>
          )}
        </Box>
      </HookForm>
    </EntityAttachmentProvider>
  );
};

export default TagsForm;
