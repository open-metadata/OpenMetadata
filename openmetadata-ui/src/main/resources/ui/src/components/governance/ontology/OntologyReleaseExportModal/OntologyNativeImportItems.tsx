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
  Checkbox,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Kind,
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
  /** The import dialog shows these counts in its file card and footer instead. */
  readonly hasSummary?: boolean;
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
      className="tw:p-4"
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
        <Typography
          className="tw:break-words"
          color={isSelectableItem(item) ? undefined : 'secondary'}
          weight="medium">
          {item.label}
        </Typography>
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

const ImportGroup = ({
  isDisabled,
  items,
  kind,
  labelKey,
  selection,
  onChange,
}: {
  readonly isDisabled: boolean;
  readonly items: readonly NativeOntologyImportItem[];
  readonly kind: Kind;
  readonly labelKey: string;
  readonly selection: ReadonlySet<string>;
  readonly onChange: (ids: readonly string[], isSelected: boolean) => void;
}) => {
  const { t } = useTranslation();
  const group = itemsOfKind(items, kind);
  if (group.length === 0) {
    return null;
  }
  const groupIds = group
    .filter(
      (item) =>
        isSelectableItem(item) && !unmetRequirement(items, selection, item)
    )
    .map(({ id }) => id);
  const isAllPicked =
    groupIds.length > 0 && groupIds.every((id) => selection.has(id));

  return (
    <Box
      data-testid={`ontology-native-import-group-${kind}`}
      direction="col"
      gap={2}>
      <Box align="center" gap={2}>
        <Typography weight="medium">{t(labelKey)}</Typography>
        <Badge color="gray" size="sm" type="pill-color">
          {group.length}
        </Badge>
        <Button
          className="tw:ml-auto"
          color="link-color"
          data-testid={`ontology-native-import-group-check-${kind}`}
          isDisabled={isDisabled || groupIds.length === 0}
          size="sm"
          onPress={() => onChange(groupIds, !isAllPicked)}>
          {isAllPicked ? t('label.deselect-all') : t('label.select-all')}
        </Button>
      </Box>
      <Box
        className="tw:divide-y tw:divide-secondary tw:rounded-xl tw:border tw:border-secondary"
        direction="col">
        {group.map((item) => (
          <ImportItemRow
            blockedBy={unmetRequirement(items, selection, item)}
            isDisabled={isDisabled}
            isSelected={selection.has(item.id)}
            item={item}
            key={item.id}
            onToggle={(isSelected) => onChange([item.id], isSelected)}
          />
        ))}
      </Box>
    </Box>
  );
};

const OntologyNativeImportItems = ({
  hasSummary = true,
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
    <Box data-testid="ontology-native-import-items" direction="col" gap={5}>
      {hasSummary && items.length > 0 && (
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
      {NATIVE_IMPORT_ITEM_GROUPS.map(({ kind, labelKey }) => (
        <ImportGroup
          isDisabled={isDisabled}
          items={items}
          key={kind}
          kind={kind}
          labelKey={labelKey}
          selection={selection}
          onChange={change}
        />
      ))}
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
      {hasSummary && (
        <Typography
          color="secondary"
          data-testid="ontology-native-import-selection-summary"
          size="text-sm">
          {t('message.native-import-selection-summary', {
            selected: chosen,
            total: selectable.length,
          })}
        </Typography>
      )}
    </Box>
  );
};

export default OntologyNativeImportItems;
