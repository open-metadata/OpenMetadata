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
  Badge,
  Box,
  Button,
  ButtonUtility,
  Checkbox,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowLeft,
  Edit05,
  Plus,
} from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getInverseRelationLabel } from '../../../../utils/governance/ontology/OntologyNativeRelation.utils';
import {
  DataPropertyInput,
  getConceptAncestors,
  getConceptPropertyRows,
  getConceptRelationRows,
  getModelRelationLabel,
  getPropertyLabel,
  humanizeName,
  OntologyModelRelation,
  OntologyStudioModel,
  StudioDatatype,
  STUDIO_DATATYPES,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import {
  InspectorEmptyText,
  InspectorList,
  InspectorRow,
  InspectorSection,
  InspectorSectionHeading,
} from '../../../OntologyExplorer/OntologyInspectorSection';
import RelationshipTypePicker from '../../../OntologyExplorer/RelationshipTypePicker.component';
import { RelationTypeOptionGroup } from '../../../OntologyExplorer/RelationshipTypePicker.interface';
import OntologyConceptAssets from './OntologyConceptAssets';
import OntologyPropertyBindings from './OntologyPropertyBindings';

interface OntologyConceptInspectorProps {
  readonly concept: OntologyConcept;
  readonly model: OntologyStudioModel;
  readonly relations: OntologyModelRelation[];
  readonly canAddProperty?: boolean;
  readonly canAddRelation?: boolean;
  readonly canCreateRelationType?: boolean;
  readonly relationTypeGroups?: RelationTypeOptionGroup[];
  readonly onAddProperty?: (input: DataPropertyInput) => Promise<boolean>;
  readonly onAddRelation?: (
    targetId: string,
    relationType: string
  ) => Promise<boolean>;
  readonly onClose: () => void;
  readonly onEdit?: () => void;
  readonly onEditMappings?: () => void;
  readonly canEditBindings?: boolean;
  readonly onSelectConcept: (concept: OntologyConcept) => void;
}

interface PropertyAuthoringProps {
  readonly isAvailable: boolean;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onOpen: () => void;
  readonly onSave: (input: DataPropertyInput) => Promise<boolean>;
}

const getEnumValues = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const PropertyAuthoring = ({
  isAvailable,
  isOpen,
  onClose,
  onOpen,
  onSave,
}: PropertyAuthoringProps) => {
  const { t } = useTranslation();
  const [propertyName, setPropertyName] = useState('');
  const [datatype, setDatatype] = useState<StudioDatatype>('string');
  const [enumValues, setEnumValues] = useState('');
  const [isIdentifier, setIsIdentifier] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const parsedEnumValues = getEnumValues(enumValues);
  const canSubmit =
    Boolean(propertyName.trim()) &&
    (datatype !== 'enum' || parsedEnumValues.length > 0);

  const save = async () => {
    setIsSaving(true);
    const saved = await onSave({
      datatype,
      enumValues: datatype === 'enum' ? parsedEnumValues : undefined,
      isIdentifier,
      name: propertyName,
    });
    setIsSaving(false);
    if (saved) {
      setPropertyName('');
      setDatatype('string');
      setEnumValues('');
      setIsIdentifier(false);
      onClose();
    }
  };

  if (!isAvailable) {
    return null;
  }
  if (!isOpen) {
    return (
      <Button
        color="secondary"
        data-testid="ontology-add-property"
        iconLeading={Plus}
        size="xs"
        onPress={onOpen}>
        {t('label.add-entity', { entity: t('label.property') })}
      </Button>
    );
  }

  return (
    <Box
      className="tw:rounded-lg tw:border tw:border-dashed tw:border-secondary tw:bg-secondary tw:p-3"
      direction="col"
      gap={3}>
      <Input
        inputDataTestId="ontology-property-name"
        isDisabled={isSaving}
        label={t('label.name')}
        size="sm"
        value={propertyName}
        onChange={setPropertyName}
      />
      <Typography color="secondary" size="text-xs" weight="semibold">
        {t('label.data-type')}
      </Typography>
      <div
        aria-label={t('label.data-type')}
        className="tw:flex tw:flex-wrap tw:gap-1.5"
        role="group">
        {STUDIO_DATATYPES.map((item) => (
          <Button
            aria-pressed={datatype === item}
            color={datatype === item ? 'primary' : 'secondary'}
            data-testid={`ontology-property-type-${item}`}
            isDisabled={isSaving}
            key={item}
            size="xs"
            onPress={() => setDatatype(item)}>
            {item}
          </Button>
        ))}
      </div>
      {datatype === 'enum' ? (
        <Input
          inputDataTestId="ontology-property-enum-values"
          isDisabled={isSaving}
          label={t('label.enum-value-plural')}
          size="sm"
          value={enumValues}
          onChange={setEnumValues}
        />
      ) : null}
      <Checkbox
        data-testid="ontology-property-identifier"
        isDisabled={isSaving}
        isSelected={isIdentifier}
        label={t('label.identifier')}
        onChange={setIsIdentifier}
      />
      <Box gap={2}>
        <Button
          data-testid="ontology-property-submit"
          isDisabled={!canSubmit}
          isLoading={isSaving}
          size="xs"
          onPress={() => void save()}>
          {t('label.add')}
        </Button>
        <Button
          color="secondary"
          isDisabled={isSaving}
          size="xs"
          onPress={onClose}>
          {t('label.cancel')}
        </Button>
      </Box>
    </Box>
  );
};

interface RelationAuthoringProps {
  readonly canCreateRelationType: boolean;
  readonly concept: OntologyConcept;
  readonly groups: RelationTypeOptionGroup[];
  readonly isAvailable: boolean;
  readonly isOpen: boolean;
  readonly model: OntologyStudioModel;
  readonly onClose: () => void;
  readonly onOpen: () => void;
  readonly onSave: (targetId: string, relationType: string) => Promise<boolean>;
}

const RelationAuthoring = ({
  canCreateRelationType,
  concept,
  groups,
  isAvailable,
  isOpen,
  model,
  onClose,
  onOpen,
  onSave,
}: RelationAuthoringProps) => {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const targetConcepts = useMemo(
    () => model.concepts.filter((candidate) => candidate.id !== concept.id),
    [concept.id, model.concepts]
  );

  const save = async () => {
    setIsSaving(true);
    const saved = await onSave(targetId, relationType);
    setIsSaving(false);
    if (saved) {
      setTargetId('');
      setRelationType('');
      onClose();
    }
  };

  if (!isAvailable) {
    return null;
  }
  if (!isOpen) {
    return (
      <Button
        color="secondary"
        data-testid="ontology-add-relationship"
        iconLeading={Plus}
        size="xs"
        onPress={onOpen}>
        {t('label.add-entity', { entity: t('label.relationship') })}
      </Button>
    );
  }

  return (
    <Box
      className="tw:rounded-lg tw:border tw:border-dashed tw:border-brand tw:bg-secondary tw:p-3"
      direction="col"
      gap={3}>
      {relationType ? (
        <>
          <Box align="center" gap={2}>
            <Badge color="brand" size="sm" type="pill-color">
              {groups
                .flatMap((group) => group.options)
                .find((option) => option.id === relationType)?.label ??
                humanizeName(relationType.replace(/^new:/, ''))}
            </Badge>
            <Button
              color="link-gray"
              size="xs"
              onPress={() => setRelationType('')}>
              {t('label.change')}
            </Button>
          </Box>
          <Select
            className="tw:w-full"
            isDisabled={isSaving}
            items={targetConcepts.map((candidate) => ({
              id: candidate.id,
              label: candidate.displayName ?? candidate.name,
            }))}
            label={t('label.target')}
            size="sm"
            value={targetId}
            onChange={(key) => setTargetId(String(key))}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
          <Box gap={2}>
            <Button
              data-testid="ontology-relationship-submit"
              isDisabled={!targetId}
              isLoading={isSaving}
              size="xs"
              onPress={() => void save()}>
              {t('label.add')}
            </Button>
            <Button
              color="secondary"
              isDisabled={isSaving}
              size="xs"
              onPress={onClose}>
              {t('label.cancel')}
            </Button>
          </Box>
        </>
      ) : (
        <RelationshipTypePicker
          canCreateType={canCreateRelationType}
          groups={groups}
          sourceLabel={concept.displayName ?? concept.name}
          targetLabel={t('label.target')}
          onCancel={onClose}
          onSelect={setRelationType}
        />
      )}
    </Box>
  );
};

const OntologyConceptInspector = ({
  concept,
  model,
  relations,
  canAddProperty = false,
  canAddRelation = false,
  canCreateRelationType = false,
  relationTypeGroups = [],
  onAddProperty,
  onAddRelation,
  onClose,
  onEdit,
  onEditMappings,
  canEditBindings = false,
  onSelectConcept,
}: OntologyConceptInspectorProps) => {
  const { t } = useTranslation();
  const [authoring, setAuthoring] = useState<'property' | 'relation'>();
  const bindings = useOntologyConceptBindings(concept.id);
  const ancestors = useMemo(
    () => getConceptAncestors(relations, concept.id),
    [relations, concept.id]
  );
  const properties = useMemo(
    () => getConceptPropertyRows(model, relations, concept),
    [concept, model, relations]
  );
  const unavailableProperties = useMemo(() => {
    const propertyIds = new Set(properties.map(({ property }) => property.id));
    const unavailable = new Map<string, string>();
    bindings.data?.assets.forEach(({ columns }) => {
      columns.forEach(({ propertyId, property }) => {
        if (!propertyIds.has(propertyId)) {
          unavailable.set(propertyId, getEntityName(property) || propertyId);
        }
      });
    });

    return [...unavailable];
  }, [bindings.data, properties]);
  const conceptRelations = useMemo(
    () => getConceptRelationRows(relations, concept.id),
    [concept.id, relations]
  );
  const mappings = concept.conceptMappings ?? [];

  const renderProperties = () => (
    <InspectorSection testId="ontology-concept-properties">
      <InspectorSectionHeading
        count={properties.length}
        label={t('label.property-plural')}
      />
      {ancestors.length > 0 ? (
        <Box align="center" gap={1} wrap="wrap">
          <Typography color="secondary" size="text-xs">
            {t('label.inherited-from')}
          </Typography>
          {ancestors.map((ancestor) => (
            <Button
              color="link-color"
              key={ancestor.id}
              size="xs"
              onPress={() => onSelectConcept(ancestor)}>
              {ancestor.displayName ?? ancestor.name}
            </Button>
          ))}
        </Box>
      ) : null}
      {bindings.data ? (
        <Typography color="secondary" size="text-xs">
          {t('label.ontology-properties-bound', {
            count: properties.filter(({ property }) =>
              bindings.data?.assets.some((asset) =>
                asset.columns.some(
                  (column) =>
                    column.propertyId === property.id &&
                    column.state === 'resolved'
                )
              )
            ).length,
            total: properties.length,
          })}
        </Typography>
      ) : null}
      {properties.length > 0 ? (
        <InspectorList>
          {properties.map(({ datatype, inheritedFrom, property }) => (
            <InspectorRow key={property.id}>
              <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
                <Box align="center" gap={2}>
                  <Typography
                    className="tw:font-mono tw:text-primary"
                    size="text-sm"
                    weight="medium">
                    {getPropertyLabel(property)}
                  </Typography>
                  {property.isIdentifier ? (
                    <Badge color="warning" size="sm" type="pill-color">
                      {t('label.identifier')}
                    </Badge>
                  ) : null}
                </Box>
                {inheritedFrom ? (
                  <Typography color="secondary" size="text-xs">
                    {t('label.inherited')} ·{' '}
                    {inheritedFrom.displayName ?? inheritedFrom.name}
                  </Typography>
                ) : null}
                <OntologyPropertyBindings
                  bindings={bindings}
                  canEdit={canEditBindings}
                  conceptId={concept.id}
                  key={concept.id}
                  propertyId={property.id}
                />
              </Box>
              <Typography
                className="tw:font-mono tw:text-utility-brand-700"
                size="text-xs"
                weight="semibold">
                {datatype}
              </Typography>
            </InspectorRow>
          ))}
        </InspectorList>
      ) : (
        <InspectorEmptyText>
          {t('message.no-data-available')}
        </InspectorEmptyText>
      )}
      {onAddProperty ? (
        <PropertyAuthoring
          isAvailable={canAddProperty}
          isOpen={authoring === 'property'}
          key={concept.id}
          onClose={() => setAuthoring(undefined)}
          onOpen={() => setAuthoring('property')}
          onSave={onAddProperty}
        />
      ) : null}
    </InspectorSection>
  );

  const renderRelationships = () => (
    <InspectorSection testId="ontology-concept-relationships">
      <InspectorSectionHeading
        count={conceptRelations.length}
        label={t('label.relationship-plural')}
      />
      {conceptRelations.length > 0 ? (
        <InspectorList>
          {conceptRelations.map(({ direction, other, relation }) => {
            const inverseLabel =
              direction === 'incoming'
                ? getInverseRelationLabel(relation, model)
                : undefined;
            const readsForward = direction === 'outgoing' || !!inverseLabel;
            const badge = (
              <Badge color="brand" size="sm" type="pill-color">
                {humanizeName(inverseLabel ?? getModelRelationLabel(relation))}
              </Badge>
            );

            return (
              <InspectorRow key={`${direction}:${relation.key}`}>
                {readsForward ? badge : null}
                <Button
                  noTextPadding
                  className="tw:min-w-0 tw:flex-1 tw:justify-start"
                  color="tertiary"
                  data-testid={`ontology-concept-relation-${other.id}`}
                  onPress={() => onSelectConcept(other)}>
                  <span className="tw:truncate">
                    {other.displayName ?? other.name}
                  </span>
                </Button>
                {readsForward ? null : badge}
              </InspectorRow>
            );
          })}
        </InspectorList>
      ) : (
        <InspectorEmptyText>
          {t('message.no-data-available')}
        </InspectorEmptyText>
      )}
      {onAddRelation ? (
        <RelationAuthoring
          canCreateRelationType={canCreateRelationType}
          concept={concept}
          groups={relationTypeGroups}
          isAvailable={canAddRelation}
          isOpen={authoring === 'relation'}
          key={concept.id}
          model={model}
          onClose={() => setAuthoring(undefined)}
          onOpen={() => setAuthoring('relation')}
          onSave={onAddRelation}
        />
      ) : null}
    </InspectorSection>
  );

  return (
    <aside
      className="tw:flex tw:h-full tw:w-75 tw:shrink-0 tw:flex-col tw:overflow-hidden tw:border-l tw:border-secondary tw:bg-surface"
      data-testid="ontology-concept-inspector">
      <Box
        align="center"
        className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-4 tw:py-3"
        gap={2}>
        <ButtonUtility
          color="tertiary"
          icon={ArrowLeft}
          size="sm"
          tooltip={t('label.close')}
          onClick={onClose}
        />
        <Typography
          className="tw:flex-1 tw:uppercase tw:tracking-wide"
          color="secondary"
          size="text-xs"
          weight="semibold">
          {t('label.concept')}
        </Typography>
        {onEdit ? (
          <Button
            color="secondary"
            data-testid="ontology-concept-edit"
            iconLeading={Edit05}
            size="xs"
            onPress={onEdit}>
            {t('label.edit')}
          </Button>
        ) : null}
      </Box>

      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-4"
        direction="col"
        gap={3}>
        <Box direction="col" gap={2}>
          <Typography as="h2" size="text-lg" weight="semibold">
            {concept.displayName ?? concept.name}
          </Typography>
          <Typography
            ellipsis
            className="tw:font-mono tw:text-xs"
            color="secondary">
            {concept.iri}
          </Typography>
          <Box gap={2} wrap="wrap">
            <Badge color="brand" size="sm" type="pill-color">
              {humanizeName(concept.conceptType)}
            </Badge>
            {concept.provider ? (
              <Badge color="gray" size="sm" type="pill-color">
                {concept.provider}
              </Badge>
            ) : null}
          </Box>
          <Typography as="p" color="secondary" size="text-sm">
            {concept.description || t('label.no-description')}
          </Typography>
        </Box>

        {renderProperties()}

        {unavailableProperties.length > 0 && (
          <InspectorSection>
            <InspectorSectionHeading
              count={unavailableProperties.length}
              label={t('label.unavailable')}
            />
            <InspectorList>
              {unavailableProperties.map(([propertyId, label]) => (
                <InspectorRow key={propertyId}>
                  <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
                    <Typography size="text-sm" weight="medium">
                      {label}
                    </Typography>
                    <OntologyPropertyBindings
                      bindings={bindings}
                      canAdd={false}
                      canEdit={canEditBindings}
                      conceptId={concept.id}
                      propertyId={propertyId}
                    />
                  </Box>
                </InspectorRow>
              ))}
            </InspectorList>
          </InspectorSection>
        )}

        {renderRelationships()}

        <InspectorSection testId="ontology-concept-mappings">
          <InspectorSectionHeading
            count={mappings.length}
            label={t('label.mapping-plural')}
          />
          {mappings.length > 0 ? (
            <InspectorList>
              {mappings.map((mapping) => (
                <InspectorRow
                  key={`${mapping.mappingType}:${mapping.conceptIri}`}>
                  <Badge color="success" size="sm" type="pill-color">
                    {humanizeName(mapping.mappingType)}
                  </Badge>
                  <Typography
                    ellipsis
                    className="tw:min-w-0 tw:flex-1 tw:font-mono"
                    size="text-xs">
                    {mapping.conceptIri}
                  </Typography>
                </InspectorRow>
              ))}
            </InspectorList>
          ) : (
            <InspectorEmptyText>
              {t('message.no-data-available')}
            </InspectorEmptyText>
          )}
          {onEditMappings ? (
            <Button
              color="secondary"
              data-testid="ontology-add-mapping"
              iconLeading={Plus}
              size="xs"
              onPress={onEditMappings}>
              {t('label.add-entity', { entity: t('label.mapping') })}
            </Button>
          ) : null}
        </InspectorSection>
        <OntologyConceptAssets
          canEdit={canEditBindings}
          conceptId={concept.id}
          key={concept.id}
        />
      </Box>
    </aside>
  );
};

export default OntologyConceptInspector;
