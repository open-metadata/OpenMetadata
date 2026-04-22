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
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Button } from '@openmetadata/ui-core-components';
import { ChevronDown, Edit01, Trash01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { CreateIntakeForm } from '../../generated/api/governance/createIntakeForm';
import {
  FieldKind,
  IntakeForm,
  TargetEntityType,
} from '../../generated/governance/intakeForm';
import {
  createIntakeForm,
  createOrUpdateIntakeForm,
  deleteIntakeForm,
  listIntakeForms,
  patchIntakeForm,
} from '../../rest/intakeFormsAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import IntakeFormDesignerModal from './IntakeFormDesignerModal';

const ENTITY_TYPE_LABEL_KEYS: Record<TargetEntityType, string> = {
  [TargetEntityType.DataProduct]: 'label.data-product',
  [TargetEntityType.Domain]: 'label.domain',
  [TargetEntityType.GlossaryTerm]: 'label.glossary-term',
};

const IntakeFormsPage = () => {
  const { t } = useTranslation();
  const entityTypeLabel = useCallback(
    (et: TargetEntityType) => t(ENTITY_TYPE_LABEL_KEYS[et]),
    [t]
  );
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalState, setModalState] = useState<{
    open: boolean;
    entityType: TargetEntityType;
    initialValue: IntakeForm | null;
  }>({
    open: false,
    entityType: TargetEntityType.DataProduct,
    initialValue: null,
  });
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IntakeForm | null>(null);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listIntakeForms({
        fields: 'owners,requiredFields',
      });
      setForms(response.data ?? []);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const existingEntityTypes = useMemo(
    () => new Set(forms.map((f) => f.entityType)),
    [forms]
  );

  const allEntityTypesCovered =
    existingEntityTypes.size === Object.values(TargetEntityType).length;

  const openAddMenu = (event: MouseEvent<HTMLElement>) => {
    setAddMenuAnchor(event.currentTarget);
  };
  const closeAddMenu = () => setAddMenuAnchor(null);

  const handleCreate = (entityType: TargetEntityType) => {
    closeAddMenu();
    setModalState({ open: true, entityType, initialValue: null });
  };

  const handleEdit = (form: IntakeForm) => {
    setModalState({
      open: true,
      entityType: form.entityType,
      initialValue: form,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }
    const form = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteIntakeForm(form.id);
      showSuccessToast(t('message.intake-form-deleted-successfully'));
      await fetchForms();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const handleToggleEnabled = async (form: IntakeForm, enabled: boolean) => {
    try {
      // PATCH just /enabled. A PUT with the CreateIntakeForm payload would
      // replace the whole entity and the backend mapper copies owners from
      // the request — so any previously set owners would be cleared.
      await patchIntakeForm(form.id, [
        { op: 'replace', path: '/enabled', value: enabled },
      ]);
      showSuccessToast(t('message.intake-form-updated-successfully'));
      await fetchForms();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const handleSubmit = async (payload: CreateIntakeForm) => {
    // The designer modal is responsible for carrying forward server-managed
    // fields like `owners` on edit (see IntakeFormDesignerModal#handleOk) —
    // we just hand the payload to the API verbatim.
    try {
      if (modalState.initialValue) {
        await createOrUpdateIntakeForm(payload);
        showSuccessToast(t('message.intake-form-updated-successfully'));
      } else {
        await createIntakeForm(payload);
        showSuccessToast(t('message.intake-form-created-successfully'));
      }
      setModalState({
        open: false,
        entityType: TargetEntityType.DataProduct,
        initialValue: null,
      });
      await fetchForms();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}>
        <PageHeader
          data={{
            header: t('label.intake-form-plural'),
            subHeader: t('message.intake-form-plural-description'),
          }}
        />
        <Tooltip
          title={
            allEntityTypesCovered
              ? t('message.intake-form-all-types-covered')
              : ''
          }>
          <span>
            <Button
              color="primary"
              data-testid="add-intake-form"
              iconTrailing={ChevronDown}
              isDisabled={allEntityTypesCovered}
              size="sm"
              onClick={openAddMenu}>
              {t('label.add-entity', { entity: t('label.intake-form') })}
            </Button>
          </span>
        </Tooltip>
        <Menu
          anchorEl={addMenuAnchor}
          data-testid="add-intake-form-menu"
          open={Boolean(addMenuAnchor)}
          onClose={closeAddMenu}>
          {Object.values(TargetEntityType).map((et) => {
            const alreadyExists = existingEntityTypes.has(et);

            return (
              <MenuItem
                data-testid={`add-${et}`}
                disabled={alreadyExists}
                key={et}
                onClick={() => handleCreate(et)}>
                {alreadyExists
                  ? `${entityTypeLabel(et)} (${t('label.already-configured')})`
                  : entityTypeLabel(et)}
              </MenuItem>
            );
          })}
        </Menu>
      </Box>

      <TableContainer>
        <Table data-testid="intake-forms-table" size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('label.entity-type')}</TableCell>
              <TableCell>{t('label.required-fields')}</TableCell>
              <TableCell>{t('label.enabled')}</TableCell>
              <TableCell>{t('label.action-plural')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell align="center" colSpan={4}>
                  <CircularProgress data-testid="intake-forms-loading" />
                </TableCell>
              </TableRow>
            )}
            {!loading && forms.length === 0 && (
              <TableRow>
                <TableCell align="center" colSpan={4}>
                  <Typography color="text.secondary" variant="body2">
                    {t('label.none')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              forms.map((record) => (
                <TableRow
                  data-testid={`row-${record.entityType}`}
                  key={record.id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>
                      {entityTypeLabel(record.entityType)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="column" spacing={0.5}>
                      {(record.requiredFields ?? []).map((rf) => (
                        <Chip
                          color={
                            rf.fieldKind === FieldKind.CustomProperty
                              ? 'secondary'
                              : 'primary'
                          }
                          key={rf.fieldPath}
                          label={
                            <>
                              {rf.fieldLabel}
                              <Typography
                                className="tw:ml-1"
                                color="text.secondary"
                                component="span"
                                variant="caption">
                                ({rf.fieldPath})
                              </Typography>
                            </>
                          }
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {(record.requiredFields ?? []).length === 0 && (
                        <Typography color="text.secondary" variant="body2">
                          {t('label.none')}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={record.enabled ?? false}
                      data-testid={`toggle-${record.entityType}`}
                      onChange={(e) =>
                        handleToggleEnabled(record, e.target.checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title={t('label.edit')}>
                        <IconButton
                          data-testid={`edit-${record.entityType}`}
                          size="small"
                          onClick={() => handleEdit(record)}>
                          <Edit01 height={16} width={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('label.delete')}>
                        <IconButton
                          color="error"
                          data-testid={`delete-${record.entityType}`}
                          size="small"
                          onClick={() => setDeleteTarget(record)}>
                          <Trash01 height={16} width={16} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        data-testid="intake-form-delete-confirm"
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}>
        <DialogTitle>
          {t('label.delete-entity', {
            entity: t('label.entity-intake-form', {
              entity: deleteTarget
                ? entityTypeLabel(deleteTarget.entityType)
                : '',
            }),
          })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('message.delete-intake-form-confirmation')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            color="tertiary"
            size="sm"
            onClick={() => setDeleteTarget(null)}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary-destructive"
            size="sm"
            onClick={handleDeleteConfirm}>
            {t('label.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {modalState.open && (
        <IntakeFormDesignerModal
          entityType={modalState.entityType}
          initialValue={modalState.initialValue}
          open={modalState.open}
          onCancel={() =>
            setModalState({
              open: false,
              entityType: TargetEntityType.DataProduct,
              initialValue: null,
            })
          }
          onSubmit={handleSubmit}
        />
      )}
    </Box>
  );
};

export default IntakeFormsPage;
