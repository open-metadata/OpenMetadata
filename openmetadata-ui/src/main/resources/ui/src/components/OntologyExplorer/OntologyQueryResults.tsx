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
import { Copy01, Download01 } from '@openmetadata/ui-core-components/icons';
import {
  Key,
  ReactElement,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { RDFTerm } from '../../generated/api/rdf/sparqlResponse';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { useClipboard } from '../../hooks/useClipBoard';
import { SparqlPlaygroundResult } from '../../rest/rdfAPI';
import { downloadCsv } from '../../utils/Export/ExportUtils';
import { getTermDisplayText } from '../../utils/Sparql/SparqlTerm.utils';
import { generateUUID } from '../../utils/StringUtils';
import NoDataPlaceholder from '../common/EmptyPlaceholder/NoDataPlaceholder';
import { LayoutType } from './OntologyExplorer.constants';
import { OntologyGraphData } from './OntologyExplorer.interface';
import OntologyGraph from './OntologyGraphG6';
import { buildGraphFromSparqlBindings } from './OntologyQueryResultGraph.utils';
import {
  buildCsv,
  buildTsv,
  describeTimeAgo,
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
  /**
   * Readable column headers by variable; a variable without one is shown as "?name".
   * Labelled columns come first, in this object's key order.
   */
  columnLabels?: Record<string, string>;
  /** When the query ran (client clock), shown as "Ran just now". */
  ranAt?: number;
  /** Extra notes beside the row count, such as ignored builder conditions. */
  meta?: ReactNode;
}

const EMPTY_CELL = '—';

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

function orderVariables(
  variables: string[],
  columnLabels?: Record<string, string>
): string[] {
  if (!columnLabels) {
    return variables;
  }
  const labelled = Object.keys(columnLabels);
  const rank = (variable: string) => {
    const index = labelled.indexOf(variable);

    return index === -1 ? labelled.length : index;
  };

  return [...variables].sort((a, b) => rank(a) - rank(b));
}

interface ResultTable {
  keyedRows: Array<{ key: string; position: number; row: ResultRow }>;
  rows: ResultRow[];
  variables: string[];
}

type ResultGraph = ReturnType<typeof buildGraphFromSparqlBindings>;

interface ResultBodyParams {
  resultView: ResultView;
  hasResultGraph: boolean;
  resultGraph: ResultGraph;
  resultTable: ResultTable;
  columnLabels?: Record<string, string>;
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
  resultTable,
  columnLabels,
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
            <Table.Head className="tw:w-12" id="#" label="#" />
            {resultTable.variables.map((variable, index) => (
              <Table.Head
                id={variable}
                isRowHeader={index === 0}
                key={variable}
                label={columnLabels?.[variable] ?? `?${variable}`}
              />
            ))}
          </Table.Header>
          <Table.Body items={resultTable.keyedRows}>
            {({ key, position, row }) => (
              <Table.Row id={key}>
                <Table.Cell>
                  <Typography color="quaternary" size="text-xs">
                    {position}
                  </Typography>
                </Table.Cell>
                {resultTable.variables.map((variable) => (
                  <Table.Cell key={variable}>
                    {row[variable]
                      ? getTermDisplayText(row[variable])
                      : EMPTY_CELL}
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
    return `${result.durationMs} ms`;
  }
  const subject = result.parsed ? `${rowCount} ${rowLabel}` : result.format;

  return `${subject}${META_SEPARATOR}${result.durationMs} ms`;
}

const OntologyQueryResults = ({
  graphData,
  relationshipTypes,
  result,
  scopeLabel,
  exportName,
  columnLabels,
  ranAt,
  meta,
}: OntologyQueryResultsProps) => {
  const { t } = useTranslation();
  const [resultView, setResultView] = useState<ResultView>('table');
  const resultTable = useMemo(() => {
    const rows = result.parsed?.results?.bindings ?? [];

    return {
      keyedRows: rows.map((row, index) => ({
        key: generateUUID(),
        position: index + 1,
        row,
      })),
      rows,
      variables: orderVariables(result.parsed?.head?.vars ?? [], columnLabels),
    };
  }, [columnLabels, result.parsed]);
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
        <Box align="center" gap={2} wrap="wrap">
          <Typography as="h3" className="not-prose tw:m-0" weight="semibold">
            {t('label.result-plural')}
          </Typography>
          <Badge
            color="success"
            data-testid="ontology-sparql-result-status"
            size="sm"
            type="pill-color">
            {getResultSummary(result, resultTable.rows.length, rowLabel)}
          </Badge>
          {ranAt === undefined ? null : (
            <Typography
              color="secondary"
              data-testid="ontology-sparql-result-ran-at"
              size="text-xs">
              {t('label.ran-time', {
                time: describeTimeAgo(ranAt, t('label.just-now')),
              })}
            </Typography>
          )}
          {scopeLabel ? (
            <Badge
              color="gray"
              data-testid="ontology-sparql-result-scope"
              size="sm"
              type="pill-color">
              {scopeLabel}
            </Badge>
          ) : null}
          {meta}
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
        resultTable,
        columnLabels,
        result,
        relationshipTypes,
        emptyText: t('message.query-ran-without-results'),
        tableLabel: t('label.result-plural'),
        askAnswer,
      })}
    </Box>
  );
};

/** The "Results" section before anything has run. */
export const QueryResultsEmptyState = ({ meta }: { meta?: ReactNode }) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={3}>
      <Box align="center" gap={2} wrap="wrap">
        <Typography as="h3" className="not-prose tw:m-0" weight="semibold">
          {t('label.result-plural')}
        </Typography>
        {meta}
      </Box>
      <div
        className="tw:relative tw:min-h-48"
        data-testid="ontology-sparql-results-empty">
        <NoDataPlaceholder
          description={t('message.run-query-to-see-query-results')}
          title={t('label.no-results-yet')}
        />
      </div>
    </Box>
  );
};

export default OntologyQueryResults;
