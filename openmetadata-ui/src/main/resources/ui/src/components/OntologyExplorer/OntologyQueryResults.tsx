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

import { Tabs } from '@openmetadata/ui-core-components';
import { Check } from '@untitledui/icons';
import { Key, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Binding } from '../../generated/api/rdf/sparqlResponse';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { SparqlPlaygroundResult } from '../../rest/rdfAPI';
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

function getResultValue(binding: Binding | undefined): string {
  return binding?.value ?? '';
}

const OntologyQueryResults = ({
  graphData,
  relationshipTypes,
  result,
}: OntologyQueryResultsProps) => {
  const { t } = useTranslation();
  const [resultView, setResultView] = useState<ResultView>('table');
  const resultTable = useMemo(
    () => ({
      rows: result.parsed?.results?.bindings ?? [],
      variables: result.parsed?.head?.vars ?? [],
    }),
    [result.parsed]
  );
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
    let values: string[] | null = null;

    if (resultTable.variables.length === 1) {
      values = resultTable.rows.map((row) => getResultValue(row[variable]));
    }

    return values;
  }, [resultTable]);
  const hasResultGraph = resultGraph.edges.length > 0;

  useEffect(() => {
    setResultView('table');
  }, [result]);

  return (
    <div data-testid="ontology-sparql-result">
      <div className="tw:mb-3 tw:flex tw:items-center tw:justify-between tw:gap-3">
        <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-success-primary">
          <Check aria-hidden="true" className="tw:size-3.5" />
          <span
            className="tw:text-xs tw:font-semibold"
            data-testid="ontology-sparql-result-status">
            {resultTable.rows.length}{' '}
            {t('label.result-plural').toLocaleLowerCase()}{' '}
            <span aria-hidden="true">·</span> {result.durationMs} ms
          </span>
        </div>
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
      </div>

      {resultView === 'graph' && hasResultGraph ? (
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
      ) : conceptResults ? (
        <div
          className="tw:flex tw:flex-wrap tw:gap-2"
          data-testid="ontology-sparql-chips">
          {conceptResults.map((value, index) => (
            <span
              className="tw:rounded-full tw:border tw:border-secondary tw:bg-primary tw:px-3 tw:py-1.5 tw:text-xs tw:font-medium tw:text-primary"
              key={`${value}-${index}`}>
              {value}
            </span>
          ))}
        </div>
      ) : resultTable.variables.length > 0 ? (
        <div className="tw:max-h-96 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-primary">
          <table className="tw:w-full tw:border-collapse tw:text-xs">
            <thead>
              <tr>
                {resultTable.variables.map((variable) => (
                  <th
                    className="tw:border-b tw:border-secondary tw:bg-secondary tw:px-3 tw:py-2 tw:text-left tw:font-semibold tw:text-secondary"
                    key={variable}>
                    {variable}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultTable.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {resultTable.variables.map((variable) => (
                    <td
                      className="tw:border-b tw:border-secondary tw:px-3 tw:py-2 tw:font-mono tw:text-xs tw:text-secondary"
                      key={variable}>
                      {getResultValue(row[variable])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="tw:m-0 tw:max-h-96 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-3 tw:font-mono tw:text-xs tw:text-secondary">
          {result.body}
        </pre>
      )}
    </div>
  );
};

export default OntologyQueryResults;
