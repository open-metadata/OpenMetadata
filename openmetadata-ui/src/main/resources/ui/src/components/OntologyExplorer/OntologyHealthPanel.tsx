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

import { ArrowRight, Check } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { OntologyNode } from './OntologyExplorer.interface';
import { OntologyHealthSummary } from './OntologyStudio.utils';

interface OntologyHealthPanelProps {
  readonly health: OntologyHealthSummary;
  readonly onConnect: (node: OntologyNode) => void;
}

const OntologyHealthPanel = ({
  health,
  onConnect,
}: OntologyHealthPanelProps) => {
  const { t } = useTranslation();

  return (
    <aside
      className="tw:flex tw:w-[270px] tw:shrink-0 tw:flex-col tw:overflow-auto tw:border-l tw:border-gray-200 tw:bg-white tw:p-[18px]"
      data-testid="ontology-health-panel">
      <h2 className="tw:mb-3 tw:font-body tw:text-[10px] tw:leading-[normal] tw:font-semibold tw:tracking-[0.08em] tw:text-gray-500 tw:uppercase">
        {t('label.ontology-health')}
      </h2>

      <div className="tw:mb-3 tw:rounded-[10px] tw:border tw:border-gray-blue-100 tw:bg-gray-50 tw:p-3.5">
        <p
          className="tw:m-0 tw:font-body tw:text-[28px] tw:leading-none tw:font-bold tw:text-warning-700"
          data-testid="ontology-isolated-count">
          {health.isolatedTerms.length}
        </p>
        <p className="tw:mt-1 tw:mb-0 tw:font-body tw:text-xs tw:leading-[normal] tw:font-medium tw:text-gray-500 tw:lowercase">
          {t('label.isolated-term-plural')}
        </p>
        <div className="tw:mt-[11px] tw:flex tw:items-center tw:gap-2">
          <div className="tw:h-1.5 tw:flex-1 tw:overflow-hidden tw:rounded-full tw:bg-gray-blue-100">
            <div
              className="tw:h-full tw:bg-success-500 tw:transition-[width]"
              style={{ width: `${health.connectedPercent}%` }}
            />
          </div>
          <span className="tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-gray-700">
            {health.connectedPercent}%
          </span>
        </div>
        <p className="tw:mt-[5px] tw:mb-0 tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-normal tw:text-gray-400 tw:lowercase">
          {t('label.connected')}
        </p>
      </div>

      <h3 className="tw:mb-2 tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-gray-700">
        {t('label.isolated-in-scope')}
      </h3>
      <div className="tw:flex tw:flex-col tw:gap-1.5">
        {health.isolatedTerms.length === 0 ? (
          <div
            className={
              'tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-success-200 ' +
              'tw:bg-success-25 tw:p-[11px] tw:font-body tw:text-xs tw:leading-[normal] ' +
              'tw:font-medium tw:text-success-700'
            }>
            <Check aria-hidden="true" className="tw:size-[15px] tw:shrink-0" />
            <span>{t('message.all-ontology-terms-connected')}</span>
          </div>
        ) : (
          health.isolatedTerms.map((term) => (
            <button
              className={
                'tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-warning-200 ' +
                'tw:bg-warning-25 tw:px-2.5 tw:py-2 tw:text-left tw:focus-visible:outline-2 ' +
                'tw:focus-visible:outline-offset-1 tw:focus-visible:outline-warning-500'
              }
              data-testid={`ontology-connect-${term.id}`}
              key={term.id}
              type="button"
              onClick={() => onConnect(term)}>
              <span
                aria-hidden="true"
                className="tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-warning-500"
              />
              <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-body tw:text-xs tw:leading-[normal] tw:font-medium tw:text-gray-900">
                {term.label}
              </span>
              <span className="tw:flex tw:shrink-0 tw:items-center tw:gap-0.5 tw:font-body tw:text-[10px] tw:leading-[normal] tw:font-semibold tw:text-warning-700">
                {t('label.connect')}
                <ArrowRight aria-hidden="true" className="tw:size-3" />
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
};

export default OntologyHealthPanel;
