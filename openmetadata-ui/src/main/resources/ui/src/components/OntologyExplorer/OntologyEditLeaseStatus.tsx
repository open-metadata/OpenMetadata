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

import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { OntologyEditLock } from '../../generated/type/ontologyEditLock';
import { OntologyEditLeaseState } from './hooks/useOntologyEditLease';

interface OntologyEditLeaseStatusProps {
  hasResource: boolean;
  lock?: OntologyEditLock;
  state: OntologyEditLeaseState;
  onRetry: () => void;
}

const OntologyEditLeaseStatus = ({
  hasResource,
  lock,
  state,
  onRetry,
}: OntologyEditLeaseStatusProps) => {
  const { t } = useTranslation();
  const isOwned = state === 'owned';
  const canRetry = state === 'contended' || state === 'lost';
  const holder = lock?.holder.displayName ?? lock?.holder.name;

  return (
    <div
      className={classNames(
        'tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:border tw:px-3 tw:py-1 tw:text-xs tw:font-medium',
        isOwned
          ? 'tw:border-utility-success-300 tw:bg-success-primary tw:text-success-primary'
          : 'tw:border-secondary tw:bg-secondary tw:text-secondary'
      )}
      data-testid="ontology-edit-lease-status">
      <span
        aria-hidden="true"
        className={classNames(
          'tw:size-2 tw:rounded-full',
          isOwned ? 'tw:bg-success-solid' : 'tw:bg-warning-solid'
        )}
      />
      <span>{statusLabel(state, hasResource, holder, t)}</span>
      {canRetry ? (
        <button
          className="tw:border-0 tw:bg-transparent tw:p-0 tw:font-semibold tw:text-brand-secondary"
          type="button"
          onClick={onRetry}>
          {t('label.retry')}
        </button>
      ) : null}
    </div>
  );
};

const statusLabel = (
  state: OntologyEditLeaseState,
  hasResource: boolean,
  holder: string | undefined,
  t: ReturnType<typeof useTranslation>['t']
) => {
  let label: string;

  if (!hasResource) {
    label = `${t('label.select')} ${t('label.glossary')}`;
  } else {
    switch (state) {
      case 'owned':
        label = `${t('label.edit')} · ${t('label.active')}`;

        break;
      case 'acquiring':
        label = t('label.loading');

        break;
      case 'contended':
        label = `${t('label.edit')}: ${holder ?? t('label.user')}`;

        break;
      case 'lost':
        label = t('label.edit');

        break;
      case 'idle':
        label = `${t('label.select')} ${t('label.glossary')}`;

        break;
    }
  }

  return label;
};

export default OntologyEditLeaseStatus;
