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

import { Select, SelectItemType } from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { useAuth } from '../../hooks/authHooks';
import { getGlossaryTerms } from '../../rest/glossaryAPI';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import { runGlossarySparqlQuery, runSparqlQuery } from '../../rest/rdfAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { DEFAULT_SPARQL_PREFIXES } from '../SparqlQueryConsole/SparqlQueryConsole.interface';
import { DEFAULT_RELATIONSHIP_TYPE } from './OntologyExplorer.constants';
import { OntologyGraphData, OntologyNode } from './OntologyExplorer.interface';
import { getRelationshipColor } from './utils/relationshipTypeUtils';

const ONTOLOGY_NAMESPACE = 'https://open-metadata.org/ontology/';

interface VisualQueryTerm {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
  glossaryId?: string;
}

interface OntologyVisualQueryBuilderProps {
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

function toSparqlLocalName(
  value: string | undefined,
  fallback: string
): string {
  const localName = (value ?? '').replace(/[^a-z0-9_]/gi, '');

  return localName || fallback;
}

export function buildVisualSparqlQuery(
  relationType: RelationshipType | undefined,
  target: VisualQueryTerm | undefined
): string {
  const predicate =
    relationType?.rdfPredicate ??
    `${ONTOLOGY_NAMESPACE}${encodeURIComponent(
      relationType?.name ?? 'relatedTo'
    )}`;
  const targetFilter = target?.fullyQualifiedName
    ? `\n  ?target om:fullyQualifiedName "${escapeSparqlLiteral(
        target.fullyQualifiedName
      )}" .`
    : '';

  return `${DEFAULT_SPARQL_PREFIXES}

SELECT ?concept ?conceptFqn WHERE {
  ?concept <${predicate}> ?target ;
           om:fullyQualifiedName ?conceptFqn .${targetFilter}
}
LIMIT 100`;
}

export function buildVisualSparqlPreview(
  relationType: RelationshipType | undefined,
  target: VisualQueryTerm | undefined
): string {
  const predicate = relationType?.rdfPredicate
    ? `<${relationType.rdfPredicate}>`
    : `om:${toSparqlLocalName(relationType?.name, 'relatedTo')}`;
  const targetFilter = target?.fullyQualifiedName
    ? `
  ?target om:fullyQualifiedName "${escapeSparqlLiteral(
    target.fullyQualifiedName
  )}" .`
    : '';

  return `SELECT ?concept ?conceptFqn WHERE {
  ?concept ${predicate} ?target ;
           om:fullyQualifiedName ?conceptFqn .${targetFilter}
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
  const [matchCount, setMatchCount] = useState<number>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const selectedGlossaryId = selectedGlossaryIds?.[0];

  useEffect(() => {
    let active = true;

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
  }, [graphData, selectedGlossaryId, suppliedRelationTypes]);

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
  const generatedQuery = useMemo(
    () => buildVisualSparqlQuery(selectedRelationType, selectedTargetTerm),
    [selectedRelationType, selectedTargetTerm]
  );
  const queryPreview = useMemo(
    () => buildVisualSparqlPreview(selectedRelationType, selectedTargetTerm),
    [selectedRelationType, selectedTargetTerm]
  );

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
      relationOptions.map((relation) => ({
        id: relation.name,
        label: getRelationLabel(relation),
        icon: (
          <span
            aria-hidden="true"
            className="tw:size-2 tw:shrink-0 tw:rounded tw:bg-warning-solid"
            style={{ backgroundColor: getRelationshipColor(relation) }}
          />
        ),
      })),
    [getRelationLabel, relationOptions]
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
    setMatchCount(undefined);
    setErrorMessage(undefined);
    try {
      const queryParams = {
        query: generatedQuery,
        format: 'json' as const,
        inference: 'none' as const,
      };
      if (!selectedGlossaryId && !isAdminUser) {
        throw new Error(
          t('label.please-select-entity', { entity: t('label.glossary') })
        );
      }
      const result = selectedGlossaryId
        ? await runGlossarySparqlQuery(selectedGlossaryId, queryParams)
        : await runSparqlQuery(queryParams);
      setMatchCount(result.parsed?.results?.bindings?.length ?? 0);
    } catch (error) {
      const message = isAxiosError(error)
        ? typeof error.response?.data === 'string'
          ? error.response.data
          : error.message
        : (error as Error).message;
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setIsRunning(false);
    }
  }, [generatedQuery, isAdminUser, selectedGlossaryId, t]);

  return (
    <div
      className="tw:h-full tw:bg-secondary"
      data-testid="ontology-visual-query-builder">
      <div className="tw:max-w-[640px] tw:px-[26px] tw:py-[22px]">
        <h2 className="tw:mb-1 tw:font-body tw:text-[15px] tw:leading-normal tw:font-semibold tw:text-primary">
          {t('label.visual-query-builder')}
        </h2>
        <p className="tw:mb-5 tw:font-body tw:text-xs tw:leading-normal tw:font-normal tw:text-quaternary">
          {t('message.visual-query-builder-description')}
        </p>

        <div className="tw:mb-4 tw:flex tw:flex-col tw:gap-2.5">
          <div className="tw:flex tw:items-center tw:gap-2.5">
            <span className="tw:w-11 tw:text-right tw:font-body tw:text-xs tw:leading-normal tw:font-semibold tw:text-quaternary">
              {t('label.find')}
            </span>
            <span
              className={classNames(
                'tw:inline-flex tw:items-center tw:rounded-lg tw:border tw:border-primary',
                'tw:bg-primary tw:px-3 tw:py-2 tw:font-body tw:text-xs tw:leading-normal tw:font-medium tw:text-primary'
              )}>
              {t('label.concept-plural')}
            </span>
          </div>

          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
            <span className="tw:w-11 tw:text-right tw:font-body tw:text-xs tw:leading-normal tw:font-semibold tw:text-quaternary tw:lowercase">
              {t('label.where')}
            </span>
            <Select
              aria-label={t('label.relationship-type')}
              className="tw:w-52 [&_button]:tw:bg-warning-primary [&_button]:tw:ring-utility-warning-200 [&_button_p]:tw:text-warning-primary"
              data-testid="ontology-builder-relation"
              fontSize="xs"
              isDisabled={isLoading}
              items={relationSelectItems}
              placeholder={t('label.relationship-type')}
              size="sm"
              value={selectedRelation}
              onChange={(key) => {
                setSelectedRelation(String(key ?? ''));
                setMatchCount(undefined);
                setErrorMessage(undefined);
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
              aria-label={t('label.target-term')}
              className="tw:w-72"
              data-testid="ontology-builder-target"
              emptyState={t('message.no-terms-found')}
              fontSize="xs"
              isDisabled={isLoading}
              items={termSelectItems}
              placeholder={t(
                'message.bulk-edit-glossary-terms-search-placeholder'
              )}
              shortcut={false}
              size="sm"
              value={selectedTarget || null}
              onChange={(key) => {
                setSelectedTarget(String(key ?? ''));
                setMatchCount(undefined);
                setErrorMessage(undefined);
              }}>
              {(item) => (
                <Select.Item id={item.id} key={item.id} label={item.label} />
              )}
            </Select.ComboBox>
          </div>
        </div>

        <h3 className="tw:mb-2 tw:font-body tw:text-xs tw:leading-normal tw:font-semibold tw:tracking-wide tw:text-quaternary tw:uppercase">
          {t('label.generated-sparql')}
        </h3>
        <pre
          className="tw:mb-4 tw:overflow-auto tw:rounded-lg tw:bg-primary-solid tw:px-3.5 tw:py-3 tw:font-mono tw:text-xs tw:leading-loose tw:font-normal tw:text-secondary_on-brand"
          data-testid="ontology-generated-sparql">
          {queryPreview}
        </pre>

        <div className="tw:flex tw:items-center tw:gap-2.5">
          <button
            className={classNames(
              'tw:rounded-lg tw:border-0 tw:bg-brand-solid tw:px-4 tw:py-2.5',
              'tw:font-body tw:text-[13px] tw:leading-normal tw:font-semibold tw:text-white tw:shadow-xs-skeuomorphic',
              'disabled:tw:cursor-not-allowed disabled:tw:opacity-60'
            )}
            data-testid="ontology-builder-run"
            disabled={isLoading || isRunning || !selectedTarget}
            type="button"
            onClick={() => void handleRun()}>
            {isRunning ? t('label.running') : t('label.run-query')}
          </button>

          {onEditAsSparql ? (
            <button
              className={classNames(
                'tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:px-4 tw:py-2.5',
                'tw:font-body tw:text-[13px] tw:leading-normal tw:font-semibold tw:text-secondary tw:shadow-xs-skeuomorphic',
                'disabled:tw:cursor-not-allowed disabled:tw:opacity-60'
              )}
              data-testid="ontology-builder-edit-as-sparql"
              disabled={!selectedTarget}
              type="button"
              onClick={() => onEditAsSparql(queryPreview)}>
              {t('label.edit-as-sparql')}
            </button>
          ) : null}

          {matchCount !== undefined ? (
            <span
              className={classNames(
                'tw:inline-flex tw:items-center tw:rounded-full tw:border tw:border-utility-success-200',
                'tw:bg-success-primary tw:px-3 tw:py-1.5 tw:font-body tw:text-xs tw:leading-normal tw:font-semibold tw:text-success-primary'
              )}
              data-testid="ontology-builder-result">
              {t('message.ontology-query-concepts-match', {
                count: matchCount,
              })}
            </span>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="tw:mt-3 tw:rounded-lg tw:border tw:border-error_subtle tw:bg-error-primary tw:px-3 tw:py-2 tw:font-body tw:text-xs tw:text-error-primary">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default OntologyVisualQueryBuilder;
