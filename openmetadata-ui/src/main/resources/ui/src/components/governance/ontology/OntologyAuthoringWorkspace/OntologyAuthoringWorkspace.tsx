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
  Input,
  ProgressBar,
  Select,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronRight, Search } from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import OntologyConceptEditor from '../OntologyConceptEditor/OntologyConceptEditor';
import { CONCEPT_TYPE_LABELS } from '../OntologyConceptEditor/OntologyConceptEditor.utils';
import OntologyPropertyEditor from '../OntologyPropertyEditor/OntologyPropertyEditor';
import OntologyConceptCreateDrawer from './OntologyConceptCreateDrawer';
import OntologyDefinitionList, {
  DefinitionColumn,
} from './OntologyDefinitionList';
import {
  completenessColor,
  ConceptLevelFilter,
  countPropertiesByKind,
  filterConcepts,
  formatParents,
  getConceptRowFacts,
  iriLabel,
  matchesSearch,
} from './OntologyDefinitionTable.utils';

interface OntologyAuthoringWorkspaceProps {
  ontology: Ontology;
  definitionType?: 'concept' | 'property';
  onWorkingChange?: () => void;
  /** Opens a concept in the graph's concept panel. */
  onOpenConcept?: (conceptId: string) => void;
  /** View mode: the list is browsable but not editable. */
  isReadOnly?: boolean;
  /** View mode's Add, which switches to Edit. */
  onRequestCreate?: () => void;
  /** Opens the create form once, after View mode's Add switched to Edit. */
  shouldOpenCreate?: boolean;
  onCreateOpened?: () => void;
}

const ALL = 'all';
const EMPTY = '—';
const KIND_BADGE_COLORS = {
  [Kind.Object]: 'purple',
  [Kind.Data]: 'success',
  [Kind.Annotation]: 'gray',
} as const;

const useCanCreate = (
  ontology: Ontology,
  resource: ResourceEntity.ONTOLOGY_CONCEPT | ResourceEntity.ONTOLOGY_PROPERTY
) => {
  const { permissions } = usePermissionProvider();

  return getDerivedPermissionFlags(
    permissions[resource] ?? DEFAULT_ENTITY_PERMISSION,
    ontology?.deleted
  ).canCreate;
};

/** Concepts a property or class editor may point at; a SKOS-only concept is not a class. */
const useConceptOptions = (
  model: ReturnType<typeof useOntologyStudioModel>['model']
) =>
  useMemo(
    () =>
      model?.concepts
        .filter(
          (concept) => concept.conceptType !== OntologyConceptType.SkosConcept
        )
        .map((concept) => ({
          iri: concept.iri,
          label: getEntityName(concept),
        })),
    [model]
  );

const SearchField = ({
  entity,
  value,
  onChange,
}: {
  entity: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Input
      aria-label={t('label.search-entity', { entity })}
      autoComplete="off"
      className="tw:w-60"
      icon={Search}
      inputDataTestId="ontology-definition-search"
      placeholder={t('label.search-entity', { entity })}
      size="sm"
      value={value}
      onChange={onChange}
    />
  );
};

const ConceptTab = ({
  ontology,
  onWorkingChange,
  onOpenConcept,
  isReadOnly,
  onRequestCreate,
  shouldOpenCreate,
  onCreateOpened,
}: Omit<OntologyAuthoringWorkspaceProps, 'definitionType'>) => {
  const { t } = useTranslation();
  const canCreate = useCanCreate(ontology, ResourceEntity.ONTOLOGY_CONCEPT);
  const { model, relations, isError, refetch } =
    useOntologyStudioModel(ontology);
  const [search, setSearch] = useState('');
  const [conceptType, setConceptType] = useState<string>(ALL);
  const [level, setLevel] = useState<ConceptLevelFilter>('any');
  const facts = useMemo(
    () => (model ? getConceptRowFacts(model, relations) : undefined),
    [model, relations]
  );
  const items = useMemo(
    () =>
      model
        ? filterConcepts(model.concepts, {
            search,
            conceptType: conceptType === ALL ? undefined : conceptType,
            level,
          })
        : undefined,
    [model, search, conceptType, level]
  );
  const conceptOptions = useConceptOptions(model);
  const plural = t('label.concept-plural');

  const count = (id: string, key: 'relations' | 'properties' | 'rules') => (
    <Typography as="span" className="tw:tabular-nums" size="text-sm">
      {facts?.get(id)?.[key] ?? 0}
    </Typography>
  );

  const columns: DefinitionColumn<OntologyConcept>[] = [
    {
      id: 'type',
      label: t('label.type'),
      width: 'tw:w-32',
      render: (concept) => (
        <Typography ellipsis as="span" color="secondary" size="text-sm">
          {concept.conceptType
            ? t(CONCEPT_TYPE_LABELS[concept.conceptType])
            : EMPTY}
        </Typography>
      ),
    },
    {
      id: 'parent',
      label: t('label.parent'),
      width: 'tw:w-28',
      render: (concept) => (
        <Typography ellipsis as="span" color="secondary" size="text-sm">
          {formatParents(facts?.get(concept.id)?.parents ?? []) || EMPTY}
        </Typography>
      ),
    },
    {
      id: 'description',
      label: t('label.description'),
      render: (concept) => (
        <Typography ellipsis as="span" color="secondary" size="text-sm">
          {concept.description || EMPTY}
        </Typography>
      ),
    },
    {
      id: 'relations',
      label: t('label.relation-plural'),
      width: 'tw:w-20',
      align: 'end',
      render: (concept) => count(concept.id, 'relations'),
    },
    {
      id: 'properties',
      label: t('label.property-plural'),
      width: 'tw:w-20',
      align: 'end',
      render: (concept) => count(concept.id, 'properties'),
    },
    {
      id: 'rules',
      label: t('label.rule-plural'),
      width: 'tw:w-16',
      align: 'end',
      render: (concept) => count(concept.id, 'rules'),
    },
    {
      id: 'completeness',
      label: t('label.completeness'),
      width: 'tw:w-32',
      render: (concept) => {
        const completeness = facts?.get(concept.id)?.completeness ?? 0;

        return (
          <ProgressBar
            aria-label={t('label.completeness')}
            color={completenessColor(completeness)}
            labelPosition="right"
            value={completeness}
          />
        );
      },
    },
    {
      id: 'updated',
      label: t('label.last-edited'),
      width: 'tw:w-30',
      render: (concept) => (
        <Typography ellipsis as="span" color="secondary" size="text-sm">
          {formatDate(concept.updatedAt) || EMPTY}
        </Typography>
      ),
    },
  ];

  const toolbar = (
    <>
      <SearchField
        entity={plural.toLocaleLowerCase()}
        value={search}
        onChange={setSearch}
      />
      <Select
        aria-label={t('label.type')}
        className="tw:w-44"
        data-testid="ontology-definition-type-filter"
        selectedKey={conceptType}
        size="sm"
        onSelectionChange={(key) => setConceptType(String(key))}>
        {[
          { id: ALL, label: t('label.all-types') },
          ...Object.values(OntologyConceptType).map((type) => ({
            id: type,
            label: t(CONCEPT_TYPE_LABELS[type]),
          })),
        ].map((option) => (
          <Select.Item id={option.id} key={option.id} label={option.label} />
        ))}
      </Select>
      <Select
        aria-label={t('label.level')}
        className="tw:w-36"
        data-testid="ontology-definition-level-filter"
        selectedKey={level}
        size="sm"
        onSelectionChange={(key) => setLevel(key as ConceptLevelFilter)}>
        {[
          { id: 'any', label: t('label.any-level') },
          { id: 'top', label: t('label.top-level-concept') },
          { id: 'child', label: t('label.has-parent') },
        ].map((option) => (
          <Select.Item id={option.id} key={option.id} label={option.label} />
        ))}
      </Select>
    </>
  );

  return (
    <OntologyDefinitionList
      canCreate={canCreate}
      columns={columns}
      definitionType="concept"
      filterKey={[search, conceptType, level].join('|')}
      isError={isError}
      isReadOnly={isReadOnly}
      items={items}
      key={ontology.id + ':concept'}
      ontology={ontology}
      renderCreate={({ close, onCreated }) => (
        <OntologyConceptCreateDrawer
          ontology={ontology}
          onClose={close}
          onCreated={onCreated}
        />
      )}
      shouldOpenCreate={shouldOpenCreate}
      summary={
        items ? `${items.length} ${plural.toLocaleLowerCase()}` : undefined
      }
      toolbar={toolbar}
      totalCount={model?.concepts.length}
      onChanged={() => {
        void refetch();
        onWorkingChange?.();
      }}
      onCreateOpened={onCreateOpened}
      onOpen={
        onOpenConcept ? (concept) => onOpenConcept(concept.id) : undefined
      }
      onRequestCreate={onRequestCreate}
      onRetry={() => void refetch()}>
      {(concept, canEdit, onSaved) =>
        concept ? (
          <OntologyConceptEditor
            canEdit={canEdit}
            concept={concept}
            concepts={conceptOptions}
            ontology={ontology}
            onSaved={onSaved}
          />
        ) : null
      }
    </OntologyDefinitionList>
  );
};

const PropertyTab = ({
  ontology,
  onWorkingChange,
  isReadOnly,
  onRequestCreate,
  shouldOpenCreate,
  onCreateOpened,
}: Omit<
  OntologyAuthoringWorkspaceProps,
  'definitionType' | 'onOpenConcept'
>) => {
  const { t } = useTranslation();
  const canCreate = useCanCreate(ontology, ResourceEntity.ONTOLOGY_PROPERTY);
  const { model, isError, refetch } = useOntologyStudioModel(ontology);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<string>(ALL);
  const nameByIri = useMemo(
    () =>
      new Map(
        (model?.concepts ?? []).map((concept) => [
          concept.iri,
          getEntityName(concept),
        ])
      ),
    [model]
  );
  const kindCounts = useMemo(
    () => countPropertiesByKind(model?.properties ?? []),
    [model]
  );
  const items = useMemo(
    () =>
      model?.properties.filter(
        (property) =>
          (kind === ALL || property.kind === kind) &&
          matchesSearch(property, search)
      ),
    [model, kind, search]
  );
  const conceptOptions = useConceptOptions(model);
  const propertyOptions = useMemo(
    () =>
      model?.properties.map((property) => ({
        iri: property.iri,
        label: getEntityName(property),
        kind: property.kind,
      })),
    [model]
  );
  const plural = t('label.property-plural');
  const labels = (iris?: string[]) =>
    (iris ?? []).map((iri) => iriLabel(iri, nameByIri)).join(', ');

  const columns: DefinitionColumn<OntologyProperty>[] = [
    {
      id: 'kind',
      label: t('label.kind'),
      width: 'tw:w-28',
      render: (property) => (
        <Badge
          color={KIND_BADGE_COLORS[property.kind]}
          size="sm"
          type="pill-color">
          {t(`label.${property.kind.toLocaleLowerCase()}`)}
        </Badge>
      ),
    },
    {
      id: 'used-by',
      label: t('label.used-by'),
      render: (property) => (
        <Typography ellipsis as="span" size="text-sm">
          {labels(property.domain) || EMPTY}
        </Typography>
      ),
    },
    {
      id: 'value-type',
      label: t('label.value-type-or-target'),
      render: (property) => (
        <Typography ellipsis as="span" color="secondary" size="text-sm">
          {labels(property.range) || EMPTY}
        </Typography>
      ),
    },
    {
      id: 'description',
      label: t('label.description'),
      render: (property) => (
        <Typography ellipsis as="span" color="secondary" size="text-sm">
          {property.description || EMPTY}
        </Typography>
      ),
    },
    {
      id: 'open',
      label: '',
      width: 'tw:w-12',
      align: 'end',
      render: () => (
        <ChevronRight aria-hidden className="tw:size-4 tw:text-fg-quaternary" />
      ),
    },
  ];

  const kindTabs = [
    {
      id: ALL,
      label: t('label.all'),
      count: model?.properties.length ?? 0,
    },
    ...[Kind.Object, Kind.Data, Kind.Annotation].map((value) => ({
      id: value,
      label: t(`label.${value.toLocaleLowerCase()}`),
      count: kindCounts[value],
    })),
  ];

  const toolbar = (
    <>
      <Tabs
        className="tw:w-auto"
        selectedKey={kind}
        onSelectionChange={(key) => setKind(String(key))}>
        <Tabs.List
          aria-label={t('label.kind')}
          data-testid="ontology-definition-kind-filter"
          size="sm"
          type="button-border">
          {kindTabs.map((tab) => (
            <Tabs.Item
              aria-label={tab.label}
              badge={tab.count}
              id={tab.id}
              key={tab.id}>
              {tab.label}
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
      <SearchField
        entity={plural.toLocaleLowerCase()}
        value={search}
        onChange={setSearch}
      />
    </>
  );

  return (
    <OntologyDefinitionList
      canCreate={canCreate}
      columns={columns}
      definitionType="property"
      filterKey={[kind, search].join('|')}
      isError={isError}
      isReadOnly={isReadOnly}
      items={items}
      key={ontology.id + ':property'}
      ontology={ontology}
      shouldOpenCreate={shouldOpenCreate}
      summary={
        items ? `${items.length} ${plural.toLocaleLowerCase()}` : undefined
      }
      toolbar={toolbar}
      totalCount={model?.properties.length}
      onChanged={() => {
        void refetch();
        onWorkingChange?.();
      }}
      onCreateOpened={onCreateOpened}
      onRequestCreate={onRequestCreate}
      onRetry={() => void refetch()}>
      {(property, canEdit, onSaved, close) => (
        <OntologyPropertyEditor
          canEdit={canEdit}
          concepts={conceptOptions}
          ontology={ontology}
          properties={propertyOptions}
          property={property}
          onCancel={close}
          onSaved={onSaved}
        />
      )}
    </OntologyDefinitionList>
  );
};

const OntologyAuthoringWorkspace = ({
  definitionType = 'concept',
  ...props
}: OntologyAuthoringWorkspaceProps) =>
  definitionType === 'concept' ? (
    <ConceptTab {...props} />
  ) : (
    <PropertyTab {...props} />
  );

export default OntologyAuthoringWorkspace;
