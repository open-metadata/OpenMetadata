/*
 *  Copyright 2026 Collate.
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
  Alert,
  Box,
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit03 } from '@untitledui/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import { Operation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import type { EntityReference } from '../../../generated/entity/type';
import type { TagLabel } from '../../../generated/type/tagLabel';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { buildDomainFilter } from '../../../utils/elasticsearchQueryBuilder';
import MetricReferencePicker from '../MetricReferencePicker/MetricReferencePicker';

interface MetricMetadataEditorProps {
  metric: Metric;
  permissions: OperationPermission;
  onUpdate: (updatedData: Metric, key?: keyof Metric) => Promise<void>;
}

const tagToReference = (
  tag: TagLabel,
  type: EntityType.GLOSSARY_TERM | EntityType.TAG
): EntityReference => ({
  fullyQualifiedName: tag.tagFQN,
  id: tag.tagFQN,
  name: tag.name ?? tag.tagFQN,
  ...(tag.displayName ? { displayName: tag.displayName } : {}),
  type,
});

const referenceFqn = (reference: EntityReference) =>
  reference.fullyQualifiedName ?? reference.name ?? reference.id;

const referencesToTags = (
  references: EntityReference[],
  source: TagSource,
  existingTags: TagLabel[]
): TagLabel[] => {
  const existingByFqn = new Map(existingTags.map((tag) => [tag.tagFQN, tag]));

  return references.map((reference) => {
    const tagFQN = referenceFqn(reference);

    return (
      existingByFqn.get(tagFQN) ?? {
        displayName: reference.displayName,
        labelType: LabelType.Manual,
        name: reference.name,
        source,
        state: State.Confirmed,
        tagFQN,
      }
    );
  });
};

const isTierReference = (reference: EntityReference) =>
  referenceFqn(reference).startsWith('Tier.');

const finiteSelectionLimit = (limit: number) =>
  Number.isFinite(limit) ? limit : undefined;

const referencesOrEmpty = (references?: EntityReference[]) => references ?? [];

interface MetricEditorPermissions {
  canEditCustomProperties: boolean;
  canEditDataProducts: boolean;
  canEditDomains: boolean;
  canEditGlossaryTerms: boolean;
  canEditOwners: boolean;
  canEditTags: boolean;
  canEditTier: boolean;
}

const getMetricEditorPermissions = (
  permissions: OperationPermission
): MetricEditorPermissions => ({
  canEditOwners: Boolean(
    permissions.EditAll || permissions[Operation.EditOwners]
  ),
  canEditDomains: Boolean(permissions.EditAll),
  canEditDataProducts: Boolean(permissions.EditAll),
  canEditTier: Boolean(permissions.EditAll || permissions[Operation.EditTier]),
  canEditGlossaryTerms: Boolean(
    permissions.EditAll || permissions[Operation.EditGlossaryTerms]
  ),
  canEditTags: Boolean(permissions.EditAll || permissions[Operation.EditTags]),
  canEditCustomProperties: Boolean(
    permissions.EditAll || permissions[Operation.EditCustomFields]
  ),
});

const parseMetricExtension = (
  canEdit: boolean,
  extensionJson: string,
  currentExtension: Metric['extension'],
  invalidMessage: string
) => {
  if (!canEdit) {
    return currentExtension;
  }

  const extension = JSON.parse(extensionJson);
  if (
    [
      extension === null,
      typeof extension !== 'object',
      Array.isArray(extension),
    ].some(Boolean)
  ) {
    throw new Error(invalidMessage);
  }

  return extension;
};

interface MetricEditorValues {
  classificationTags: EntityReference[];
  dataProducts: EntityReference[];
  domains: EntityReference[];
  experts: EntityReference[];
  extension: Metric['extension'];
  glossaryTerms: EntityReference[];
  owners: EntityReference[];
  reviewers: EntityReference[];
  tier: EntityReference[];
}

const buildMetricUpdate = (
  metric: Metric,
  editorPermissions: MetricEditorPermissions,
  values: MetricEditorValues,
  initialValues: Pick<
    MetricEditorValues,
    'classificationTags' | 'glossaryTerms' | 'tier'
  >,
  existingTags: TagLabel[]
): Metric => ({
  ...metric,
  dataProducts: editorPermissions.canEditDataProducts
    ? values.dataProducts
    : metric.dataProducts,
  domains: editorPermissions.canEditDomains ? values.domains : metric.domains,
  experts: editorPermissions.canEditOwners ? values.experts : metric.experts,
  extension: values.extension,
  owners: editorPermissions.canEditOwners ? values.owners : metric.owners,
  reviewers: editorPermissions.canEditOwners
    ? values.reviewers
    : metric.reviewers,
  tags: [
    ...referencesToTags(
      editorPermissions.canEditTier ? values.tier : initialValues.tier,
      TagSource.Classification,
      existingTags
    ),
    ...referencesToTags(
      editorPermissions.canEditGlossaryTerms
        ? values.glossaryTerms
        : initialValues.glossaryTerms,
      TagSource.Glossary,
      existingTags
    ),
    ...referencesToTags(
      editorPermissions.canEditTags
        ? values.classificationTags
        : initialValues.classificationTags,
      TagSource.Classification,
      existingTags
    ),
  ],
});

interface OwnerPickersProps {
  areEntityRulesLoading: boolean;
  canEdit: boolean;
  experts: EntityReference[];
  isSaving: boolean;
  owners: EntityReference[];
  reviewers: EntityReference[];
  selectionResolver: (
    currentOwners: EntityReference[],
    reference: EntityReference,
    isSelected: boolean
  ) => EntityReference[];
  onExpertsChange: (experts: EntityReference[]) => void;
  onOwnersChange: (owners: EntityReference[]) => void;
  onReviewersChange: (reviewers: EntityReference[]) => void;
}

const OwnerPickers = ({
  areEntityRulesLoading,
  canEdit,
  experts,
  isSaving,
  owners,
  reviewers,
  selectionResolver,
  onExpertsChange,
  onOwnersChange,
  onReviewersChange,
}: OwnerPickersProps) => {
  const { t } = useTranslation();

  if (!canEdit) {
    return null;
  }

  return (
    <>
      <MetricReferencePicker
        isDisabled={isSaving || areEntityRulesLoading}
        label={t('label.owner-plural')}
        searchIndexes={[SearchIndex.USER, SearchIndex.TEAM]}
        selected={owners}
        selectionResolver={selectionResolver}
        onChange={onOwnersChange}
      />
      <MetricReferencePicker
        isDisabled={isSaving}
        label={t('label.expert-plural')}
        searchIndexes={[SearchIndex.USER]}
        selected={experts}
        onChange={onExpertsChange}
      />
      <MetricReferencePicker
        isDisabled={isSaving}
        label={t('label.reviewer-plural')}
        searchIndexes={[SearchIndex.USER, SearchIndex.TEAM]}
        selected={reviewers}
        onChange={onReviewersChange}
      />
    </>
  );
};

interface DomainPickersProps {
  areEntityRulesLoading: boolean;
  canEditDataProducts: boolean;
  canEditDomains: boolean;
  dataProductDomainFqns: string[];
  dataProductQueryFilter?: Record<string, unknown>;
  dataProducts: EntityReference[];
  domains: EntityReference[];
  isDataProductPickerDisabled: boolean;
  isSaving: boolean;
  maxDataProducts: number;
  maxDomains: number;
  requireDomainForDataProduct: boolean;
  onDataProductsChange: (dataProducts: EntityReference[]) => void;
  onDomainsChange: (domains: EntityReference[]) => void;
}

const DomainPickers = ({
  areEntityRulesLoading,
  canEditDataProducts,
  canEditDomains,
  dataProductDomainFqns,
  dataProductQueryFilter,
  dataProducts,
  domains,
  isDataProductPickerDisabled,
  isSaving,
  maxDataProducts,
  maxDomains,
  requireDomainForDataProduct,
  onDataProductsChange,
  onDomainsChange,
}: DomainPickersProps) => {
  const { t } = useTranslation();
  const showDomainRequirement =
    requireDomainForDataProduct && dataProductDomainFqns.length === 0;

  return (
    <>
      {canEditDomains && (
        <MetricReferencePicker
          isDisabled={isSaving || areEntityRulesLoading}
          label={t('label.domain-plural')}
          maxSelections={finiteSelectionLimit(maxDomains)}
          searchIndexes={[SearchIndex.DOMAIN]}
          selected={domains}
          onChange={onDomainsChange}
        />
      )}
      {canEditDataProducts && (
        <>
          {showDomainRequirement && (
            <Alert
              title={t('message.select-domain-to-add-data-product')}
              variant="warning"
            />
          )}
          <MetricReferencePicker
            isDisabled={isDataProductPickerDisabled}
            label={t('label.data-product-plural')}
            maxSelections={finiteSelectionLimit(maxDataProducts)}
            queryFilter={dataProductQueryFilter}
            searchIndexes={[SearchIndex.DATA_PRODUCT]}
            selected={dataProducts}
            onChange={onDataProductsChange}
          />
        </>
      )}
    </>
  );
};

interface TaxonomyPickersProps {
  areEntityRulesLoading: boolean;
  canAddMultipleGlossaryTerm: boolean;
  canEditGlossaryTerms: boolean;
  canEditTags: boolean;
  canEditTier: boolean;
  classificationTags: EntityReference[];
  glossaryTerms: EntityReference[];
  isSaving: boolean;
  tier: EntityReference[];
  onClassificationTagsChange: (tags: EntityReference[]) => void;
  onGlossaryTermsChange: (terms: EntityReference[]) => void;
  onTierChange: (tier: EntityReference[]) => void;
}

const TaxonomyPickers = ({
  areEntityRulesLoading,
  canAddMultipleGlossaryTerm,
  canEditGlossaryTerms,
  canEditTags,
  canEditTier,
  classificationTags,
  glossaryTerms,
  isSaving,
  tier,
  onClassificationTagsChange,
  onGlossaryTermsChange,
  onTierChange,
}: TaxonomyPickersProps) => {
  const { t } = useTranslation();

  return (
    <>
      {canEditTier && (
        <MetricReferencePicker
          identityField="fullyQualifiedName"
          initialSearch="Tier"
          isDisabled={isSaving}
          label={t('label.tier')}
          maxSelections={1}
          optionFilter={isTierReference}
          searchIndexes={[SearchIndex.TAG]}
          selected={tier}
          onChange={onTierChange}
        />
      )}
      {canEditGlossaryTerms && (
        <MetricReferencePicker
          identityField="fullyQualifiedName"
          isDisabled={isSaving || areEntityRulesLoading}
          label={t('label.glossary-term-plural')}
          maxSelections={canAddMultipleGlossaryTerm ? undefined : 1}
          searchIndexes={[SearchIndex.GLOSSARY_TERM]}
          selected={glossaryTerms}
          onChange={onGlossaryTermsChange}
        />
      )}
      {canEditTags && (
        <MetricReferencePicker
          identityField="fullyQualifiedName"
          isDisabled={isSaving}
          label={t('label.tag-plural')}
          optionFilter={(reference) => !isTierReference(reference)}
          searchIndexes={[SearchIndex.TAG]}
          selected={classificationTags}
          onChange={onClassificationTagsChange}
        />
      )}
    </>
  );
};

interface CustomPropertiesEditorProps {
  canEdit: boolean;
  extensionError?: string;
  extensionJson: string;
  isSaving: boolean;
  onChange: (value: string) => void;
}

const CustomPropertiesEditor = ({
  canEdit,
  extensionError,
  extensionJson,
  isSaving,
  onChange,
}: CustomPropertiesEditorProps) => {
  const { t } = useTranslation();

  if (!canEdit) {
    return null;
  }

  return (
    <Box direction="col" gap={2}>
      <Typography size="text-sm" weight="medium">
        {t('label.custom-property-plural')}
      </Typography>
      <TextArea
        aria-label={t('label.custom-property-plural')}
        data-testid="metric-extension-json"
        hint={extensionError}
        isDisabled={isSaving}
        isInvalid={Boolean(extensionError)}
        rows={10}
        value={extensionJson}
        onChange={onChange}
      />
    </Box>
  );
};

const MetricMetadataEditor = ({
  metric,
  onUpdate,
  permissions,
}: MetricMetadataEditorProps) => {
  const { t } = useTranslation();
  const { entityRules, isLoading: areEntityRulesLoading } = useEntityRules(
    EntityType.METRIC
  );
  const existingTags = useMemo(() => metric.tags ?? [], [metric.tags]);
  const editorPermissions = getMetricEditorPermissions(permissions);
  const {
    canEditCustomProperties,
    canEditDataProducts,
    canEditDomains,
    canEditGlossaryTerms,
    canEditOwners,
    canEditTags,
    canEditTier,
  } = editorPermissions;
  const canEdit =
    !metric.deleted && Object.values(editorPermissions).some(Boolean);
  const initialTier = useMemo(
    () =>
      existingTags
        .filter(({ tagFQN }) => tagFQN.startsWith('Tier.'))
        .map((tag) => tagToReference(tag, EntityType.TAG)),
    [existingTags]
  );
  const initialGlossaryTerms = useMemo(
    () =>
      existingTags
        .filter(({ source }) => source === TagSource.Glossary)
        .map((tag) => tagToReference(tag, EntityType.GLOSSARY_TERM)),
    [existingTags]
  );
  const initialClassificationTags = useMemo(
    () =>
      existingTags
        .filter(
          ({ source, tagFQN }) =>
            source !== TagSource.Glossary && !tagFQN.startsWith('Tier.')
        )
        .map((tag) => tagToReference(tag, EntityType.TAG)),
    [existingTags]
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [extensionError, setExtensionError] = useState<string>();
  const [owners, setOwners] = useState(referencesOrEmpty(metric.owners));
  const [experts, setExperts] = useState(referencesOrEmpty(metric.experts));
  const [reviewers, setReviewers] = useState(
    referencesOrEmpty(metric.reviewers)
  );
  const [domains, setDomains] = useState(referencesOrEmpty(metric.domains));
  const [dataProducts, setDataProducts] = useState(
    referencesOrEmpty(metric.dataProducts)
  );
  const [tier, setTier] = useState(initialTier);
  const [glossaryTerms, setGlossaryTerms] = useState(initialGlossaryTerms);
  const [classificationTags, setClassificationTags] = useState(
    initialClassificationTags
  );
  const [extensionJson, setExtensionJson] = useState(
    JSON.stringify(metric.extension ?? {}, null, 2)
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setOwners(metric.owners ?? []);
    setExperts(metric.experts ?? []);
    setReviewers(metric.reviewers ?? []);
    const metricDomains = metric.domains ?? [];
    setDomains(metricDomains);
    setDataProducts(
      entityRules.requireDomainForDataProduct && metricDomains.length === 0
        ? []
        : metric.dataProducts ?? []
    );
    setTier(initialTier);
    setGlossaryTerms(initialGlossaryTerms);
    setClassificationTags(initialClassificationTags);
    setExtensionJson(JSON.stringify(metric.extension ?? {}, null, 2));
    setExtensionError(undefined);
    setSaveError(false);
  }, [
    entityRules.requireDomainForDataProduct,
    initialClassificationTags,
    initialGlossaryTerms,
    initialTier,
    isOpen,
    metric,
  ]);

  useEffect(() => {
    if (entityRules.requireDomainForDataProduct && domains.length === 0) {
      setDataProducts([]);
    }
  }, [domains.length, entityRules.requireDomainForDataProduct]);

  const ownerSelectionResolver = useCallback(
    (
      currentOwners: EntityReference[],
      reference: EntityReference,
      isSelected: boolean
    ) => {
      if (!isSelected) {
        return currentOwners.filter(({ id }) => id !== reference.id);
      }
      if (currentOwners.some(({ id }) => id === reference.id)) {
        return currentOwners;
      }
      if (
        entityRules.canAddMultipleUserOwners &&
        entityRules.canAddMultipleTeamOwner
      ) {
        return [...currentOwners, reference];
      }

      const canAddMultipleReferenceType =
        reference.type === EntityType.USER
          ? entityRules.canAddMultipleUserOwners
          : entityRules.canAddMultipleTeamOwner;

      return canAddMultipleReferenceType
        ? [
            ...currentOwners.filter(({ type }) => type === reference.type),
            reference,
          ]
        : [reference];
    },
    [entityRules.canAddMultipleTeamOwner, entityRules.canAddMultipleUserOwners]
  );
  const handleDomainsChange = useCallback(
    (nextDomains: EntityReference[]) => {
      if (entityRules.requireDomainForDataProduct) {
        const nextDomainIds = new Set(nextDomains.map(({ id }) => id));
        const removedDomain = domains.some(({ id }) => !nextDomainIds.has(id));
        if (removedDomain) {
          setDataProducts([]);
        }
      }
      setDomains(nextDomains);
    },
    [domains, entityRules.requireDomainForDataProduct]
  );
  const dataProductDomainFqns = useMemo(
    () =>
      domains.flatMap(({ fullyQualifiedName }) =>
        fullyQualifiedName ? [fullyQualifiedName] : []
      ),
    [domains]
  );
  const dataProductQueryFilter = useMemo(
    () =>
      entityRules.requireDomainForDataProduct
        ? buildDomainFilter(dataProductDomainFqns)
        : undefined,
    [dataProductDomainFqns, entityRules.requireDomainForDataProduct]
  );
  const isDataProductPickerDisabled =
    isSaving ||
    areEntityRulesLoading ||
    (entityRules.requireDomainForDataProduct &&
      dataProductDomainFqns.length === 0);

  const handleSave = async () => {
    let extension: Metric['extension'];
    try {
      extension = parseMetricExtension(
        canEditCustomProperties,
        extensionJson,
        metric.extension,
        t('label.invalid')
      );
    } catch (error) {
      setExtensionError(
        t('message.manifest-invalid-json', {
          error: error instanceof Error ? error.message : String(error),
        })
      );

      return;
    }

    setIsSaving(true);
    setSaveError(false);
    try {
      await onUpdate(
        buildMetricUpdate(
          metric,
          editorPermissions,
          {
            classificationTags,
            dataProducts,
            domains,
            experts,
            extension,
            glossaryTerms,
            owners,
            reviewers,
            tier,
          },
          {
            classificationTags: initialClassificationTags,
            glossaryTerms: initialGlossaryTerms,
            tier: initialTier,
          },
          existingTags
        )
      );
      setIsOpen(false);
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    return null;
  }

  return (
    <>
      <Button
        aria-label={t('label.edit')}
        color="tertiary"
        data-testid="edit-metric-metadata"
        iconLeading={Edit03}
        size="xxs"
        onPress={() => setIsOpen(true)}
      />
      {isOpen && (
        <ModalOverlay
          isOpen
          isDismissable={!isSaving}
          onOpenChange={(open) => !open && !isSaving && setIsOpen(false)}>
          <Modal>
            <Dialog
              showCloseButton
              data-testid="metric-metadata-edit-dialog"
              title={t('label.edit-entity', { entity: t('label.metadata') })}
              width={720}
              onClose={() => !isSaving && setIsOpen(false)}>
              <Dialog.Content className="tw:max-h-[70vh] tw:overflow-y-auto">
                <Box aria-busy={isSaving} direction="col" gap={4}>
                  {saveError && (
                    <Alert
                      title={t('server.entity-updating-error', {
                        entityName: metric.name,
                      })}
                      variant="error"
                    />
                  )}
                  <OwnerPickers
                    areEntityRulesLoading={areEntityRulesLoading}
                    canEdit={canEditOwners}
                    experts={experts}
                    isSaving={isSaving}
                    owners={owners}
                    reviewers={reviewers}
                    selectionResolver={ownerSelectionResolver}
                    onExpertsChange={setExperts}
                    onOwnersChange={setOwners}
                    onReviewersChange={setReviewers}
                  />
                  <DomainPickers
                    areEntityRulesLoading={areEntityRulesLoading}
                    canEditDataProducts={canEditDataProducts}
                    canEditDomains={canEditDomains}
                    dataProductDomainFqns={dataProductDomainFqns}
                    dataProductQueryFilter={dataProductQueryFilter}
                    dataProducts={dataProducts}
                    domains={domains}
                    isDataProductPickerDisabled={isDataProductPickerDisabled}
                    isSaving={isSaving}
                    maxDataProducts={entityRules.maxDataProducts}
                    maxDomains={entityRules.maxDomains}
                    requireDomainForDataProduct={
                      entityRules.requireDomainForDataProduct
                    }
                    onDataProductsChange={setDataProducts}
                    onDomainsChange={handleDomainsChange}
                  />
                  <TaxonomyPickers
                    areEntityRulesLoading={areEntityRulesLoading}
                    canAddMultipleGlossaryTerm={
                      entityRules.canAddMultipleGlossaryTerm
                    }
                    canEditGlossaryTerms={canEditGlossaryTerms}
                    canEditTags={canEditTags}
                    canEditTier={canEditTier}
                    classificationTags={classificationTags}
                    glossaryTerms={glossaryTerms}
                    isSaving={isSaving}
                    tier={tier}
                    onClassificationTagsChange={setClassificationTags}
                    onGlossaryTermsChange={setGlossaryTerms}
                    onTierChange={setTier}
                  />
                  <CustomPropertiesEditor
                    canEdit={canEditCustomProperties}
                    extensionError={extensionError}
                    extensionJson={extensionJson}
                    isSaving={isSaving}
                    onChange={(value) => {
                      setExtensionJson(value);
                      setExtensionError(undefined);
                    }}
                  />
                </Box>
              </Dialog.Content>
              <Dialog.Footer>
                <Button
                  color="secondary"
                  isDisabled={isSaving}
                  onPress={() => setIsOpen(false)}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="save-metric-metadata"
                  isLoading={isSaving}
                  onPress={handleSave}>
                  {t('label.save')}
                </Button>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </>
  );
};

export default MetricMetadataEditor;
