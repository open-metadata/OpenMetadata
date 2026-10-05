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
import { Badge } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MutationOp } from '../../../generated/governance/changeRequest/changeRequest';
import {
  buildChangeSections,
  ChangeEntry,
  ChangeKind,
  ChangeValue,
} from './ChangeRequestChanges.utils';

interface ChangeRequestChangesProps {
  ops?: MutationOp[];
}

const KIND_COLOR = {
  [ChangeKind.Added]: 'success',
  [ChangeKind.Removed]: 'error',
  [ChangeKind.Updated]: 'brand',
} as const;

const ValueList = ({
  values,
  struck = false,
}: {
  values: ChangeValue[];
  struck?: boolean;
}) => (
  <span
    className={`tw:flex tw:flex-wrap tw:gap-x-2 tw:gap-y-1 tw:break-all ${
      struck ? 'tw:line-through tw:text-tertiary' : 'tw:text-secondary'
    }`}>
    {values.map((value) =>
      value.link ? (
        <Link
          className="tw:text-brand-secondary"
          key={value.text}
          to={value.link}>
          {value.text}
        </Link>
      ) : (
        <span key={value.text}>{value.text}</span>
      )
    )}
  </span>
);

const EntryRow = ({
  change,
  testIdPrefix,
}: {
  change: ChangeEntry;
  testIdPrefix: string;
}) => {
  const { t } = useTranslation();
  const kindLabel = {
    [ChangeKind.Added]: t('label.added'),
    [ChangeKind.Removed]: t('label.removed'),
    [ChangeKind.Updated]: t('label.updated'),
  }[change.kind];

  return (
    <li
      className="tw:flex tw:flex-col tw:gap-1 tw:text-sm"
      data-testid={`${testIdPrefix}-${change.field}-${change.kind}`}>
      <span className="tw:flex tw:items-center tw:gap-2">
        <span className="tw:font-medium tw:text-primary">
          {startCase(change.field)}
        </span>
        <Badge color={KIND_COLOR[change.kind]} size="sm">
          {kindLabel}
        </Badge>
      </span>
      {change.previous.length > 0 && (
        <span className="tw:flex tw:gap-2">
          <span className="tw:text-tertiary">{t('label.previous')}</span>
          <ValueList struck values={change.previous} />
        </span>
      )}
      <ValueList
        struck={change.kind === ChangeKind.Removed}
        values={change.values}
      />
    </li>
  );
};

/**
 * What a change request proposes, read field by field: each change says whether it adds, removes
 * or updates a value, shows the previous value of an update, and links tags, glossary terms and
 * entities by their fully qualified name. Column changes are listed per column.
 */
const ChangeRequestChanges = ({ ops }: ChangeRequestChangesProps) => {
  const { t } = useTranslation();
  const sections = useMemo(() => buildChangeSections(ops), [ops]);

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-3"
      data-testid="change-request-changes">
      {sections.map((section) => {
        const testIdPrefix = section.column
          ? `change-column-${section.column}`
          : 'change';

        return (
          <div
            className="tw:flex tw:flex-col tw:gap-2"
            data-testid={section.column ? testIdPrefix : 'change-asset'}
            key={section.column ?? 'asset'}>
            {section.column && (
              <span className="tw:text-sm tw:font-semibold tw:text-primary">
                {`${t('label.column')} ${section.column}`}
              </span>
            )}
            <ul
              className={`tw:flex tw:flex-col tw:gap-2 ${
                section.column ? 'tw:pl-3' : ''
              }`}>
              {section.entries.map((change) => (
                <EntryRow
                  change={change}
                  key={`${change.field}-${change.kind}`}
                  testIdPrefix={testIdPrefix}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default ChangeRequestChanges;
