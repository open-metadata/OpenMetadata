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
  const canEditOwners = Boolean(
    permissions.EditAll || permissions[Operation.EditOwners]
  );
  const canEditDomains = Boolean(permissions.EditAll);
  const canEditDataProducts = Boolean(permissions.EditAll);
  const canEditTier = Boolean(
    permissions.EditAll || permissions[Operation.EditTier]
  );
  const canEditGlossaryTerms = Boolean(
    permissions.EditAll || permissions[Operation.EditGlossaryTerms]
  );
  const canEditTags = Boolean(
    permissions.EditAll || permissions[Operation.EditTags]
  );
  const canEditCustomProperties = Boolean(
    permissions.EditAll || permissions[Operation.EditCustomFields]
  );
  const canEdit =
    !metric.deleted &&
    (canEditOwners ||
      canEditDomains ||
      canEditDataProducts ||
      canEditTier ||
      canEditGlossaryTerms ||
      canEditTags ||
      canEditCustomProperties);
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
  const [owners, setOwners] = useState(metric.owners ?? []);
  const [experts, setExperts] = useState(metric.experts ?? []);
  const [reviewers, setReviewers] = useState(metric.reviewers ?? []);
  const [domains, setDomains] = useState(metric.domains ?? []);
  const [dataProducts, setDataProducts] = useState(metric.dataProducts ?? []);
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
    let extension = metric.extension;
    if (canEditCustomProperties) {
      try {
        extension = JSON.parse(extensionJson);
        if (
          extension === null ||
          typeof extension !== 'object' ||
          Array.isArray(extension)
        ) {
          throw new Error(t('label.invalid'));
        }
      } catch (error) {
        setExtensionError(
          t('message.manifest-invalid-json', {
            error: error instanceof Error ? error.message : String(error),
          })
        );

        return;
      }
    }

    setIsSaving(true);
    setSaveError(false);
    try {
      await onUpdate({
        ...metric,
        dataProducts: canEditDataProducts ? dataProducts : metric.dataProducts,
        domains: canEditDomains ? domains : metric.domains,
        experts: canEditOwners ? experts : metric.experts,
        extension,
        owners: canEditOwners ? owners : metric.owners,
        reviewers: canEditOwners ? reviewers : metric.reviewers,
        tags: [
          ...referencesToTags(
            canEditTier ? tier : initialTier,
            TagSource.Classification,
            existingTags
          ),
          ...referencesToTags(
            canEditGlossaryTerms ? glossaryTerms : initialGlossaryTerms,
            TagSource.Glossary,
            existingTags
          ),
          ...referencesToTags(
            canEditTags ? classificationTags : initialClassificationTags,
            TagSource.Classification,
            existingTags
          ),
        ],
      });
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
                  {canEditOwners && (
                    <>
                      <MetricReferencePicker
                        isDisabled={isSaving || areEntityRulesLoading}
                        label={t('label.owner-plural')}
                        searchIndexes={[SearchIndex.USER, SearchIndex.TEAM]}
                        selected={owners}
                        selectionResolver={ownerSelectionResolver}
                        onChange={setOwners}
                      />
                      <MetricReferencePicker
                        isDisabled={isSaving}
                        label={t('label.expert-plural')}
                        searchIndexes={[SearchIndex.USER]}
                        selected={experts}
                        onChange={setExperts}
                      />
                      <MetricReferencePicker
                        isDisabled={isSaving}
                        label={t('label.reviewer-plural')}
                        searchIndexes={[SearchIndex.USER, SearchIndex.TEAM]}
                        selected={reviewers}
                        onChange={setReviewers}
                      />
                    </>
                  )}
                  {canEditDomains && (
                    <MetricReferencePicker
                      isDisabled={isSaving || areEntityRulesLoading}
                      label={t('label.domain-plural')}
                      maxSelections={finiteSelectionLimit(
                        entityRules.maxDomains
                      )}
                      searchIndexes={[SearchIndex.DOMAIN]}
                      selected={domains}
                      onChange={handleDomainsChange}
                    />
                  )}
                  {canEditDataProducts && (
                    <>
                      {entityRules.requireDomainForDataProduct &&
                        dataProductDomainFqns.length === 0 && (
                          <Alert
                            title={t(
                              'message.select-domain-to-add-data-product'
                            )}
                            variant="warning"
                          />
                        )}
                      <MetricReferencePicker
                        isDisabled={isDataProductPickerDisabled}
                        label={t('label.data-product-plural')}
                        maxSelections={finiteSelectionLimit(
                          entityRules.maxDataProducts
                        )}
                        queryFilter={dataProductQueryFilter}
                        searchIndexes={[SearchIndex.DATA_PRODUCT]}
                        selected={dataProducts}
                        onChange={setDataProducts}
                      />
                    </>
                  )}
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
                      onChange={setTier}
                    />
                  )}
                  {canEditGlossaryTerms && (
                    <MetricReferencePicker
                      identityField="fullyQualifiedName"
                      isDisabled={isSaving || areEntityRulesLoading}
                      label={t('label.glossary-term-plural')}
                      maxSelections={
                        entityRules.canAddMultipleGlossaryTerm ? undefined : 1
                      }
                      searchIndexes={[SearchIndex.GLOSSARY_TERM]}
                      selected={glossaryTerms}
                      onChange={setGlossaryTerms}
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
                      onChange={setClassificationTags}
                    />
                  )}
                  {canEditCustomProperties && (
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
                        onChange={(value) => {
                          setExtensionJson(value);
                          setExtensionError(undefined);
                        }}
                      />
                    </Box>
                  )}
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
