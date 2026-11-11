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
  Checkbox,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NativeOntologyImportItem,
  Status,
} from '../../../../generated/api/data/nativeOntologyImportSummary';
import {
  isSelectableItem,
  itemsOfKind,
  NATIVE_IMPORT_ITEM_GROUPS,
  NATIVE_IMPORT_STATUS_LABEL_KEYS,
  unmetRequirement,
  UntickedDependents,
  untickWithDependents,
} from './OntologyNativeImportPanel.utils';

interface OntologyNativeImportItemsProps {
  readonly isDisabled: boolean;
  readonly items: readonly NativeOntologyImportItem[];
  readonly omittedItems: number;
  readonly selection: ReadonlySet<string>;
  readonly onSelectionChange: (selection: ReadonlySet<string>) => void;
}

const STATUS_BADGE_COLORS = {
  [Status.AlreadyExists]: 'gray',
  [Status.Duplicate]: 'warning',
  [Status.New]: 'success',
  [Status.Skipped]: 'gray',
  [Status.Update]: 'brand',
} as const satisfies Record<Status, 'gray' | 'warning' | 'success' | 'brand'>;

const withTicked = (
  selection: ReadonlySet<string>,
  ids: readonly string[]
): ReadonlySet<string> => new Set([...selection, ...ids]);

const DependentsNotice = ({
  notice,
}: {
  readonly notice: UntickedDependents;
}) => {
  const { t } = useTranslation();

  return (
    <>
      {notice.relationships > 0 && (
        <Typography color="secondary" size="text-sm">
          {t('message.native-import-also-unticked-relationship', {
            count: notice.relationships,
            name: notice.name,
          })}
        </Typography>
      )}
      {notice.rules > 0 && (
        <Typography color="secondary" size="text-sm">
          {t('message.native-import-also-unticked-rule', {
            count: notice.rules,
            name: notice.name,
          })}
        </Typography>
      )}
      {notice.properties > 0 && (
        <Typography color="secondary" size="text-sm">
          {t('message.native-import-also-unticked-property', {
            count: notice.properties,
            name: notice.name,
          })}
        </Typography>
      )}
    </>
  );
};

const ItemNotes = ({
  blockedBy,
  item,
}: {
  readonly blockedBy?: NativeOntologyImportItem;
  readonly item: NativeOntologyImportItem;
}) => {
  const { t } = useTranslation();
  const note = item.reason ?? item.detail;

  return (
    <>
      {note && (
        <Typography
          color="secondary"
          data-testid={`ontology-native-import-item-note-${item.id}`}
          size="text-xs">
          {note}
        </Typography>
      )}
      {blockedBy && (
        <Typography
          color="secondary"
          data-testid={`ontology-native-import-item-needs-${item.id}`}
          size="text-xs">
          {t('message.native-import-needs-concept', { name: blockedBy.label })}
        </Typography>
      )}
      {item.warning && (
        <Typography
          className="tw:text-warning-primary"
          data-testid={`ontology-native-import-item-warning-${item.id}`}
          size="text-xs">
          {item.warning}
        </Typography>
      )}
    </>
  );
};

const ImportItemRow = ({
  blockedBy,
  isDisabled,
  isSelected,
  item,
  onToggle,
}: {
  readonly blockedBy?: NativeOntologyImportItem;
  readonly isDisabled: boolean;
  readonly isSelected: boolean;
  readonly item: NativeOntologyImportItem;
  readonly onToggle: (isSelected: boolean) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      align="start"
      data-testid={`ontology-native-import-item-${item.id}`}
      gap={3}>
      <Checkbox
        aria-label={t('message.native-import-select-item', {
          name: item.label,
        })}
        data-testid={`ontology-native-import-item-check-${item.id}`}
        isDisabled={isDisabled || !isSelectableItem(item) || Boolean(blockedBy)}
        isSelected={isSelected}
        onChange={onToggle}
      />
      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Typography className="tw:break-words">{item.label}</Typography>
        <ItemNotes blockedBy={blockedBy} item={item} />
      </Box>
      <Badge
        color={STATUS_BADGE_COLORS[item.status]}
        data-testid={`ontology-native-import-item-status-${item.id}`}>
        {t(NATIVE_IMPORT_STATUS_LABEL_KEYS[item.status])}
      </Badge>
    </Box>
  );
};

const OntologyNativeImportItems = ({
  isDisabled,
  items,
  omittedItems,
  selection,
  onSelectionChange,
}: OntologyNativeImportItemsProps) => {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<readonly UntickedDependents[]>([]);
  const selectable = items.filter(isSelectableItem);
  const chosen = selectable.filter(({ id }) => selection.has(id)).length;
  const change = (ids: readonly string[], isSelected: boolean) => {
    if (isSelected) {
      setNotices([]);
      onSelectionChange(withTicked(selection, ids));

      return;
    }
    const unticked = untickWithDependents(items, selection, ids);
    setNotices(unticked.notices);
    onSelectionChange(unticked.selection);
  };

  return (
    <Box data-testid="ontology-native-import-items" direction="col" gap={4}>
      {items.length > 0 && (
        <Typography
          color="secondary"
          data-testid="ontology-native-import-items-found"
          size="text-sm">
          {t('message.native-import-items-found', {
            count: items.length,
            skipped: items.length - selectable.length,
          })}
        </Typography>
      )}
      {omittedItems > 0 && (
        <Typography
          color="secondary"
          data-testid="ontology-native-import-items-omitted"
          size="text-xs">
          {t('message.native-import-items-omitted', { count: omittedItems })}
        </Typography>
      )}
      <Box className="tw:max-h-96 tw:overflow-y-auto" direction="col" gap={4}>
        {NATIVE_IMPORT_ITEM_GROUPS.map(({ kind, labelKey }) => {
          const group = itemsOfKind(items, kind);
          if (group.length === 0) {
            return null;
          }
          const groupIds = group
            .filter(
              (item) =>
                isSelectableItem(item) &&
                !unmetRequirement(items, selection, item)
            )
            .map(({ id }) => id);
          const picked = groupIds.filter((id) => selection.has(id)).length;

          return (
            <Box
              data-testid={`ontology-native-import-group-${kind}`}
              direction="col"
              gap={2}
              key={kind}>
              <Checkbox
                data-testid={`ontology-native-import-group-check-${kind}`}
                isDisabled={isDisabled || groupIds.length === 0}
                isIndeterminate={picked > 0 && picked < groupIds.length}
                isSelected={groupIds.length > 0 && picked === groupIds.length}
                label={`${t(labelKey)} (${group.length})`}
                onChange={(isSelected) => change(groupIds, isSelected)}
              />
              {group.map((item) => (
                <ImportItemRow
                  blockedBy={unmetRequirement(items, selection, item)}
                  isDisabled={isDisabled}
                  isSelected={selection.has(item.id)}
                  item={item}
                  key={item.id}
                  onToggle={(isSelected) => change([item.id], isSelected)}
                />
              ))}
            </Box>
          );
        })}
      </Box>
      {notices.length > 0 && (
        <Box
          data-testid="ontology-native-import-unticked-notice"
          direction="col"
          gap={1}>
          {notices.map((notice) => (
            <DependentsNotice
              key={`${notice.name}-${notice.relationships}-${notice.rules}`}
              notice={notice}
            />
          ))}
        </Box>
      )}
      <Typography
        color="secondary"
        data-testid="ontology-native-import-selection-summary"
        size="text-sm">
        {t('message.native-import-selection-summary', {
          selected: chosen,
          total: selectable.length,
        })}
      </Typography>
    </Box>
  );
};

export default OntologyNativeImportItems;
