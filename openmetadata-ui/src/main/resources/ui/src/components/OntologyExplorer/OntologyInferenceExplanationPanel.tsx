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
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyInferenceExplanation } from '../../generated/api/data/ontologyInferenceExplanation';
import { ObjectKind } from '../../generated/api/data/ontologyInferenceExplanationRequest';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { Provenance } from '../../generated/type/termRelation';
import { explainOntologyInference } from '../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../rest/rdfAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { MergedEdge, OntologyNode } from './OntologyExplorer.interface';

interface OntologyInferenceExplanationPanelProps {
  edge: MergedEdge;
  nodes: OntologyNode[];
  relationshipTypes: RelationshipType[];
}

interface ExplanationContext {
  glossaryId: string;
  predicateIri: string;
  sourceId: string;
  targetId: string;
}

const OntologyInferenceExplanationPanel = ({
  edge,
  nodes,
  relationshipTypes,
}: OntologyInferenceExplanationPanelProps) => {
  const { t } = useTranslation();
  const context = useMemo(
    () => buildExplanationContext(edge, nodes, relationshipTypes),
    [edge, nodes, relationshipTypes]
  );
  const [explanation, setExplanation] =
    useState<OntologyInferenceExplanation>();
  const [isDisabled, setIsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setExplanation(undefined);
    setIsDisabled(false);
  }, [edge.from, edge.relationType, edge.to]);

  const loadExplanation = async () => {
    if (context) {
      setIsLoading(true);
      try {
        const rdfStatus = await fetchRdfConfig();
        setIsDisabled(!rdfStatus.enabled || !rdfStatus.inference.enabled);
        if (rdfStatus.enabled && rdfStatus.inference.enabled) {
          setExplanation(
            await explainOntologyInference({
              glossaryId: context.glossaryId,
              statement: {
                objectIri: entityIri(rdfStatus.baseUri, context.targetId),
                objectKind: ObjectKind.IRI,
                predicateIri: context.predicateIri,
                subjectIri: entityIri(rdfStatus.baseUri, context.sourceId),
              },
            })
          );
        }
      } catch {
        showErrorToast(t('server.unexpected-error'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  return edge.provenance === Provenance.Inferred ? (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <Button
        color="secondary"
        data-testid="load-inference-explanation"
        isDisabled={!context}
        isLoading={isLoading}
        onClick={loadExplanation}>
        {t('label.inference')} {t('label.details')}
      </Button>
      {isDisabled ? (
        <Alert
          title={`${t('label.inference')} ${t('label.disabled')}`}
          variant="warning"
        />
      ) : null}
      {explanation ? <ExplanationResult explanation={explanation} /> : null}
    </div>
  ) : null;
};

const ExplanationResult = ({
  explanation,
}: {
  explanation: OntologyInferenceExplanation;
}) => {
  const { t } = useTranslation();

  return (
    <Alert
      title={`${t('label.rule-plural')}: ${explanation.explanations.length}`}
      variant={explanation.inferred ? 'success' : 'warning'}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <Typography size="text-sm">
          {t('label.inference')}: {yesOrNo(explanation.inferred, t)}
        </Typography>
        {explanation.explanations.length ? (
          explanation.explanations.map((item) => (
            <Card
              className="tw:flex tw:flex-col tw:gap-1 tw:border tw:border-secondary tw:p-3"
              key={item.graphUri}>
              <Typography size="text-sm" weight="semibold">
                {item.rule.displayName ?? item.rule.name}
              </Typography>
              {item.rule.description ? (
                <Typography className="tw:text-tertiary" size="text-xs">
                  {item.rule.description}
                </Typography>
              ) : null}
              <Typography className="tw:text-tertiary" size="text-xs">
                {t('label.count')}: {item.tripleCount}
              </Typography>
              {item.lastMaterializedAt ? (
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.last-updated')}:{' '}
                  {formatDateTime(item.lastMaterializedAt)}
                </Typography>
              ) : null}
            </Card>
          ))
        ) : (
          <Typography size="text-sm">{t('label.no-data')}</Typography>
        )}
      </div>
    </Alert>
  );
};

const buildExplanationContext = (
  edge: MergedEdge,
  nodes: OntologyNode[],
  relationshipTypes: RelationshipType[]
) => {
  const source = nodes.find((node) => node.id === edge.from);
  const target = nodes.find((node) => node.id === edge.to);
  const relationshipType = relationshipTypes.find(
    (candidate) => candidate.name === edge.relationType
  );
  let context: ExplanationContext | undefined;

  if (source?.glossaryId && target && relationshipType) {
    context = {
      glossaryId: source.glossaryId,
      predicateIri: relationshipType.rdfPredicate,
      sourceId: source.id,
      targetId: target.id,
    };
  }

  return context;
};

const entityIri = (baseUri: string, entityId: string) => {
  const normalizedBaseUri = baseUri.endsWith('/') ? baseUri : `${baseUri}/`;

  return `${normalizedBaseUri}entity/glossaryTerm/${entityId}`;
};

const yesOrNo = (value: boolean, t: ReturnType<typeof useTranslation>['t']) =>
  t(value ? 'label.yes' : 'label.no');

export default OntologyInferenceExplanationPanel;
