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
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Button } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateIntakeForm } from '../../generated/api/governance/createIntakeForm';
import { CustomProperty } from '../../generated/entity/type';
import {
  FieldKind,
  RequiredField,
  TargetEntityType,
} from '../../generated/governance/intakeForm';
import { getCustomPropertiesByEntityType } from '../../rest/metadataTypeAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { IntakeFormDesignerModalProps } from './IntakeFormDesignerModal.interface';
import {
  ENTITY_TYPE_API_NAME,
  IntakeFormNativeField,
  NATIVE_FIELDS_BY_ENTITY_TYPE,
} from './intakeFormFields';

interface FieldRow {
  path: string;
  label: string;
  kind: FieldKind;
  selected: boolean;
  errorMessage?: string;
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
    getCustomPropertiesByEntityType(ENTITY_TYPE_API_NAME[entityType])
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

  // Rebuild rows whenever the data backing them changes
  useEffect(() => {
    const natives: IntakeFormNativeField[] =
      NATIVE_FIELDS_BY_ENTITY_TYPE[entityType] ?? [];
    const existingSelections = new Map<string, RequiredField>(
      (initialValue?.requiredFields ?? []).map((rf) => [rf.fieldPath, rf])
    );

    const nativeRows: FieldRow[] = natives.map((nf) => {
      const existing = existingSelections.get(nf.path);

      return {
        path: nf.path,
        label: t(nf.labelKey),
        kind: FieldKind.Native,
        selected: Boolean(existing),
        errorMessage: existing?.errorMessage,
      };
    });

    const customRows: FieldRow[] = customProperties.map((cp) => {
      const path = `extension.${cp.name}`;
      const existing = existingSelections.get(path);

      return {
        path,
        label: cp.displayName ?? cp.name ?? path,
        kind: FieldKind.CustomProperty,
        selected: Boolean(existing),
        errorMessage: existing?.errorMessage,
      };
    });

    setRows([...nativeRows, ...customRows]);
  }, [entityType, customProperties, initialValue, t]);

  const updateRow = useCallback((path: string, patch: Partial<FieldRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.path === path ? { ...row, ...patch } : row))
    );
  }, []);

  const handleOk = async () => {
    const requiredFields: RequiredField[] = rows
      .filter((row) => row.selected)
      .map((row) => ({
        fieldPath: row.path,
        fieldLabel: row.label,
        fieldKind: row.kind,
        errorMessage: row.errorMessage || undefined,
      }));

    // One intake form per entity type — name is deterministically derived.
    // On edit, keep whatever displayName the form already has (users may
    // have renamed it via API). On create, fall back to a localized default
    // of "<Entity> <IntakeForm>" so the listing shows a meaningful label
    // without forcing the user to type one.
    const name = ENTITY_TYPE_API_NAME[entityType];
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
    <TableRow key={record.path}>
      <TableCell sx={{ width: 90 }}>
        <Checkbox
          checked={record.selected}
          inputProps={
            {
              'aria-label': record.label,
              'data-testid': `require-${record.path}`,
            } as Record<string, unknown>
          }
          onChange={(e) =>
            updateRow(record.path, { selected: e.target.checked })
          }
        />
      </TableCell>
      <TableCell>
        <Typography sx={{ fontWeight: 600 }}>{record.label}</Typography>
        <Typography color="text.secondary" variant="caption">
          {record.path}
        </Typography>
      </TableCell>
      <TableCell>
        <TextField
          fullWidth
          InputProps={{
            // MUI's InputBaseComponentProps type is narrow; cast to allow the
            // data-testid attribute that Playwright selectors rely on.
            inputProps: {
              'data-testid': `error-${record.path}`,
            } as Record<string, unknown>,
          }}
          disabled={!record.selected}
          placeholder={t('message.optional-custom-error')}
          size="small"
          value={record.errorMessage ?? ''}
          onChange={(e) =>
            updateRow(record.path, { errorMessage: e.target.value })
          }
        />
      </TableCell>
    </TableRow>
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
    <Drawer
      PaperProps={{ sx: { width: '75%' } }}
      anchor="right"
      data-testid="intake-form-designer-modal"
      open={open}
      onClose={onCancel}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}>
          <Typography variant="h6">{title}</Typography>
          <Stack direction="row" spacing={1}>
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
          </Stack>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('message.intake-form-one-per-type-help', {
              entityType: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
            })}
          </Alert>

          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('label.description')}
            </Typography>
            <TextField
              fullWidth
              multiline
              InputProps={{
                inputProps: {
                  'data-testid': 'intake-form-description',
                } as Record<string, unknown>,
              }}
              maxRows={4}
              minRows={2}
              placeholder={t('message.intake-form-description-placeholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Box>

          <Stack
            alignItems="center"
            direction="row"
            spacing={1.5}
            sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 600 }}>
              {t('label.enabled')}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  inputProps={
                    {
                      'data-testid': 'intake-form-enabled',
                    } as Record<string, unknown>
                  }
                  onChange={(e) => setEnabled(e.target.checked)}
                />
              }
              label=""
            />
            <Typography color="text.secondary" variant="body2">
              {t('message.intake-form-enabled-help')}
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontWeight: 600 }} variant="h6">
            {t('label.native-field-plural')}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }} variant="body2">
            {t('message.intake-form-native-fields-help')}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 90 }}>
                    {t('label.required')}
                  </TableCell>
                  <TableCell>{t('label.field')}</TableCell>
                  <TableCell>{t('label.custom-error-message')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {nativeRows.length === 0 && (
                  <TableRow>
                    <TableCell align="center" colSpan={3}>
                      <Typography color="text.secondary" variant="body2">
                        {t('message.no-native-fields')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {nativeRows.map(renderFieldRow)}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 2 }} />

          <Stack alignItems="center" direction="row" spacing={1}>
            <Typography sx={{ fontWeight: 600 }} variant="h6">
              {t('label.custom-property-plural')}
            </Typography>
            <Chip label={customRows.length} size="small" />
          </Stack>
          <Typography color="text.secondary" sx={{ mb: 1 }} variant="body2">
            {t('message.intake-form-custom-properties-help')}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 90 }}>
                    {t('label.required')}
                  </TableCell>
                  <TableCell>{t('label.field')}</TableCell>
                  <TableCell>{t('label.custom-error-message')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingProps && (
                  <TableRow>
                    <TableCell align="center" colSpan={3}>
                      <CircularProgress size={20} />
                    </TableCell>
                  </TableRow>
                )}
                {!loadingProps && customRows.length === 0 && (
                  <TableRow>
                    <TableCell align="center" colSpan={3}>
                      <Typography color="text.secondary" variant="body2">
                        {t('message.no-custom-properties-defined')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loadingProps && customRows.map(renderFieldRow)}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </Drawer>
  );
};

export default IntakeFormDesignerModal;
