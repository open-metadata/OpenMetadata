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
import { Badge, Typography } from '@openmetadata/ui-core-components';
import { groupBy, startCase } from 'lodash';
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

const ValueChip = ({
  value,
  removed = false,
}: {
  value: ChangeValue;
  removed?: boolean;
}) => {
  const label = removed ? value.text : `+ ${value.text}`;

  return (
    <Badge
      className={`tw:size-auto tw:max-w-full tw:whitespace-normal tw:break-words ${
        removed ? 'tw:line-through' : ''
      }`}
      color={removed ? 'error' : 'success'}
      size="sm"
      type="color">
      {value.link ? (
        <Link className="tw:text-current" to={value.link}>
          {label}
        </Link>
      ) : (
        label
      )}
    </Badge>
  );
};

const EntryChips = ({
  change,
  testIdPrefix,
}: {
  change: ChangeEntry;
  testIdPrefix: string;
}) => (
  <span
    className="tw:contents"
    data-testid={`${testIdPrefix}-${change.field}-${change.kind}`}>
    {change.previous.map((value) => (
      <ValueChip removed key={`previous-${value.text}`} value={value} />
    ))}
    {change.values.map((value) => (
      <ValueChip
        key={value.text}
        removed={change.kind === ChangeKind.Removed}
        value={value}
      />
    ))}
  </span>
);

// `+1 added · −1 removed`, or `updated` for a replaced single value.
const useFieldSummary = (entries: ChangeEntry[]) => {
  const { t } = useTranslation();
  const count = (kind: ChangeKind) =>
    entries
      .filter((change) => change.kind === kind)
      .reduce((sum, change) => sum + change.values.length, 0);
  const added = count(ChangeKind.Added);
  const removed = count(ChangeKind.Removed);

  return [
    added ? t('label.count-added', { count: added }) : '',
    removed ? t('label.count-removed', { count: removed }) : '',
    count(ChangeKind.Updated) ? t('label.updated-lowercase') : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

const FieldChanges = ({
  field,
  entries,
  testIdPrefix,
}: {
  field: string;
  entries: ChangeEntry[];
  testIdPrefix: string;
}) => {
  const summary = useFieldSummary(entries);

  return (
    <li className="tw:flex tw:flex-col tw:gap-2">
      <span className="tw:flex tw:items-baseline tw:gap-2">
        <Typography as="span" size="text-sm" weight="semibold">
          {startCase(field)}
        </Typography>
        <Typography as="span" className="tw:text-tertiary" size="text-xs">
          {summary}
        </Typography>
      </span>
      <div className="tw:flex tw:flex-wrap tw:gap-1.5">
        {entries.map((change) => (
          <EntryChips
            change={change}
            key={`${change.field}-${change.kind}`}
            testIdPrefix={testIdPrefix}
          />
        ))}
      </div>
    </li>
  );
};

/**
 * What a change request proposes, read field by field: each field lists the values it gains and
 * loses (an update shows the previous value struck through), and links tags, glossary terms and
 * entities by their fully qualified name. Column changes are listed per column.
 */
const ChangeRequestChanges = ({ ops }: ChangeRequestChangesProps) => {
  const { t } = useTranslation();
  const sections = useMemo(() => buildChangeSections(ops), [ops]);

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-5"
      data-testid="change-request-changes">
      {sections.map((section) => {
        const testIdPrefix = section.column
          ? `change-column-${section.column}`
          : 'change';

        return (
          <div
            className="tw:flex tw:flex-col tw:gap-3"
            data-testid={section.column ? testIdPrefix : 'change-asset'}
            key={section.column ?? 'asset'}>
            {section.column && (
              <Typography as="span" size="text-sm" weight="semibold">
                {`${t('label.column')} ${section.column}`}
              </Typography>
            )}
            <ul
              className={`tw:flex tw:flex-col tw:gap-4 ${
                section.column ? 'tw:pl-3' : ''
              }`}>
              {Object.entries(groupBy(section.entries, 'field')).map(
                ([field, entries]) => (
                  <FieldChanges
                    entries={entries}
                    field={field}
                    key={field}
                    testIdPrefix={testIdPrefix}
                  />
                )
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default ChangeRequestChanges;
