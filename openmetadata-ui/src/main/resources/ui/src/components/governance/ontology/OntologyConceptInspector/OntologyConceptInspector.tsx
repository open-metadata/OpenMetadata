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
import {
  DataPropertyInput,
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

interface OntologyConceptInspectorProps {
  readonly concept: OntologyConcept;
  readonly model: OntologyStudioModel;
  readonly relations: OntologyModelRelation[];
  readonly canAddProperty: boolean;
  readonly canAddRelation: boolean;
  readonly canCreateRelationType: boolean;
  readonly relationTypeGroups: RelationTypeOptionGroup[];
  readonly onAddProperty: (input: DataPropertyInput) => Promise<boolean>;
  readonly onAddRelation: (
    targetId: string,
    relationType: string
  ) => Promise<boolean>;
  readonly onClose: () => void;
  readonly onEdit?: () => void;
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
  const [isSaving, setIsSaving] = useState(false);
  const targetConcepts = useMemo(
    () => model.concepts.filter((candidate) => candidate.id !== concept.id),
    [concept.id, model.concepts]
  );
  const target = targetConcepts.find((candidate) => candidate.id === targetId);

  const save = async (relationType: string) => {
    setIsSaving(true);
    const saved = await onSave(targetId, relationType);
    setIsSaving(false);
    if (saved) {
      setTargetId('');
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
      {target && !isSaving ? (
        <RelationshipTypePicker
          canCreateType={canCreateRelationType}
          groups={groups}
          sourceLabel={concept.displayName ?? concept.name}
          targetLabel={target.displayName ?? target.name}
          onCancel={onClose}
          onSelect={(relationType) => void save(relationType)}
        />
      ) : null}
      {isSaving ? (
        <Typography role="status">{t('label.saving')}</Typography>
      ) : null}
      {!target ? (
        <Button color="secondary" size="xs" onPress={onClose}>
          {t('label.cancel')}
        </Button>
      ) : null}
    </Box>
  );
};

const OntologyConceptInspector = ({
  concept,
  model,
  relations,
  canAddProperty,
  canAddRelation,
  canCreateRelationType,
  relationTypeGroups,
  onAddProperty,
  onAddRelation,
  onClose,
  onEdit,
  onSelectConcept,
}: OntologyConceptInspectorProps) => {
  const { t } = useTranslation();
  const [authoring, setAuthoring] = useState<'property' | 'relation'>();
  const properties = useMemo(
    () => getConceptPropertyRows(model, relations, concept),
    [concept, model, relations]
  );
  const conceptRelations = useMemo(
    () => getConceptRelationRows(relations, concept.id),
    [concept.id, relations]
  );
  const mappings = concept.conceptMappings ?? [];

  return (
    <aside
      className="tw:flex tw:h-full tw:w-96 tw:shrink-0 tw:flex-col tw:overflow-hidden tw:border-l tw:border-secondary tw:bg-primary"
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
        className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-5"
        direction="col"
        gap={5}>
        <Box direction="col" gap={2}>
          <Typography as="h2" size="text-xl" weight="semibold">
            {concept.displayName ?? concept.name}
          </Typography>
          <Typography
            ellipsis
            className="tw:font-mono tw:text-xs"
            color="secondary">
            {concept.fullyQualifiedName}
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

        <InspectorSection testId="ontology-concept-properties">
          <InspectorSectionHeading
            count={properties.length}
            label={t('label.property-plural')}
          />
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
          <PropertyAuthoring
            isAvailable={canAddProperty}
            isOpen={authoring === 'property'}
            key={concept.id}
            onClose={() => setAuthoring(undefined)}
            onOpen={() => setAuthoring('property')}
            onSave={onAddProperty}
          />
        </InspectorSection>

        <InspectorSection testId="ontology-concept-relationships">
          <InspectorSectionHeading
            count={conceptRelations.length}
            label={t('label.relationship-plural')}
          />
          {conceptRelations.length > 0 ? (
            <InspectorList>
              {conceptRelations.map(({ direction, other, relation }) => (
                <InspectorRow key={`${direction}:${relation.key}`}>
                  {direction === 'outgoing' ? (
                    <Badge color="brand" size="sm" type="pill-color">
                      {humanizeName(getModelRelationLabel(relation))}
                    </Badge>
                  ) : null}
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
                  {direction === 'incoming' ? (
                    <Badge color="brand" size="sm" type="pill-color">
                      {humanizeName(getModelRelationLabel(relation))}
                    </Badge>
                  ) : null}
                </InspectorRow>
              ))}
            </InspectorList>
          ) : (
            <InspectorEmptyText>
              {t('message.no-data-available')}
            </InspectorEmptyText>
          )}
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
        </InspectorSection>

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
        </InspectorSection>
      </Box>
    </aside>
  );
};

export default OntologyConceptInspector;
