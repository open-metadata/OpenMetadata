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
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Input,
  SlideoutMenu,
  TextArea,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import { CreateIntakeForm } from '../../generated/api/governance/createIntakeForm';
import { CustomProperty } from '../../generated/entity/type';
import {
  FieldKind,
  IntakeFormField,
  TargetEntityType,
} from '../../generated/governance/intakeForm';
import { getCustomPropertiesByEntityType } from '../../rest/metadataTypeAPI';
import { toLegacyRequiredFields } from '../../utils/IntakeFormUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import intakeFormClassBase from './IntakeFormClassBase';
import { IntakeFormDesignerModalProps } from './IntakeFormDesignerModal.interface';
import { IntakeFormNativeField } from './intakeFormFields';

interface FieldRow {
  path: string;
  label: string;
  kind: FieldKind;
  /** Whether this field is included (visible) on the intake form. */
  selected: boolean;
  /** Whether this field is required (must be filled). Only meaningful when selected=true. */
  required: boolean;
  errorMessage?: string;
  // True when this row corresponds to a previously-required custom property
  // whose definition is no longer in the current metadata-type lookup —
  // shown so the admin can deselect it deliberately instead of losing the
  // constraint silently on save.
  isOrphan?: boolean;
}

const ENTITY_TYPE_LABEL_KEYS: Record<TargetEntityType, string> = {
  [TargetEntityType.DataProduct]: 'label.data-product',
  [TargetEntityType.Domain]: 'label.domain',
  [TargetEntityType.GlossaryTerm]: 'label.glossary-term',
};

const IntakeFormDesignerModal = ({
  open,
  entityType,
  initialValue,
  onCancel,
  onSubmit,
}: IntakeFormDesignerModalProps) => {
  const { t } = useTranslation();
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [description, setDescription] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loadingProps, setLoadingProps] = useState(false);

  // Sync local UI state from the initialValue each time the modal opens
  useEffect(() => {
    if (!open) {
      return;
    }
    setDescription(initialValue?.description ?? '');
    setEnabled(initialValue?.enabled ?? true);
  }, [open, initialValue]);

  // Fetch custom properties defined on the target entity type
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoadingProps(true);
    getCustomPropertiesByEntityType(
      intakeFormClassBase.getEntityTypeApiName(entityType)
    )
      .then((props) => {
        if (!cancelled) {
          setCustomProperties(props ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCustomProperties([]);
          showErrorToast(err as AxiosError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProps(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, entityType]);

  // Rebuild rows whenever the data backing them changes.
  // Supports both the new `formFields` schema and the legacy `requiredFields` schema.
  useEffect(() => {
    const natives: IntakeFormNativeField[] =
      intakeFormClassBase.getNativeFields(entityType);

    // Build a unified lookup: path → { selected, required, errorMessage }
    // Prefer formFields (new schema) over requiredFields (legacy).
    const existingByPath = new Map<
      string,
      { selected: boolean; required: boolean; errorMessage?: string }
    >();

    if (initialValue?.formFields && initialValue.formFields.length > 0) {
      for (const ff of initialValue.formFields) {
        existingByPath.set(ff.fieldPath, {
          selected: true,
          required: ff.required ?? false,
          errorMessage: ff.errorMessage,
        });
      }
    } else {
      for (const rf of initialValue?.requiredFields ?? []) {
        existingByPath.set(rf.fieldPath, {
          selected: true,
          required: true,
          errorMessage: rf.errorMessage,
        });
      }
    }

    const nativeRows: FieldRow[] = natives.map((nf) => {
      const existing = existingByPath.get(nf.path);

      return {
        path: nf.path,
        label: t(nf.labelKey),
        kind: FieldKind.Native,
        selected: Boolean(existing?.selected),
        required: existing?.required ?? false,
        errorMessage: existing?.errorMessage,
      };
    });

    const customPropertyPaths = new Set(
      customProperties.map((cp) => `extension.${cp.name}`)
    );
    const customRows: FieldRow[] = customProperties.map((cp) => {
      const path = `extension.${cp.name}`;
      const existing = existingByPath.get(path);

      return {
        path,
        label: cp.displayName ?? cp.name ?? path,
        kind: FieldKind.CustomProperty,
        selected: Boolean(existing?.selected),
        required: existing?.required ?? false,
        errorMessage: existing?.errorMessage,
      };
    });

    // Preserve previously-required custom-property fields whose definition is
    // missing from the current metadata-type lookup. Without this, rebuilding
    // rows when the custom-property fetch returns an empty list (real empty,
    // or after a transient error followed by an empty cache) silently drops
    // any extension.* required field on save. We surface them as an orphan
    // row so the admin can deselect them deliberately.
    const orphanCustomRows: FieldRow[] = Array.from(existingByPath.entries())
      .filter(
        ([path, state]) =>
          state.selected &&
          path.startsWith('extension.') &&
          !customPropertyPaths.has(path)
      )
      .map(([path, state]) => ({
        path,
        label: path,
        kind: FieldKind.CustomProperty,
        selected: true,
        required: state.required,
        errorMessage: state.errorMessage,
        isOrphan: true,
      }));

    setRows([...nativeRows, ...customRows, ...orphanCustomRows]);
  }, [entityType, customProperties, initialValue, t]);

  const updateRow = useCallback((path: string, patch: Partial<FieldRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.path === path ? { ...row, ...patch } : row))
    );
  }, []);

  const handleOk = async () => {
    // Build the new-schema formFields list (includes both included and required flags).
    const formFields: IntakeFormField[] = rows
      .filter((row) => row.selected)
      .map((row) => ({
        fieldPath: row.path,
        fieldLabel: row.label,
        fieldKind: row.kind,
        required: row.required,
        errorMessage: row.errorMessage || undefined,
      }));

    // Also derive the legacy requiredFields for backwards compatibility with
    // API consumers that only read requiredFields.
    const requiredFields = toLegacyRequiredFields(formFields);

    // One intake form per entity type — name is deterministically derived.
    // On edit, keep whatever displayName the form already has (users may
    // have renamed it via API). On create, fall back to a localized default
    // of "<Entity> <IntakeForm>" so the listing shows a meaningful label
    // without forcing the user to type one.
    const name = intakeFormClassBase.getEntityTypeApiName(entityType);
    const defaultDisplayName = t('label.entity-intake-form', {
      entity: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
    });
    const displayName = initialValue?.displayName ?? defaultDisplayName;
    const payload: CreateIntakeForm = {
      name,
      displayName,
      description: description || undefined,
      entityType,
      enabled,
      formFields,
      requiredFields,
      // Carry forward server-managed fields on edit. The designer UI doesn't
      // expose an owners picker today, but `createOrUpdateIntakeForm` PUTs
      // the whole entity — without this, any previously configured owners
      // would be silently wiped. If/when the designer grows an owners widget,
      // it can overwrite this value before submit.
      ...(initialValue?.owners ? { owners: initialValue.owners } : {}),
    };
    await onSubmit(payload);
  };

  const nativeRows = useMemo(
    () => rows.filter((r) => r.kind === FieldKind.Native),
    [rows]
  );
  const customRows = useMemo(
    () => rows.filter((r) => r.kind === FieldKind.CustomProperty),
    [rows]
  );

  const renderFieldRow = (record: FieldRow) => (
    <Box
      align="center"
      className="tw:gap-3 tw:border-t tw:border-secondary tw:px-4 tw:py-2"
      key={record.path}>
      <div className="tw:w-16">
        <Checkbox
          aria-label={`${t('label.include')} ${record.label}`}
          data-testid={`include-${record.path}`}
          isSelected={record.selected}
          onChange={(isSelected) =>
            updateRow(record.path, {
              selected: isSelected,
              // Clear required when deselecting
              required: isSelected ? record.required : false,
            })
          }
        />
      </div>
      <div className="tw:w-16">
        <Checkbox
          aria-label={`${t('label.required')} ${record.label}`}
          data-testid={`require-${record.path}`}
          isDisabled={!record.selected}
          isSelected={record.selected && record.required}
          onChange={(isRequired) =>
            updateRow(record.path, { required: isRequired })
          }
        />
      </div>
      <Box className="tw:flex-1" direction="col">
        <Typography size="text-sm" weight="semibold">
          {record.label}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {record.path}
        </Typography>
      </Box>
      <div className="tw:flex-1">
        <Input
          aria-label={t('label.custom-error-message')}
          data-testid={`error-${record.path}`}
          isDisabled={!record.selected || !record.required}
          placeholder={t('message.optional-custom-error')}
          value={record.errorMessage ?? ''}
          onChange={(value) => updateRow(record.path, { errorMessage: value })}
        />
      </div>
    </Box>
  );

  const renderFieldTable = (
    fieldRows: FieldRow[],
    emptyMessage: string,
    isLoading: boolean
  ) => (
    <Box
      className="tw:overflow-hidden tw:rounded-lg tw:ring-1 tw:ring-secondary"
      direction="col">
      <Box align="center" className="tw:gap-3 tw:bg-secondary tw:px-4 tw:py-2">
        <Typography
          className="tw:w-16 tw:text-tertiary"
          size="text-xs"
          weight="semibold">
          {t('label.include')}
        </Typography>
        <Typography
          className="tw:w-16 tw:text-tertiary"
          size="text-xs"
          weight="semibold">
          {t('label.required')}
        </Typography>
        <Typography
          className="tw:flex-1 tw:text-tertiary"
          size="text-xs"
          weight="semibold">
          {t('label.field')}
        </Typography>
        <Typography
          className="tw:flex-1 tw:text-tertiary"
          size="text-xs"
          weight="semibold">
          {t('label.custom-error-message')}
        </Typography>
      </Box>
      {isLoading && (
        <Box className="tw:justify-center tw:py-6">
          <Loader size="small" />
        </Box>
      )}
      {!isLoading && fieldRows.length === 0 && (
        <Box className="tw:justify-center tw:py-6">
          <Typography className="tw:text-tertiary" size="text-sm">
            {emptyMessage}
          </Typography>
        </Box>
      )}
      {!isLoading && fieldRows.map(renderFieldRow)}
    </Box>
  );

  const title = initialValue
    ? t('label.edit-entity', {
        entity: t('label.entity-intake-form', {
          entity: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
        }),
      })
    : t('label.add-entity', {
        entity: t('label.entity-intake-form', {
          entity: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
        }),
      });

  return (
    <SlideoutMenu
      isDismissable
      dialogClassName="tw:overflow-hidden!"
      isOpen={open}
      width={900}
      onOpenChange={(isOpenState) => {
        if (!isOpenState) {
          onCancel();
        }
      }}>
      {() => (
        <>
          <SlideoutMenu.Header onClose={onCancel}>
            <Typography size="text-lg" weight="semibold">
              {title}
            </Typography>
          </SlideoutMenu.Header>

          <SlideoutMenu.Content
            className="tw:relative tw:min-h-0 tw:flex-1 tw:overflow-hidden! tw:p-0!"
            data-testid="intake-form-designer-modal">
            {/* Content is absolutely positioned so it stays out of flow: its
                intrinsic height can't feed back into the flex-sized panel, so a
                row re-render (toggling a checkbox) can never move the footer. */}
            <div className="tw:absolute tw:inset-0 tw:flex tw:flex-col tw:gap-6 tw:overflow-y-auto tw:px-4 tw:py-6 tw:md:px-6">
              <Alert
                title={t('message.intake-form-one-per-type-help', {
                  entityType: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
                })}
                variant="brand"
              />

              <Box className="tw:gap-1.5" direction="col">
                <Typography size="text-sm" weight="semibold">
                  {t('label.description')}
                </Typography>
                <TextArea
                  aria-label={t('label.description')}
                  data-testid="intake-form-description"
                  placeholder={t('message.intake-form-description-placeholder')}
                  value={description}
                  onChange={setDescription}
                />
              </Box>

              <Box align="center" className="tw:gap-3">
                <Typography size="text-sm" weight="semibold">
                  {t('label.enabled')}
                </Typography>
                <Toggle
                  aria-label={t('label.enabled')}
                  data-testid="intake-form-enabled"
                  isSelected={enabled}
                  onChange={setEnabled}
                />
                <Typography className="tw:text-tertiary" size="text-sm">
                  {t('message.intake-form-enabled-help')}
                </Typography>
              </Box>

              <Divider />

              <Box className="tw:gap-3" direction="col">
                <Box className="tw:gap-1" direction="col">
                  <Typography size="text-md" weight="semibold">
                    {t('label.native-field-plural')}
                  </Typography>
                  <Typography className="tw:text-tertiary" size="text-sm">
                    {t('message.intake-form-native-fields-help')}
                  </Typography>
                </Box>
                {renderFieldTable(
                  nativeRows,
                  t('message.no-native-fields'),
                  false
                )}
              </Box>

              <Divider />

              <Box className="tw:gap-3" direction="col">
                <Box align="center" className="tw:gap-2">
                  <Typography size="text-md" weight="semibold">
                    {t('label.custom-property-plural')}
                  </Typography>
                  <Badge color="gray" size="sm" type="pill-color">
                    {customRows.length}
                  </Badge>
                </Box>
                <Typography className="tw:text-tertiary" size="text-sm">
                  {t('message.intake-form-custom-properties-help')}
                </Typography>
                {renderFieldTable(
                  customRows,
                  t('message.no-custom-properties-defined'),
                  loadingProps
                )}
              </Box>
            </div>
          </SlideoutMenu.Content>

          <SlideoutMenu.Footer>
            <Box className="tw:justify-end tw:gap-3">
              <Button
                color="tertiary"
                data-testid="intake-form-cancel"
                size="sm"
                onClick={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="intake-form-submit"
                size="sm"
                onClick={handleOk}>
                {initialValue ? t('label.save') : t('label.create')}
              </Button>
            </Box>
          </SlideoutMenu.Footer>
        </>
      )}
    </SlideoutMenu>
  );
};

export default IntakeFormDesignerModal;
