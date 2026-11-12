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
  Table,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  Copy01,
  Download01,
} from '@openmetadata/ui-core-components/icons';
import { Key, ReactElement, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RDFTerm } from '../../generated/api/rdf/sparqlResponse';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { useClipboard } from '../../hooks/useClipBoard';
import { SparqlPlaygroundResult } from '../../rest/rdfAPI';
import { formatDuration } from '../../utils/date-time/DateTimeUtils';
import { downloadCsv } from '../../utils/Export/ExportUtils';
import { getTermDisplayText } from '../../utils/Sparql/SparqlTerm.utils';
import { generateUUID } from '../../utils/StringUtils';
import { LayoutType } from './OntologyExplorer.constants';
import { OntologyGraphData } from './OntologyExplorer.interface';
import OntologyGraph from './OntologyGraphG6';
import { buildGraphFromSparqlBindings } from './OntologyQueryResultGraph.utils';
import {
  buildCsv,
  buildTsv,
  toCsvFileName,
} from './OntologyQueryResults.utils';

interface OntologyQueryResultsProps {
  graphData: OntologyGraphData | null;
  relationshipTypes: RelationshipType[];
  result: SparqlPlaygroundResult;
  /** What the query ran against, such as "clinical · v1.0.0"; shown beside the row count. */
  scopeLabel?: string;
  /** The CSV file is named after this, usually the query's title. */
  exportName?: string;
}

const META_SEPARATOR = ' · ';

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
  askAnswer?: boolean;
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
  askAnswer,
}: ResultBodyParams): ReactElement {
  const showGraphView = resultView === 'graph' && hasResultGraph;

  if (askAnswer !== undefined) {
    return (
      <Typography
        data-testid="ontology-sparql-ask"
        size="display-xs"
        weight="semibold">
        {String(askAnswer)}
      </Typography>
    );
  }

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
    <pre
      className="tw:m-0 tw:max-h-96 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-3 tw:font-mono tw:text-xs tw:text-secondary"
      data-testid="ontology-sparql-graph-text">
      {result.body}
    </pre>
  );
}

function getResultSummary(
  result: SparqlPlaygroundResult,
  rowCount: number,
  rowLabel: string
): string {
  if (typeof result.parsed?.boolean === 'boolean') {
    return formatDuration(result.durationMs);
  }
  const subject = result.parsed ? `${rowCount} ${rowLabel}` : result.format;

  return `${subject}${META_SEPARATOR}${formatDuration(result.durationMs)}`;
}

const OntologyQueryResults = ({
  graphData,
  relationshipTypes,
  result,
  scopeLabel,
  exportName,
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
  const askAnswer = result.parsed?.boolean;
  const isTable = result.parsed !== undefined && askAnswer === undefined;
  const copyText = useMemo(() => {
    if (askAnswer !== undefined) {
      return String(askAnswer);
    }

    return isTable
      ? buildTsv(resultTable.variables, resultTable.rows)
      : result.body;
  }, [askAnswer, isTable, result.body, resultTable]);
  const { hasCopied, onCopyToClipBoard } = useClipboard(copyText);
  const rowLabel = t(
    resultTable.rows.length === 1 ? 'label.row' : 'label.row-plural'
  ).toLocaleLowerCase();

  useEffect(() => {
    setResultView('table');
  }, [result]);

  return (
    <Box data-testid="ontology-sparql-result" direction="col" gap={3}>
      <Box align="center" gap={3} justify="between" wrap="wrap">
        <Box align="center" gap={3} wrap="wrap">
          <Box align="center" className="tw:text-utility-success-700" gap={2}>
            <CheckCircle aria-hidden="true" className="tw:size-4" />
            <Typography
              data-testid="ontology-sparql-result-status"
              size="text-sm"
              weight="medium">
              {getResultSummary(result, resultTable.rows.length, rowLabel)}
            </Typography>
          </Box>
          {scopeLabel ? (
            <Badge
              color="gray"
              data-testid="ontology-sparql-result-scope"
              size="sm"
              type="pill-color">
              {scopeLabel}
            </Badge>
          ) : null}
        </Box>
        <Box align="center" gap={2}>
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
          <Button
            color="secondary"
            data-testid="ontology-sparql-copy"
            iconLeading={Copy01}
            size="sm"
            onClick={() => void onCopyToClipBoard(copyText)}>
            {hasCopied ? t('label.copied') : t('label.copy')}
          </Button>
          {isTable ? (
            <Button
              color="secondary"
              data-testid="ontology-sparql-csv"
              iconLeading={Download01}
              size="sm"
              onClick={() =>
                downloadCsv(
                  buildCsv(resultTable.variables, resultTable.rows),
                  toCsvFileName(exportName)
                )
              }>
              {t('label.csv')}
            </Button>
          ) : null}
        </Box>
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
        askAnswer,
      })}
    </Box>
  );
};

export default OntologyQueryResults;
