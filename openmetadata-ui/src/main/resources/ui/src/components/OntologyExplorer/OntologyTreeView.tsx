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

import { AlertTriangle } from '@untitledui/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { OntologyNode } from './OntologyExplorer.interface';
import { OntologyTreeGroup } from './OntologyStudio.utils';

interface OntologyTreeViewProps {
  readonly groups: OntologyTreeGroup[];
  readonly selectedNodeId?: string;
  readonly onSelect: (node: OntologyNode) => void;
}

const OntologyTreeView = ({
  groups,
  selectedNodeId,
  onSelect,
}: OntologyTreeViewProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:h-full tw:flex-1 tw:overflow-auto tw:bg-white"
      data-testid="ontology-tree-view">
      <div className="tw:max-w-[920px] tw:px-6 tw:py-5">
        <p className="tw:mb-4 tw:font-body tw:text-[13px] tw:leading-[1.5] tw:font-normal tw:text-gray-500">
          {t('message.ontology-tree-description')}
        </p>

        {groups.length === 0 ? (
          <p className="tw:py-10 tw:text-center tw:font-body tw:text-[13px] tw:leading-5 tw:text-gray-500">
            {t('message.no-glossary-terms-found')}
          </p>
        ) : (
          groups.map((group) => (
            <section
              className="tw:mb-[18px]"
              data-testid="ontology-tree-group"
              key={group.glossaryId}>
              <div className="tw:mb-2 tw:flex tw:items-center tw:gap-2">
                <span
                  aria-hidden="true"
                  className="tw:size-1.5 tw:rounded-[2px] tw:bg-brand-600"
                />
                <h3 className="tw:font-body tw:text-xs tw:leading-[18px] tw:font-bold tw:tracking-[0.04em] tw:text-gray-600 tw:uppercase">
                  {group.glossaryName}
                </h3>
                <span className="tw:font-body tw:text-[11px] tw:leading-4 tw:font-medium tw:text-gray-400">
                  {t('label.x-terms', { count: group.rows.length })}
                </span>
              </div>

              {group.rows.map((row) => {
                const isSelected = selectedNodeId === row.node.id;

                return (
                  <button
                    className={classNames(
                      'tw:mb-0.5 tw:flex tw:w-full tw:items-center tw:gap-[9px] tw:rounded-lg tw:border',
                      'tw:px-[11px] tw:py-[9px] tw:text-left tw:focus-visible:outline-2',
                      'tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600',
                      isSelected
                        ? 'tw:border-brand-100 tw:bg-brand-50'
                        : 'tw:border-transparent tw:bg-white hover:tw:bg-gray-50'
                    )}
                    data-testid={`ontology-tree-term-${row.node.id}`}
                    key={row.node.id}
                    type="button"
                    onClick={() => onSelect(row.node)}>
                    <span
                      className="tw:shrink-0"
                      style={{ width: Math.min(row.depth, 8) * 18 }}
                    />
                    <span
                      aria-hidden="true"
                      className={classNames(
                        'tw:size-2 tw:shrink-0 tw:rounded-full',
                        row.isIsolated ? 'tw:bg-warning-500' : 'tw:bg-brand-300'
                      )}
                    />
                    <span
                      className={classNames(
                        'tw:min-w-0 tw:flex-1 tw:truncate tw:font-body tw:text-[13px] tw:leading-[18px] tw:text-gray-900',
                        isSelected ? 'tw:font-bold' : 'tw:font-medium'
                      )}>
                      {row.node.label}
                    </span>
                    {row.parentCount > 1 ? (
                      <span
                        className={
                          'tw:rounded-full tw:border tw:border-purple-200 tw:bg-purple-50 tw:px-[7px] ' +
                          'tw:py-px tw:font-body tw:text-[10px] tw:leading-[14px] tw:font-semibold tw:text-purple-700'
                        }>
                        {t('label.polyhierarchy')}
                      </span>
                    ) : null}
                    {row.isIsolated ? (
                      <span className="tw:flex tw:items-center tw:gap-1 tw:font-body tw:text-[10px] tw:leading-[14px] tw:font-semibold tw:text-warning-700 tw:lowercase">
                        <AlertTriangle
                          aria-hidden="true"
                          className="tw:size-3"
                        />
                        {t('label.isolated')}
                      </span>
                    ) : (
                      <span
                        className={
                          'tw:rounded-full tw:border tw:border-gray-200 tw:bg-gray-100 tw:px-[7px] tw:py-px ' +
                          'tw:font-body tw:text-[10px] tw:leading-[14px] tw:font-semibold tw:text-gray-600'
                        }>
                        {t('label.x-relations', {
                          count: row.relationCount,
                        })}
                      </span>
                    )}
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default OntologyTreeView;
