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
  Table,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle } from '@openmetadata/ui-core-components/icons';
import { Key, ReactElement, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RDFTerm } from '../../generated/api/rdf/sparqlResponse';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { SparqlPlaygroundResult } from '../../rest/rdfAPI';
import { getTermDisplayText } from '../../utils/Sparql/SparqlTerm.utils';
import { generateUUID } from '../../utils/StringUtils';
import { LayoutType } from './OntologyExplorer.constants';
import { OntologyGraphData } from './OntologyExplorer.interface';
import OntologyGraph from './OntologyGraphG6';
import { buildGraphFromSparqlBindings } from './OntologyQueryResultGraph.utils';

interface OntologyQueryResultsProps {
  graphData: OntologyGraphData | null;
  relationshipTypes: RelationshipType[];
  result: SparqlPlaygroundResult;
}

type ResultView = 'graph' | 'table';

const NO_OP = () => undefined;

function toResultView(key: Key): ResultView {
  let resultView: ResultView;

  switch (String(key)) {
    case 'graph':
      resultView = 'graph';

      break;
    default:
      resultView = 'table';
  }

  return resultView;
}

type ResultRow = { [key: string]: RDFTerm };

interface ResultTable {
  keyedRows: Array<{ key: string; row: ResultRow }>;
  rows: ResultRow[];
  variables: string[];
}

type ResultGraph = ReturnType<typeof buildGraphFromSparqlBindings>;

interface ResultBodyParams {
  resultView: ResultView;
  hasResultGraph: boolean;
  resultGraph: ResultGraph;
  conceptResults: Array<{ key: string; value: string }> | null;
  resultTable: ResultTable;
  result: SparqlPlaygroundResult;
  relationshipTypes: RelationshipType[];
  emptyText: string;
  tableLabel: string;
}

function renderResultBody({
  resultView,
  hasResultGraph,
  resultGraph,
  conceptResults,
  resultTable,
  result,
  relationshipTypes,
  emptyText,
  tableLabel,
}: ResultBodyParams): ReactElement {
  const showGraphView = resultView === 'graph' && hasResultGraph;

  if (showGraphView) {
    return (
      <div
        className="tw:h-96 tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary tw:bg-primary"
        data-testid="ontology-sparql-result-graph">
        <OntologyGraph
          studioMode
          edges={resultGraph.edges}
          glossaries={[]}
          glossaryColorMap={{}}
          nodes={resultGraph.nodes}
          relationTypes={relationshipTypes}
          settings={{
            layout: LayoutType.Circular,
            showEdgeLabels: true,
          }}
          onNodeClick={NO_OP}
          onNodeDoubleClick={NO_OP}
          onPaneClick={NO_OP}
        />
      </div>
    );
  }

  if (resultTable.variables.length > 0 && resultTable.rows.length === 0) {
    return (
      <Box
        align="center"
        className="tw:min-h-14 tw:rounded-lg tw:border tw:border-dashed tw:border-primary tw:px-4 tw:py-3"
        data-testid="ontology-sparql-no-rows"
        justify="center">
        <Typography className="tw:text-tertiary" size="text-sm">
          {emptyText}
        </Typography>
      </Box>
    );
  }

  if (conceptResults) {
    return (
      <Box data-testid="ontology-sparql-chips" gap={2} wrap="wrap">
        {conceptResults.map(({ key, value }) => (
          <Badge color="gray" key={key} size="md" type="pill-color">
            {value}
          </Badge>
        ))}
      </Box>
    );
  }

  if (resultTable.variables.length > 0) {
    return (
      <Box
        className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary"
        direction="col">
        <Table
          aria-label={tableLabel}
          containerStyle={{ maxHeight: 384, overflowY: 'auto' }}
          data-testid="ontology-sparql-result-table"
          size="sm">
          <Table.Header>
            {resultTable.variables.map((variable, index) => (
              <Table.Head
                id={variable}
                isRowHeader={index === 0}
                key={variable}
                label={variable}
              />
            ))}
          </Table.Header>
          <Table.Body items={resultTable.keyedRows}>
            {({ key, row }) => (
              <Table.Row id={key}>
                {resultTable.variables.map((variable) => (
                  <Table.Cell key={variable}>
                    {getTermDisplayText(row[variable])}
                  </Table.Cell>
                ))}
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </Box>
    );
  }

  return (
    <pre className="tw:m-0 tw:max-h-96 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-3 tw:font-mono tw:text-xs tw:text-secondary">
      {result.body}
    </pre>
  );
}

const OntologyQueryResults = ({
  graphData,
  relationshipTypes,
  result,
}: OntologyQueryResultsProps) => {
  const { t } = useTranslation();
  const [resultView, setResultView] = useState<ResultView>('table');
  const resultTable = useMemo(() => {
    const rows = result.parsed?.results?.bindings ?? [];

    return {
      keyedRows: rows.map((row) => ({ key: generateUUID(), row })),
      rows,
      variables: result.parsed?.head?.vars ?? [],
    };
  }, [result.parsed]);
  const resultGraph = useMemo(
    () =>
      buildGraphFromSparqlBindings(
        resultTable.rows,
        resultTable.variables,
        graphData,
        relationshipTypes
      ),
    [graphData, relationshipTypes, resultTable]
  );
  const conceptResults = useMemo(() => {
    const variable = resultTable.variables[0];
    let values: Array<{ key: string; value: string }> | null = null;

    if (resultTable.variables.length === 1) {
      values = resultTable.keyedRows.map(({ key, row }) => ({
        key,
        value: getTermDisplayText(row[variable]),
      }));
    }

    return values;
  }, [resultTable]);
  const hasResultGraph = resultGraph.edges.length > 0;

  useEffect(() => {
    setResultView('table');
  }, [result]);

  return (
    <Box data-testid="ontology-sparql-result" direction="col" gap={3}>
      <Box align="center" gap={3} justify="between">
        <Box align="center" className="tw:text-utility-success-700" gap={2}>
          <CheckCircle aria-hidden="true" className="tw:size-4" />
          <Typography
            data-testid="ontology-sparql-result-status"
            size="text-sm"
            weight="medium">
            {resultTable.rows.length}{' '}
            {t('label.result-plural').toLocaleLowerCase()}{' '}
            {/* eslint-disable-next-line i18next/no-literal-string -- decorative separator dot and ms unit */}
            <span aria-hidden="true">·</span> {result.durationMs} ms
          </Typography>
        </Box>
        {hasResultGraph ? (
          <Tabs
            selectedKey={resultView}
            onSelectionChange={(key) => setResultView(toResultView(key))}>
            <Tabs.List size="sm" type="button-border">
              <Tabs.Item id="table" label={t('label.table')} />
              <Tabs.Item id="graph" label={t('label.graph')} />
            </Tabs.List>
            <Tabs.Panel className="tw:hidden" id="table" />
            <Tabs.Panel className="tw:hidden" id="graph" />
          </Tabs>
        ) : null}
      </Box>

      {renderResultBody({
        resultView,
        hasResultGraph,
        resultGraph,
        conceptResults,
        resultTable,
        result,
        relationshipTypes,
        emptyText: t('message.query-ran-without-results'),
        tableLabel: t('label.result-plural'),
      })}
    </Box>
  );
};

export default OntologyQueryResults;
