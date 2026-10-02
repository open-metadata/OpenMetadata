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
  Checkbox,
  Divider,
  Input,
  TextArea,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import { CreateIntakeForm } from '../../generated/api/governance/createIntakeForm';
import { CustomProperty } from '../../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
  TargetEntityType,
} from '../../generated/governance/intakeForm';
import { getCustomPropertiesByEntityType } from '../../rest/metadataTypeAPI';
import {
  buildIntakeFormPayload,
  computeFieldRows,
  ENTITY_TYPE_LABEL_KEYS,
  IntakeFormFieldRow,
} from '../../utils/IntakeFormUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import intakeFormClassBase from './IntakeFormClassBase';

export interface IntakeFormDesignerBodyHandle {
  submit: () => Promise<void>;
}

interface IntakeFormDesignerBodyProps {
  entityType: TargetEntityType;
  initialValue: IntakeForm | null;
  open: boolean;
  onSubmit: (payload: CreateIntakeForm) => Promise<void> | void;
}

const IntakeFormDesignerBody = forwardRef<
  IntakeFormDesignerBodyHandle,
  IntakeFormDesignerBodyProps
>(({ entityType, initialValue, open, onSubmit }, ref) => {
  const { t } = useTranslation();
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );
  const [rows, setRows] = useState<IntakeFormFieldRow[]>([]);
  const [description, setDescription] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loadingProps, setLoadingProps] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDescription(initialValue?.description ?? '');
    setEnabled(initialValue?.enabled ?? true);
  }, [open, initialValue]);

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

  useEffect(() => {
    setRows(
      computeFieldRows({
        nativeFields: intakeFormClassBase.getNativeFields(entityType),
        customProperties,
        initialValue,
        t,
      })
    );
  }, [entityType, customProperties, initialValue, t]);

  const updateRow = useCallback(
    (path: string, patch: Partial<IntakeFormFieldRow>) => {
      setRows((prev) =>
        prev.map((row) => (row.path === path ? { ...row, ...patch } : row))
      );
    },
    []
  );

  const buildPayload = useCallback((): CreateIntakeForm => {
    const defaultDisplayName = t('label.entity-intake-form', {
      entity: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
    });

    return buildIntakeFormPayload({
      rows,
      entityType,
      name: intakeFormClassBase.getEntityTypeApiName(entityType),
      displayName: initialValue?.displayName ?? defaultDisplayName,
      description,
      enabled,
      owners: initialValue?.owners,
    });
  }, [rows, entityType, description, enabled, initialValue, t]);

  useImperativeHandle(
    ref,
    () => ({
      submit: async () => {
        await onSubmit(buildPayload());
      },
    }),
    [buildPayload, onSubmit]
  );

  const nativeRows = useMemo(
    () => rows.filter((r) => r.kind === FieldKind.Native),
    [rows]
  );
  const customRows = useMemo(
    () => rows.filter((r) => r.kind === FieldKind.CustomProperty),
    [rows]
  );

  const renderFieldRow = (
    record: IntakeFormFieldRow,
    allowOptional: boolean
  ) => (
    <Box
      align="center"
      className="tw:border-t tw:border-secondary tw:px-4 tw:py-2"
      gap={3}
      key={record.path}>
      {allowOptional && (
        <div className="tw:w-20 tw:relative">
          <Checkbox
            aria-label={`${t('label.include')} ${record.label}`}
            data-testid={`include-${record.path}`}
            isSelected={record.included}
            onChange={(included) =>
              updateRow(
                record.path,
                included
                  ? { included }
                  : { included, required: false, errorMessage: undefined }
              )
            }
          />
        </div>
      )}
      <div className="tw:w-20 tw:relative">
        <Checkbox
          aria-label={record.label}
          data-testid={`require-${record.path}`}
          isDisabled={allowOptional && !record.included}
          isSelected={record.required}
          onChange={(required) =>
            updateRow(record.path, {
              required,
              errorMessage: required ? record.errorMessage : undefined,
            })
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
          isDisabled={!record.required}
          placeholder={t('message.optional-custom-error')}
          value={record.errorMessage ?? ''}
          onChange={(value) => updateRow(record.path, { errorMessage: value })}
        />
      </div>
    </Box>
  );

  const renderFieldTable = (
    fieldRows: IntakeFormFieldRow[],
    emptyMessage: string,
    isLoading: boolean,
    allowOptional = false
  ) => (
    <Box
      className="tw:overflow-hidden tw:rounded-lg tw:outline-1 tw:outline-secondary"
      direction="col">
      <Box align="center" className="tw:bg-secondary tw:px-4 tw:py-2" gap={3}>
        {allowOptional && (
          <Typography
            className="tw:w-20 tw:text-tertiary"
            size="text-xs"
            weight="semibold">
            {t('label.include')}
          </Typography>
        )}
        <Typography
          className="tw:w-20 tw:text-tertiary"
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
        <Box className="tw:py-6" justify="center">
          <Loader size="small" />
        </Box>
      )}
      {!isLoading && fieldRows.length === 0 && (
        <Box className="tw:py-6" justify="center">
          <Typography className="tw:text-tertiary" size="text-sm">
            {emptyMessage}
          </Typography>
        </Box>
      )}
      {!isLoading &&
        fieldRows.map((field) => renderFieldRow(field, allowOptional))}
    </Box>
  );

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-6 tw:px-4 tw:pb-6 tw:pt-0 tw:md:px-6"
      data-testid="intake-form-designer-body">
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

      <Box align="center" gap={3}>
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

      <Box direction="col" gap={3}>
        <Box direction="col" gap={1}>
          <Typography size="text-md" weight="semibold">
            {t('label.native-field-plural')}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.intake-form-native-fields-help')}
          </Typography>
        </Box>
        {renderFieldTable(nativeRows, t('message.no-native-fields'), false)}
      </Box>

      <Divider />

      <Box direction="col" gap={3}>
        <Box align="center" gap={2}>
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
          loadingProps,
          true
        )}
      </Box>
    </div>
  );
});

IntakeFormDesignerBody.displayName = 'IntakeFormDesignerBody';

export default IntakeFormDesignerBody;
