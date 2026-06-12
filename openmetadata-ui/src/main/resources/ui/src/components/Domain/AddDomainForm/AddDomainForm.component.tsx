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
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RegisterOptions, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import imageClassBase from '../../../components/BlockEditor/Extensions/image/ImageClassBase';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import {
  DATA_PRODUCT_TYPE_LABEL_KEYS,
  PORTFOLIO_PRIORITY_LABEL_KEYS,
  VISIBILITY_LABEL_KEYS,
} from '../../../constants/DataProduct.constants';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
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
import { Domain } from '../../../generated/entity/domains/domain';
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
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { searchDomains } from '../../../rest/domainAPI';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { formatTeamsResponse } from '../../../utils/APIUtils';
import { getRandomColor } from '../../../utils/ColorUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceListFromEntities } from '../../../utils/EntityReferenceUtils';
import { showNotistackError } from '../../../utils/NotistackUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getTermQuery } from '../../../utils/SearchUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { getTagDisplay } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
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
  reviewers: [],
  domainType: null,
  domains: undefined,
  dataProductType: null,
  visibility: null,
  portfolioPriority: null,
  extension: {},
};

// Extension fields rendered by core-components pickers store the selected
// FormSelectItem/DomainFormSelectItem ({ id, label, value, ... }) in form
// state, but the API expects the raw wrapped `.value`:
//  - SELECT (enum)          → item.value (the enum string)
//  - USER_TEAM_SELECT_INPUT → item.value (an EntityReference), single or array
// Plain TEXT / NUMBER / DESCRIPTION fields store raw values and pass through
// untouched. This is shape-based (not custom-property-type-based) so it works
// in every submit path — including the drawer flow, which calls
// transformDomainFormData without the custom-property definitions.
const isFormSelectItem = (value: unknown): value is DomainFormSelectItem =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'value' in value;

const unwrapSelectItemValue = (raw: unknown): unknown => {
  if (Array.isArray(raw)) {
    return raw.map((item) => (isFormSelectItem(item) ? item.value : item));
  }
  if (isFormSelectItem(raw)) {
    return raw.value;
  }

  return raw;
};

const normalizeExtensionForApi = (
  extension: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => {
  if (!extension) {
    return extension;
  }
  const normalized: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(extension)) {
    normalized[key] = unwrapSelectItemValue(raw);
  }

  return normalized;
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
  const reviewersList = formData.reviewers.map(
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
    'reviewers',
    'domains',
    'domainType',
    'dataProductType',
    'visibility',
    'portfolioPriority'
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
    extension: normalizeExtensionForApi(formData.extension),
    owners: ownersList,
    style,
    tags: [...tags, ...formData.glossaryTerms],
  } as CreateDomain | CreateDataProduct;

  if (type === DomainFormType.DATA_PRODUCT) {
    const dataProduct = data as CreateDataProduct;
    const domainRef = formData.domains?.value as EntityReference | undefined;
    if (domainRef?.fullyQualifiedName) {
      dataProduct.domains = [domainRef.fullyQualifiedName];
    } else if (parentDomain?.fullyQualifiedName) {
      dataProduct.domains = [parentDomain.fullyQualifiedName];
    }
    if (formData.dataProductType?.value) {
      dataProduct.dataProductType = formData.dataProductType
        .value as DataProductType;
    }
    if (formData.visibility?.value) {
      dataProduct.visibility = formData.visibility.value as Visibility;
    }
    if (formData.portfolioPriority?.value) {
      dataProduct.portfolioPriority = formData.portfolioPriority
        .value as PortfolioPriority;
    }
    dataProduct.reviewers = reviewersList;
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
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
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
  const [intakeForm, setIntakeForm] = useState<IntakeForm | null>(null);
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );

  const targetEntityType = useMemo<TargetEntityType | null>(() => {
    if (type === DomainFormType.DATA_PRODUCT) {
      return TargetEntityType.DataProduct;
    }
    if (type === DomainFormType.DOMAIN || type === DomainFormType.SUBDOMAIN) {
      return TargetEntityType.Domain;
    }

    return null;
  }, [type]);

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
          // getIntakeFormByEntityType returns null for 404 (no form configured);
          // anything reaching this catch is an unexpected failure (auth, 5xx,
          // network). Surface it so admins aren't silently shown an unrestricted
          // form when server-side validation will still reject their submission.
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
    const entityTypeApiName =
      targetEntityType === TargetEntityType.DataProduct
        ? 'dataProduct'
        : targetEntityType === TargetEntityType.Domain
        ? 'domain'
        : 'glossaryTerm';
    getCustomPropertiesByEntityType(entityTypeApiName)
      .then((props) => {
        if (!cancelled) {
          setCustomProperties(props ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCustomProperties([]);
          // Silently empty custom properties would let the designer render
          // without required extension fields — surface the failure instead.
          showErrorToast(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [targetEntityType]);

  // Map of native fieldPath → RequiredField so applyIntakeFormRequired can
  // consult the admin-configured errorMessage / fieldLabel when injecting
  // the required rule below. A Set of paths isn't enough because the rule
  // message needs the per-field metadata from the intake form.
  const nativeRequiredFieldsByPath = useMemo(() => {
    const map = new Map<string, RequiredField>();
    (intakeForm?.requiredFields ?? []).forEach((rf: RequiredField) => {
      const isCustom =
        rf.fieldKind === FieldKind.CustomProperty ||
        rf.fieldPath.startsWith('extension.');
      if (!isCustom) {
        map.set(rf.fieldPath, rf);
      }
    });

    return map;
  }, [intakeForm]);

  const extensionRequiredFields = useMemo<RequiredField[]>(() => {
    return (intakeForm?.requiredFields ?? []).filter(
      (rf) =>
        rf.fieldKind === FieldKind.CustomProperty ||
        rf.fieldPath.startsWith('extension.')
    );
  }, [intakeForm]);

  const domainTypeOptions = Object.keys(DomainType).map((key) => {
    const domainTypeValue = DomainType[key as keyof typeof DomainType];

    return {
      label: domainTypeValue,
      id: domainTypeValue,
      value: domainTypeValue,
    };
  });

  const dataProductTypeOptions = useMemo<DomainFormSelectItem[]>(
    () =>
      Object.values(DataProductType).map((v) => ({
        id: v,
        label: t(DATA_PRODUCT_TYPE_LABEL_KEYS[v]),
        value: v,
      })),
    [t]
  );

  const visibilityOptions = useMemo<DomainFormSelectItem[]>(
    () =>
      Object.values(Visibility).map((v) => ({
        id: v,
        label: t(VISIBILITY_LABEL_KEYS[v]),
        value: v,
      })),
    [t]
  );

  const portfolioPriorityOptions = useMemo<DomainFormSelectItem[]>(
    () =>
      Object.values(PortfolioPriority).map((v) => ({
        id: v,
        label: t(PORTFOLIO_PRIORITY_LABEL_KEYS[v]),
        value: v,
      })),
    [t]
  );

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

  // Inject a field-specific required rule so the intake form's configured
  // errorMessage (or fieldLabel) surfaces in the UI instead of a generic
  // "Required" message. Keeps any existing rules on the field.
  const applyIntakeFormRequired = useCallback(
    (field: FieldProp): FieldProp => {
      const rf = nativeRequiredFieldsByPath.get(field.name);
      if (!rf) {
        return field;
      }
      const message =
        rf.errorMessage || t('label.field-required', { field: rf.fieldLabel });

      return {
        ...field,
        required: true,
        rules: { ...(field.rules ?? {}), required: message },
      };
    },
    [nativeRequiredFieldsByPath, t]
  );

  const intakeFormRequiredMessage = useCallback(
    (fieldPath: string): string | undefined => {
      const rf = nativeRequiredFieldsByPath.get(fieldPath);
      if (!rf) {
        return undefined;
      }

      return (
        rf.errorMessage || t('label.field-required', { field: rf.fieldLabel })
      );
    },
    [nativeRequiredFieldsByPath, t]
  );

  const nameField: FieldProp = applyIntakeFormRequired({
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
  });

  const displayNameField: FieldProp = applyIntakeFormRequired({
    id: 'root/displayName',
    label: t('label.display-name'),
    name: 'displayName',
    placeholder: t('label.display-name'),
    props: { 'data-testid': 'display-name' },
    type: FieldTypes.TEXT,
  });

  const handleCoverImageValidationError = useCallback(
    (message: string) => {
      showNotistackError(
        enqueueSnackbar,
        message,
        undefined,
        { vertical: 'top', horizontal: 'center' },
        closeSnackbar
      );
    },
    [enqueueSnackbar, closeSnackbar]
  );

  const coverImageField: FieldProp = {
    id: 'root/coverImage',
    label: t('label.cover-image'),
    name: 'coverImage',
    placeholder: t('label.upload-cover-image'),
    props: {
      acceptedFileTypes: COVER_IMAGE_ACCEPTED_TYPES,
      maxSizeMB: 5,
      maxDimensions: { width: 800, height: 400 },
      onValidationError: handleCoverImageValidationError,
      coverImageLabels: {
        clickToUpload: t('label.click-to-upload'),
        orDragAndDrop: t('label.or-drag-and-drop'),
        formatHint: (formats: string, maxSizeMB?: number) =>
          t('message.cover-image-format-dimensions', {
            formats,
            width: 800,
            height: 400,
          }) + (maxSizeMB ? ` · ${maxSizeMB}MB` : ''),
        replace: t('label.upload'),
        remove: t('label.remove'),
        reposition: t('label.reposition'),
        savePosition: t('label.save-position'),
        cancel: t('label.cancel'),
        resetPosition: t('label.reset-position'),
        dragHint: t('message.drag-to-adjust-position'),
        imageTooSmallToReposition: t('message.image-too-small-to-reposition'),
      },
      validationMessages: {
        sizeExceeded: (maxSizeMB: number) =>
          t('message.file-size-exceeded', { size: `${maxSizeMB}MB` }),
        dimensionsExceeded: (maxWidth: number, maxHeight: number) =>
          t('message.image-dimensions-exceeded', { maxWidth, maxHeight }),
        failedToLoad: t('message.failed-to-load-image'),
      },
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

  const tagsField: FieldProp = applyIntakeFormRequired({
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
  });

  const domainTypeField: FieldProp = applyIntakeFormRequired({
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
  });

  const domainField: FieldProp = applyIntakeFormRequired({
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
  });

  const ownersField: FieldProp = applyIntakeFormRequired({
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
  });

  const expertsField: FieldProp = applyIntakeFormRequired({
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
  });

  const reviewersField: FieldProp = applyIntakeFormRequired({
    id: 'root/reviewers',
    label: t('label.reviewer-plural'),
    name: 'reviewers',
    placeholder: t('label.select-field', {
      field: t('label.reviewer-plural'),
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
  });

  const dataProductTypeField: FieldProp = applyIntakeFormRequired({
    id: 'root/dataProductType',
    label: t('label.type'),
    name: 'dataProductType',
    placeholder: t('label.select-entity', { entity: t('label.type') }),
    props: {
      'data-testid': 'dataProductType',
      options: dataProductTypeOptions,
      size: 'sm',
      fontSize: 'sm',
    },
    type: FieldTypes.SELECT,
  });

  const visibilityField: FieldProp = applyIntakeFormRequired({
    id: 'root/visibility',
    label: t('label.visibility'),
    name: 'visibility',
    placeholder: t('label.select-entity', { entity: t('label.visibility') }),
    props: {
      'data-testid': 'visibility',
      options: visibilityOptions,
      size: 'sm',
      fontSize: 'sm',
    },
    type: FieldTypes.SELECT,
  });

  const portfolioPriorityField: FieldProp = applyIntakeFormRequired({
    id: 'root/portfolioPriority',
    label: t('label.portfolio-priority'),
    name: 'portfolioPriority',
    placeholder: t('label.select-entity', {
      entity: t('label.portfolio-priority'),
    }),
    props: {
      'data-testid': 'portfolioPriority',
      options: portfolioPriorityOptions,
      size: 'sm',
      fontSize: 'sm',
    },
    type: FieldTypes.SELECT,
  });

  const extensionFields: FieldProp[] = useMemo(() => {
    return extensionRequiredFields.map((rf): FieldProp => {
      const propertyName = rf.fieldPath.startsWith('extension.')
        ? rf.fieldPath.substring('extension.'.length)
        : rf.fieldPath;
      const definition = customProperties.find(
        (cp) => cp.name === propertyName
      );
      const propertyTypeName = definition?.propertyType?.name ?? 'string';
      const config = definition?.customPropertyConfig?.config;
      const requiredMessage =
        rf.errorMessage || t('label.field-required', { field: rf.fieldLabel });
      const baseName = `extension.${propertyName}`;
      const baseId = `root/extension/${propertyName}`;
      const dataTestId = `extension-${propertyName}`;
      const requiredRule: RegisterOptions = { required: requiredMessage };

      switch (propertyTypeName) {
        case 'enum': {
          const enumConfig = config as
            | { values?: string[]; multiSelect?: boolean }
            | undefined;
          const options = (enumConfig?.values ?? []).map((v) => ({
            id: v,
            label: v,
            value: v,
          }));

          return {
            id: baseId,
            label: rf.fieldLabel,
            name: baseName,
            placeholder: rf.fieldLabel,
            props: {
              'data-testid': dataTestId,
              options,
              multiple: enumConfig?.multiSelect,
            },
            required: true,
            rules: requiredRule,
            type: FieldTypes.SELECT,
          };
        }
        case 'entityReference':
        case 'entityReferenceList': {
          // Custom-property entityReference fields are constrained by an
          // `allowedTypes` array (e.g. ['user'], ['team'], or a mix). We
          // reuse the existing user/team search options here — userOnly =
          // strictly the user list, anything else (incl. team-only) falls
          // back to the combined user+team listing because we don't yet
          // fetch teams in isolation.
          const allowedTypes = Array.isArray(config)
            ? (config as string[])
            : [];
          const isUserOnly =
            allowedTypes.length === 1 && allowedTypes[0] === 'user';
          const isMulti = propertyTypeName === 'entityReferenceList';

          return {
            id: baseId,
            label: rf.fieldLabel,
            name: baseName,
            placeholder: rf.fieldLabel,
            props: {
              'data-testid': dataTestId,
              filterOption: () => true,
              multiple: isMulti,
              onFocus: handleUserTeamFocus,
              onSearchChange: (searchText: string) =>
                debouncedUserTeamSearch(searchText),
              options: isUserOnly ? userOnlyOptions : userTeamOptions,
            },
            required: true,
            rules: requiredRule,
            type: FieldTypes.USER_TEAM_SELECT_INPUT,
          };
        }
        case 'integer':
        case 'number': {
          return {
            id: baseId,
            label: rf.fieldLabel,
            name: baseName,
            placeholder: rf.fieldLabel,
            props: { 'data-testid': dataTestId },
            required: true,
            rules: requiredRule,
            type: FieldTypes.NUMBER,
          };
        }
        case 'string':
        default: {
          return {
            id: baseId,
            label: rf.fieldLabel,
            name: baseName,
            placeholder: rf.fieldLabel,
            props: { 'data-testid': dataTestId },
            required: true,
            rules: requiredRule,
            type: FieldTypes.TEXT,
          };
        }
      }
    });
  }, [
    extensionRequiredFields,
    customProperties,
    t,
    debouncedUserTeamSearch,
    handleUserTeamFocus,
    userOnlyOptions,
    userTeamOptions,
  ]);

  const descriptionRequiredRule = useMemo(
    () => ({
      required:
        intakeFormRequiredMessage('description') ??
        t('label.field-required', { field: t('label.description') }),
    }),
    [intakeFormRequiredMessage, t]
  );

  const glossaryTermsRequiredRule = useMemo(() => {
    const message = intakeFormRequiredMessage('glossaryTerms');

    return message ? { required: message } : undefined;
  }, [intakeFormRequiredMessage]);

  const isDataProduct = type === DomainFormType.DATA_PRODUCT;
  const isDomain =
    type === DomainFormType.DOMAIN || type === DomainFormType.SUBDOMAIN;

  // Unwrap the picker wrapper ({ id, label, value }) on extension fields onto
  // the raw enum string / EntityReference the API expects, before the parent's
  // onSubmit runs, so callers don't need to know about the picker contract.
  const handleSubmit = useCallback(
    (data: DomainFormValues) =>
      onSubmit({
        ...data,
        extension: normalizeExtensionForApi(data.extension),
      }),
    [onSubmit]
  );

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-6"
      data-testid="add-domain-form"
      form={form}
      onSubmit={form.handleSubmit(handleSubmit)}>
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
        rules={descriptionRequiredRule}>
        {({ field, fieldState }) => (
          <Box
            aria-invalid={fieldState.invalid || undefined}
            className="tw:gap-[6px]"
            direction="col">
            <FormItemLabel required label={t('label.description')} />
            <RichTextEditor
              className="add-domain-form-description new-form-style"
              initialValue=""
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
      <FormField
        control={form.control}
        name="glossaryTerms"
        rules={glossaryTermsRequiredRule}>
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

      {isDomain && (
        <div data-testid="domainType">{getField(domainTypeField)}</div>
      )}

      {isDataProduct && !parentDomain && (
        <div data-testid="domain-select">{getField(domainField)}</div>
      )}

      {isDataProduct && (
        <>
          <div>{getField(dataProductTypeField)}</div>
          <div>{getField(visibilityField)}</div>
          <div>{getField(portfolioPriorityField)}</div>
        </>
      )}

      <div>{getField(ownersField)}</div>
      <div>{getField(expertsField)}</div>
      {isDataProduct && <div>{getField(reviewersField)}</div>}

      {extensionFields.map((field) => (
        <div key={field.id}>{getField(field)}</div>
      ))}

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
