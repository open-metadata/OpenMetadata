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
import { capitalize, isUndefined } from 'lodash';
import type { CurrentState } from 'Models';
import { lazy, type ReactNode, Suspense } from 'react';
import { EntityType, FqnPart } from '../enums/entity.enum';
import { getPartialNameFromFQN, getPartialNameFromTableFQN } from './FqnUtils';
import { t, Transi18next } from './i18next/LocalUtil';

const Loader = lazy(() => import('../components/common/Loader/Loader'));

export const getCountBadge = (
  count = 0,
  className = '',
  isActive?: boolean
) => {
  const clsBG = isUndefined(isActive)
    ? ''
    : isActive
    ? 'bg-primary text-white no-border'
    : 'ant-tag';

  return (
    <span
      className={classNames(
        'p-x-xss m-x-xss global-border rounded-4 text-center',
        clsBG,
        className
      )}>
      <span
        className="text-xs"
        data-testid="filter-count"
        title={count.toString()}>
        {count}
      </span>
    </span>
  );
};

export const errorMsg = (value: string) => {
  return (
    <div>
      <strong
        className="text-xs font-italic text-failure"
        data-testid="error-message">
        {value}
      </strong>
    </div>
  );
};

export const requiredField = (label: string, excludeSpace = false) => (
  <>
    {label}{' '}
    <span className="text-failure">{!excludeSpace && <>&nbsp;</>}*</span>
  </>
);

export const getEntityMissingError = (entityType: string, fqn: string) => {
  return (
    <p>
      {capitalize(entityType)} {t('label.instance-lowercase')}{' '}
      {t('label.for-lowercase')} <strong>{fqn}</strong>{' '}
      {t('label.not-found-lowercase')}
    </p>
  );
};

export const getEntityDeleteMessage = (entity: string, dependents: string) => {
  if (dependents) {
    return t('message.permanently-delete-metadata-and-dependents', {
      entityName: entity,
      dependents,
    });
  } else {
    return (
      <Transi18next
        i18nKey="message.permanently-delete-metadata"
        renderElement={
          <span className="font-medium" data-testid="entityName" />
        }
        values={{
          entityName: entity,
        }}
      />
    );
  }
};

export const getEntityPlaceHolder = (value: string, isDeleted?: boolean) => {
  if (isDeleted) {
    return `${value} (${t('label.deactivated')})`;
  } else {
    return value;
  }
};

export const getLoadingStatus = (
  current: CurrentState,
  id: string | undefined,
  children: ReactNode
) => {
  if (current.id === id) {
    return (
      <div>
        <Suspense fallback={null}>
          <Loader size="x-small" type="default" />
        </Suspense>
      </div>
    );
  }

  return children;
};

export const prepareLabel = (type: string, fqn: string, withQuotes = true) => {
  let label = '';
  if (type === EntityType.TABLE) {
    label = getPartialNameFromTableFQN(fqn, [FqnPart.Table]);
  } else {
    label = getPartialNameFromFQN(fqn, ['database']);
  }

  if (withQuotes) {
    return label;
  } else {
    return label.replace(/(^"|"$)/g, '');
  }
};
