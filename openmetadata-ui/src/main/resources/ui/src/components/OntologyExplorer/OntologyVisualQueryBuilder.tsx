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
  Select,
  SelectItemType,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Play } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Ontology } from '../../generated/entity/data/ontology';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { useAuth } from '../../hooks/authHooks';
import { useOntologyStudioModel } from '../../hooks/governance/ontology/useOntologyStudioModel';
import { getGlossaryTerms } from '../../rest/glossaryAPI';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import {
  runGlossarySparqlQuery,
  runOntologySparqlQuery,
  runSparqlQuery,
  SparqlPlaygroundResult,
} from '../../rest/rdfAPI';
import {
  buildNativeVisualSparqlQuery,
  getNativeQueryRelations,
} from '../../utils/governance/ontology/OntologyNativeQuery.utils';
import { humanizeName } from '../../utils/governance/ontology/OntologyStudioModel.utils';
import { showErrorToast } from '../../utils/ToastUtils';
import { DEFAULT_RELATIONSHIP_TYPE } from './OntologyExplorer.constants';
import { OntologyGraphData, OntologyNode } from './OntologyExplorer.interface';
import OntologyQueryResults from './OntologyQueryResults';
import { getRelationshipColor } from './utils/relationshipTypeUtils';

const ONTOLOGY_NAMESPACE = 'https://open-metadata.org/ontology/';

export type VisualQueryFindKind = 'concepts' | 'metrics' | 'any';

// The RDF class each "Find" choice restricts ?concept to; "any" leaves it open.
const FIND_KIND_CLASSES: Record<VisualQueryFindKind, string | undefined> = {
  any: undefined,
  concepts: 'om:GlossaryTerm',
  metrics: 'om:Metric',
};

const FIND_KIND_LABEL_KEYS: Record<VisualQueryFindKind, string> = {
  any: 'label.any-term',
  concepts: 'label.concept-plural',
  metrics: 'label.metric-plural',
};

interface VisualQueryTerm {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
  glossaryId?: string;
}

interface OntologyVisualQueryBuilderProps {
  ontology?: Ontology;
  graphData?: OntologyGraphData | null;
  relationTypes?: RelationshipType[];
  selectedGlossaryIds?: string[];
  onEditAsSparql?: (query: string) => void;
}

function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeName(value: string | undefined): string {
  return (value ?? '').replace(/[^a-z0-9]/gi, '').toLocaleLowerCase();
}

export function buildVisualSparqlQuery(
  relationType: RelationshipType | undefined,
  target: VisualQueryTerm | undefined,
  findKind: VisualQueryFindKind = 'concepts'
): string {
  const predicate =
    relationType?.rdfPredicate ??
    `${ONTOLOGY_NAMESPACE}${encodeURIComponent(
      relationType?.name ?? 'relatedTo'
    )}`;
  const findClass = FIND_KIND_CLASSES[findKind];
  const typeFilter = findClass ? `\n  ?concept a ${findClass} .` : '';
  const targetFilter = target?.fullyQualifiedName
    ? `\n  ?target om:fullyQualifiedName "${escapeSparqlLiteral(
        target.fullyQualifiedName
      )}" .`
    : '';

  return `PREFIX om: <${ONTOLOGY_NAMESPACE}>

SELECT ?concept ?conceptFqn WHERE {
  ?concept <${predicate}> ?target ;
           om:fullyQualifiedName ?conceptFqn .${typeFilter}${targetFilter}
}
LIMIT 100`;
}

function isGlossaryTermNode(node: OntologyNode): boolean {
  return node.type === 'glossaryTerm' || node.type === 'glossaryTermIsolated';
}

function toVisualQueryTerm(term: GlossaryTerm): VisualQueryTerm {
  return {
    id: term.id,
    name: term.name,
    displayName: term.displayName,
    fullyQualifiedName: term.fullyQualifiedName,
    glossaryId: term.glossary?.id,
  };
}

function getGraphTerms(
  graphData: OntologyGraphData | null | undefined,
  selectedGlossaryIds: string[] | undefined
): VisualQueryTerm[] {
  if (!graphData) {
    return [];
  }

  return graphData.nodes
    .filter(isGlossaryTermNode)
    .filter(
      (node) =>
        !selectedGlossaryIds?.length ||
        (node.glossaryId && selectedGlossaryIds.includes(node.glossaryId))
    )
    .map((node) => ({
      id: node.id,
      name: node.originalLabel ?? node.label,
      displayName: node.label,
      fullyQualifiedName: node.fullyQualifiedName,
      glossaryId: node.glossaryId,
    }));
}

function getInitialBuilderSelection(
  graphData: OntologyGraphData | null | undefined,
  relationTypes: RelationshipType[],
  terms: VisualQueryTerm[]
): { relationName: string; targetId: string } {
  const termIds = new Set(terms.map((term) => term.id));
  const relationByNormalizedName = new Map(
    relationTypes.map((relation) => [normalizeName(relation.name), relation])
  );
  const matchingEdge = graphData?.edges.find(
    (edge) =>
      termIds.has(edge.to) &&
      relationByNormalizedName.has(normalizeName(edge.relationType))
  );
  const matchingRelation = matchingEdge
    ? relationByNormalizedName.get(normalizeName(matchingEdge.relationType))
    : undefined;
  const defaultRelation =
    matchingRelation ??
    relationTypes.find(
      (relation) => normalizeName(relation.name) === 'relatedto'
    ) ??
    relationTypes[0] ??
    DEFAULT_RELATIONSHIP_TYPE;

  return {
    relationName: defaultRelation.name,
    targetId: matchingEdge?.to ?? terms[0]?.id ?? '',
  };
}

const OntologyVisualQueryBuilder = ({
  ontology,
  graphData,
  relationTypes: suppliedRelationTypes,
  selectedGlossaryIds,
  onEditAsSparql,
}: OntologyVisualQueryBuilderProps) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const [relationTypes, setRelationTypes] = useState<RelationshipType[]>([]);
  const [terms, setTerms] = useState<VisualQueryTerm[]>([]);
  const [selectedRelation, setSelectedRelation] = useState(
    DEFAULT_RELATIONSHIP_TYPE.name
  );
  const [selectedTarget, setSelectedTarget] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [findKind, setFindKind] = useState<VisualQueryFindKind>('concepts');
  const [result, setResult] = useState<SparqlPlaygroundResult>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const selectedGlossaryId = selectedGlossaryIds?.[0];
  const native = useOntologyStudioModel(ontology);
  const nativeRelations = useMemo(
    () => getNativeQueryRelations(native.relations),
    [native.relations]
  );
  const nativeRelation = nativeRelations.find(
    (item) => item.id === selectedRelation
  );
  const nativeTarget = native.model?.concepts.find(
    (concept) => concept.id === selectedTarget
  );

  useEffect(() => {
    let active = true;

    if (ontology) {
      setIsLoading(native.isLoading);
      if (native.isError) {
        setErrorMessage(t('message.temporary-error-try-reloading'));
      }
      if (native.model) {
        setTerms([...native.model.concepts]);
        setSelectedRelation(nativeRelations[0]?.id ?? '');
        setSelectedTarget(
          nativeRelations[0]?.relation.to.id ??
            native.model.concepts[0]?.id ??
            ''
        );
      }

      return () => {
        active = false;
      };
    }
    const loadBuilderData = async () => {
      const scopedGraphTerms = getGraphTerms(
        graphData,
        selectedGlossaryId ? [selectedGlossaryId] : undefined
      );
      const relationTypesPromise = suppliedRelationTypes?.length
        ? Promise.resolve(suppliedRelationTypes)
        : listRelationshipTypes({ limit: 1000 }).then(
            (response) => response.data
          );
      const termsPromise = scopedGraphTerms.length
        ? Promise.resolve(scopedGraphTerms)
        : getGlossaryTerms({
            limit: 100,
            glossary: selectedGlossaryId,
          }).then((response) => response.data.map(toVisualQueryTerm));

      try {
        const [loadedRelationTypes, loadedTerms] = await Promise.all([
          relationTypesPromise,
          termsPromise,
        ]);
        if (!active) {
          return;
        }
        const selection = getInitialBuilderSelection(
          graphData,
          loadedRelationTypes,
          loadedTerms
        );

        setRelationTypes(loadedRelationTypes);
        setTerms(loadedTerms);
        setSelectedRelation(selection.relationName);
        setSelectedTarget(selection.targetId);
      } catch (error) {
        showErrorToast(String(error));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadBuilderData();

    return () => {
      active = false;
    };
  }, [
    graphData,
    selectedGlossaryId,
    suppliedRelationTypes,
    ontology,
    native.isLoading,
    native.isError,
    native.model,
    nativeRelations,
    t,
  ]);

  const relationOptions = useMemo(
    () => (relationTypes.length ? relationTypes : [DEFAULT_RELATIONSHIP_TYPE]),
    [relationTypes]
  );
  const selectedRelationType = useMemo(
    () =>
      relationOptions.find((relation) => relation.name === selectedRelation) ??
      DEFAULT_RELATIONSHIP_TYPE,
    [relationOptions, selectedRelation]
  );
  const selectedTargetTerm = useMemo(
    () => terms.find((term) => term.id === selectedTarget),
    [terms, selectedTarget]
  );
  const generatedQuery = useMemo(() => {
    if (ontology) {
      return nativeRelation && nativeTarget
        ? buildNativeVisualSparqlQuery(nativeRelation.relation, nativeTarget)
        : '';
    }

    return buildVisualSparqlQuery(
      selectedRelationType,
      selectedTargetTerm,
      findKind
    );
  }, [
    ontology,
    nativeRelation,
    nativeTarget,
    findKind,
    selectedRelationType,
    selectedTargetTerm,
  ]);

  const getRelationLabel = useCallback(
    (relation: RelationshipType) =>
      relation.displayName ||
      (relation.name === DEFAULT_RELATIONSHIP_TYPE.name
        ? t('label.related-to')
        : relation.name),
    [t]
  );
  const relationSelectItems = useMemo<SelectItemType[]>(
    () =>
      ontology
        ? nativeRelations.map((item) => ({
            id: item.id,
            label: [
              item.label,
              humanizeName(item.relation.kind),
              item.relation.restriction &&
                [
                  humanizeName(item.relation.restriction.kind),
                  item.relation.restriction.cardinality,
                ]
                  .filter((value) => value !== undefined)
                  .join(' '),
            ]
              .filter(Boolean)
              .join(' · '),
          }))
        : relationOptions.map((relation) => ({
            id: relation.name,
            label: getRelationLabel(relation),
            icon: (
              <span
                aria-hidden="true"
                className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-fg-quaternary"
                style={{ backgroundColor: getRelationshipColor(relation) }}
              />
            ),
          })),
    [ontology, nativeRelations, getRelationLabel, relationOptions]
  );
  const termSelectItems = useMemo<SelectItemType[]>(
    () =>
      terms.map((term) => ({
        id: term.id,
        label: term.displayName || term.name,
      })),
    [terms]
  );

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setResult(undefined);
    setErrorMessage(undefined);
    try {
      const queryParams = {
        query: generatedQuery,
        format: 'json' as const,
        inference: 'none' as const,
      };
      if (!ontology && !selectedGlossaryId && !isAdminUser) {
        throw new Error(
          t('label.please-select-entity', { entity: t('label.glossary') })
        );
      }
      if (ontology) {
        setResult(await runOntologySparqlQuery(ontology.id, queryParams));
      } else if (selectedGlossaryId) {
        setResult(
          await runGlossarySparqlQuery(selectedGlossaryId, queryParams)
        );
      } else {
        setResult(await runSparqlQuery(queryParams));
      }
    } catch (error) {
      let message: string;
      if (isAxiosError(error)) {
        message =
          typeof error.response?.data === 'string'
            ? error.response.data
            : error.message;
      } else {
        message = (error as Error).message;
      }
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setIsRunning(false);
    }
  }, [ontology, generatedQuery, isAdminUser, selectedGlossaryId, t]);

  const resetResult = () => {
    setResult(undefined);
    setErrorMessage(undefined);
  };
  const matchCount = result?.parsed?.results?.bindings?.length;

  const renderQueryControls = () => (
    <>
      <Box direction="col" gap={3}>
        <Box align="center" gap={3}>
          <Typography
            className="tw:w-14 tw:shrink-0 tw:text-right tw:text-tertiary"
            size="text-sm"
            weight="medium">
            {t('label.find')}
          </Typography>
          <Tabs
            className="tw:w-auto"
            selectedKey={findKind}
            onSelectionChange={(key) => {
              setFindKind(key as VisualQueryFindKind);
              resetResult();
            }}>
            <Tabs.List size="sm" type="button-border">
              {(ontology
                ? ['concepts']
                : (['concepts', 'metrics', 'any'] as VisualQueryFindKind[])
              ).map((kind) => (
                <Tabs.Item
                  data-testid={`ontology-builder-find-${kind}`}
                  id={kind}
                  key={kind}>
                  {t(FIND_KIND_LABEL_KEYS[kind as VisualQueryFindKind])}
                </Tabs.Item>
              ))}
            </Tabs.List>
          </Tabs>
        </Box>

        <Box align="center" gap={3}>
          <Typography
            className="tw:w-14 tw:shrink-0 tw:text-right tw:text-tertiary tw:lowercase"
            size="text-sm"
            weight="medium">
            {t('label.where')}
          </Typography>
          <Box className="tw:min-w-0 tw:flex-1" gap={2} wrap="wrap">
            <Select
              aria-label={t('label.relationship-type')}
              className="tw:min-w-50 tw:flex-1"
              data-testid="ontology-builder-relation"
              fontSize="sm"
              isDisabled={isLoading}
              items={relationSelectItems}
              placeholder={t('label.relationship-type')}
              value={selectedRelation}
              onChange={(key) => {
                setSelectedRelation(String(key ?? ''));
                resetResult();
              }}>
              {(item) => (
                <Select.Item
                  icon={item.icon}
                  id={item.id}
                  key={item.id}
                  label={item.label}
                />
              )}
            </Select>
            <Select.ComboBox
              showSearchIcon
              aria-label={t(ontology ? 'label.concept' : 'label.target-term')}
              className="tw:min-w-60 tw:flex-1"
              data-testid="ontology-builder-target"
              emptyState={
                ontology
                  ? t('label.no-entity-found', {
                      entity: t('label.concept-plural'),
                    })
                  : t('message.no-terms-found')
              }
              fontSize="sm"
              isDisabled={isLoading}
              items={termSelectItems}
              placeholder={
                ontology
                  ? t('label.search-entity', {
                      entity: t('label.concept-plural'),
                    })
                  : t('message.bulk-edit-glossary-terms-search-placeholder')
              }
              shortcut={false}
              value={selectedTarget || null}
              onChange={(key) => {
                setSelectedTarget(String(key ?? ''));
                resetResult();
              }}>
              {(item) => (
                <Select.Item id={item.id} key={item.id} label={item.label} />
              )}
            </Select.ComboBox>
          </Box>
        </Box>
      </Box>
    </>
  );

  const renderRunActions = () => (
    <Box align="center" gap={2} wrap="wrap">
      <Button
        color="primary"
        data-testid="ontology-builder-run"
        iconLeading={Play}
        isDisabled={
          isLoading || isRunning || !selectedTarget || !generatedQuery
        }
        size="sm"
        onClick={() => void handleRun()}>
        {isRunning ? t('label.running') : t('label.run-query')}
      </Button>

      {onEditAsSparql ? (
        <Button
          color="secondary"
          data-testid="ontology-builder-edit-as-sparql"
          isDisabled={!selectedTarget || !generatedQuery}
          size="sm"
          onClick={() => onEditAsSparql(generatedQuery)}>
          {t('label.edit-as-sparql')}
        </Button>
      ) : null}

      {matchCount === undefined ? null : (
        <Badge
          color="success"
          data-testid="ontology-builder-result"
          size="md"
          type="pill-color">
          {t('message.ontology-query-concepts-match', {
            count: matchCount,
          })}
        </Badge>
      )}
    </Box>
  );

  const renderQueryResults = () => (
    <>
      {renderRunActions()}
      {errorMessage ? (
        <Box className="tw:rounded-lg tw:border tw:border-utility-error-200 tw:bg-utility-error-50 tw:px-3 tw:py-2">
          <Typography className="tw:text-utility-error-700" size="text-sm">
            {errorMessage}
          </Typography>
        </Box>
      ) : null}
      {result ? (
        <OntologyQueryResults
          graphData={ontology ? native.graph : graphData ?? null}
          relationshipTypes={ontology ? [] : relationOptions}
          result={result}
        />
      ) : null}
    </>
  );

  return (
    <Box
      className="tw:h-full tw:overflow-auto tw:bg-primary tw:p-6"
      data-testid="ontology-visual-query-builder"
      direction="col">
      <Box className="tw:max-w-190" direction="col" gap={5}>
        <Box direction="col">
          <Typography
            className="tw:text-primary"
            size="text-md"
            weight="semibold">
            {t('label.visual-query-builder')}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t(
              ontology
                ? 'message.ontology-native-builder-scope'
                : 'message.visual-query-builder-hint'
            )}
          </Typography>
        </Box>

        {renderQueryControls()}
        <Box direction="col" gap={2}>
          <Typography
            className="tw:tracking-wide tw:text-tertiary tw:uppercase"
            size="text-xs"
            weight="semibold">
            {t('label.generated-sparql')}
          </Typography>
          <pre
            className="tw:m-0 tw:overflow-auto tw:rounded-xl tw:bg-primary-solid tw:px-4 tw:py-3.5 tw:font-mono tw:text-xs tw:leading-5 tw:text-secondary_on-brand"
            data-testid="ontology-generated-sparql">
            {generatedQuery}
          </pre>
        </Box>

        {renderQueryResults()}
      </Box>
    </Box>
  );
};

export default OntologyVisualQueryBuilder;
