/*
 *  Copyright 2025 Collate.
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
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  FormSelectItem,
  getField,
  HelperTextType,
  HookForm,
  TimePicker,
  TimePickerValue,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  MAX_LATENCY_UNITS,
  REFRESH_FREQUENCY_UNITS,
  RETENTION_UNITS,
} from '../../../constants/DataContract.constants';
import {
  ContractSLA,
  DataContract,
  Timezone,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { generateSelectOptionsFromString } from '../../../utils/DataContract/DataContractUtils';
import { getColumnOptionsFromTableColumn } from '../../../utils/TablePureUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { ContractFormStep } from '../ContractFormStep/ContractFormStep';
import './contract-sla-form-tab.less';

// Number inputs hold strings: the core Input trims its value on blur.
interface ContractSLAFormValues {
  refresh_frequency_interval: string;
  refresh_frequency_unit: FormSelectItem | null;
  max_latency_value: string;
  max_latency_unit: FormSelectItem | null;
  retention_period: string;
  retention_unit: FormSelectItem | null;
  availabilityTime: TimePickerValue | null;
  timezone: FormSelectItem | null;
  columnName: FormSelectItem | null;
}

const toItems = (options: Array<{ label: string; value: string }>) =>
  options.map<FormSelectItem>(({ label, value }) => ({ id: value, label }));

const findItem = (items: FormSelectItem[], id?: string) =>
  items.find((item) => item.id === id) ?? null;

// The backend resolves a bare `columnName` against top-level columns only,
// case-insensitively (`ODCSTableTarget.resolveColumn`), so a leaf name may only
// resolve to a top-level column FQN; a struct child sharing the name would
// retarget the SLA. Anything unmatched returns null and is preserved on save.
const findColumnItem = (
  items: FormSelectItem[],
  topLevelIds: Set<string>,
  id?: string
) => {
  if (!id) {
    return null;
  }
  const name = id.toLowerCase();

  return (
    items.find((item) => item.id === id) ??
    items.find(
      (item) => topLevelIds.has(item.id) && item.label?.toLowerCase() === name
    ) ??
    null
  );
};

const toNumberString = (value?: number) =>
  value === undefined ? '' : String(value);

const toNonNegative = (value?: string) =>
  value === undefined || value === '' || Number(value) < 0
    ? undefined
    : Number(value);

// Parse an `HH:mm` prefix tolerantly so documented, server-supported values
// such as "09:00 UTC" round-trip through the form instead of being dropped.
const toTimeValue = (time?: string): TimePickerValue | null => {
  const match = (time ?? '').trim().match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return Number.isInteger(hour) && Number.isInteger(minute)
    ? { hour, minute }
    : null;
};

const toTimeString = ({ hour, minute }: TimePickerValue) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

// For a modeled SLA field, decide its fate on save:
//  - emit the form value when the form holds one (overwriting the spread),
//  - remove the field once the user has *touched* it and then cleared it,
//  - otherwise leave the value already spread from `storedSLA`, so data the
//    form cannot round-trip (e.g. "09:00 UTC" availabilityTime, a leaf-name
//    columnName, or unmodeled keys) survives instead of becoming a `remove`.
// Tracking "touched" (instead of "seedable") means a field the form could not
// seed but the user later selected and then cleared is still removed, rather
// than silently reverting to the stored value the form cannot represent.
const applyModelledField = (
  hasFormValue: boolean,
  wasTouched: boolean,
  emit: () => void,
  remove: () => void
) => {
  if (hasFormValue) {
    emit();
  } else if (wasTouched) {
    remove();
  }
};

// Maps each RHF field name to the SLA key group it belongs to, so a single
// "touched" set can track whether the user interacted with any of the form
// fields that feed a given SLA attribute.
const SLA_FIELD_GROUP: Partial<Record<keyof ContractSLAFormValues, string>> = {
  availabilityTime: 'availabilityTime',
  timezone: 'timezone',
  columnName: 'columnName',
  max_latency_value: 'maxLatency',
  max_latency_unit: 'maxLatency',
  refresh_frequency_interval: 'refreshFrequency',
  refresh_frequency_unit: 'refreshFrequency',
  retention_period: 'retention',
  retention_unit: 'retention',
};

const toContractSLA = (
  values: Partial<ContractSLAFormValues>,
  storedSLA: ContractSLA = {},
  touched: Set<string>
): ContractSLA => {
  // Start from the stored SLA so unmodeled/extra keys and values the form
  // cannot round-trip survive a save instead of becoming JSON-Patch `remove`
  // ops (ContractSLA is an open type, e.g. "09:00 UTC" availabilityTime,
  // leaf-name columnName, or custom keys added out-of-band).
  const sla: ContractSLA = { ...storedSLA };
  const refreshInterval = toNonNegative(values.refresh_frequency_interval);
  const maxLatency = toNonNegative(values.max_latency_value);
  const retention = toNonNegative(values.retention_period);

  applyModelledField(
    Boolean(values.availabilityTime),
    touched.has('availabilityTime'),
    () => {
      if (values.availabilityTime) {
        sla.availabilityTime = toTimeString(values.availabilityTime);
      }
    },
    () => {
      delete sla.availabilityTime;
    }
  );

  applyModelledField(
    Boolean(values.timezone),
    touched.has('timezone'),
    () => {
      if (values.timezone) {
        sla.timezone = values.timezone.id as Timezone;
      }
    },
    () => {
      delete sla.timezone;
    }
  );

  applyModelledField(
    Boolean(values.columnName),
    touched.has('columnName'),
    () => {
      if (values.columnName) {
        sla.columnName = values.columnName.id;
      }
    },
    () => {
      delete sla.columnName;
    }
  );

  applyModelledField(
    Boolean(values.max_latency_unit) && maxLatency !== undefined,
    touched.has('maxLatency'),
    () => {
      if (values.max_latency_unit && maxLatency !== undefined) {
        sla.maxLatency = {
          unit: values.max_latency_unit.id as NonNullable<
            ContractSLA['maxLatency']
          >['unit'],
          value: maxLatency,
        };
      }
    },
    () => {
      delete sla.maxLatency;
    }
  );

  applyModelledField(
    Boolean(values.refresh_frequency_unit) && refreshInterval !== undefined,
    touched.has('refreshFrequency'),
    () => {
      if (values.refresh_frequency_unit && refreshInterval !== undefined) {
        sla.refreshFrequency = {
          interval: refreshInterval,
          unit: values.refresh_frequency_unit.id as NonNullable<
            ContractSLA['refreshFrequency']
          >['unit'],
        };
      }
    },
    () => {
      delete sla.refreshFrequency;
    }
  );

  applyModelledField(
    Boolean(values.retention_unit) && retention !== undefined,
    touched.has('retention'),
    () => {
      if (values.retention_unit && retention !== undefined) {
        sla.retention = {
          period: retention,
          unit: values.retention_unit.id as NonNullable<
            ContractSLA['retention']
          >['unit'],
        };
      }
    },
    () => {
      delete sla.retention;
    }
  );

  return sla;
};

export const ContractSLAFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({ onChange, onPrev, buttonProps, initialValues }) => {
  const { t } = useTranslation();
  const { data: tableData } = useGenericContext();

  const { columnItems, topLevelColumnIds } = useMemo(() => {
    const { columns } = tableData as Table;

    return {
      columnItems: isEmpty(columns)
        ? []
        : toItems(getColumnOptionsFromTableColumn(columns, true)),
      topLevelColumnIds: new Set(
        (columns ?? []).map(
          (column) => column.fullyQualifiedName ?? column.name
        )
      ),
    };
  }, [tableData]);

  const { refreshUnitItems, latencyUnitItems, retentionUnitItems } = useMemo(
    () => ({
      refreshUnitItems: toItems(
        generateSelectOptionsFromString(REFRESH_FREQUENCY_UNITS)
      ),
      latencyUnitItems: toItems(
        generateSelectOptionsFromString(MAX_LATENCY_UNITS)
      ),
      retentionUnitItems: toItems(
        generateSelectOptionsFromString(RETENTION_UNITS)
      ),
    }),
    []
  );

  const timezoneItems = useMemo<FormSelectItem[]>(
    () => Object.values(Timezone).map((tz) => ({ id: tz, label: tz })),
    []
  );

  const toFormValues = (
    contract?: Partial<DataContract>
  ): ContractSLAFormValues => {
    const sla = contract?.sla;

    return {
      refresh_frequency_interval: toNumberString(
        sla?.refreshFrequency?.interval
      ),
      refresh_frequency_unit: findItem(
        refreshUnitItems,
        sla?.refreshFrequency?.unit
      ),
      max_latency_value: toNumberString(sla?.maxLatency?.value),
      max_latency_unit: findItem(latencyUnitItems, sla?.maxLatency?.unit),
      retention_period: toNumberString(sla?.retention?.period),
      retention_unit: findItem(retentionUnitItems, sla?.retention?.unit),
      availabilityTime: toTimeValue(sla?.availabilityTime),
      timezone: findItem(timezoneItems, sla?.timezone),
      columnName: findColumnItem(
        columnItems,
        topLevelColumnIds,
        sla?.columnName
      ),
    };
  };

  const form = useForm<ContractSLAFormValues>({
    defaultValues: toFormValues(initialValues),
    mode: 'onChange',
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(toFormValues(initialValues));
    }
  }, [initialValues]);

  // Keep the latest stored SLA available to the `watch` subscription without
  // forcing a re-subscribe whenever the parent re-renders the contract.
  const storedSLARef = useRef<ContractSLA | undefined>(initialValues?.sla);
  useEffect(() => {
    storedSLARef.current = initialValues?.sla;
  });

  // Track which SLA field groups the user has touched, so a cleared value is
  // removed even when the form could not seed the stored value (e.g. an
  // unparseable availabilityTime or an unmatched columnName). Reset whenever
  // a new contract is loaded.
  const touchedSLAFieldsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (initialValues) {
      touchedSLAFieldsRef.current = new Set();
    }
  }, [initialValues]);

  useEffect(() => {
    const { unsubscribe } = form.watch((values, { type, name }) => {
      if (type === 'change') {
        const group = name
          ? SLA_FIELD_GROUP[name as keyof ContractSLAFormValues]
          : undefined;
        if (group) {
          touchedSLAFieldsRef.current.add(group);
        }
        onChange({
          sla: toContractSLA(
            values as ContractSLAFormValues,
            storedSLARef.current ?? {},
            touchedSLAFieldsRef.current
          ),
        });
      }
    });

    return unsubscribe;
  }, [form, onChange]);

  const numberField = (
    name: keyof ContractSLAFormValues,
    label: string,
    testId: string
  ): FieldProp => ({
    id: name,
    label,
    name,
    placeholder: t('label.enter-entity', { entity: label }),
    props: { 'data-testid': testId, size: 'md' },
    required: true,
    rules: {
      required: t('message.field-text-is-required', { fieldText: label }),
      min: {
        value: 0,
        message: t('message.entity-size-less-than', { entity: label, min: 0 }),
      },
    },
    type: FieldTypes.NUMBER,
  });

  const unitField = (
    name: keyof ContractSLAFormValues,
    options: FormSelectItem[],
    testId: string
  ): FieldProp => ({
    id: name,
    label: t('label.unit'),
    name,
    placeholder: t('label.select-entity', { entity: t('label.unit') }),
    props: { 'data-testid': testId, options, size: 'md' },
    required: true,
    type: FieldTypes.SELECT,
  });

  const renderCard = (
    title: string,
    description: string,
    children: ReactNode
  ) => (
    <div className="sla-form-card-container">
      <Typography className="sla-form-card-title">{title}</Typography>
      <Typography className="sla-form-card-description">
        {description}
      </Typography>
      {children}
    </div>
  );

  const renderPair = (left: ReactNode, right: ReactNode) => (
    <div className="tw:grid tw:grid-cols-2 tw:gap-6">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );

  return (
    <ContractFormStep
      className="sla-container"
      description={t('message.data-contract-sla-description')}
      prevLabel={buttonProps.prevLabel}
      title={t('label.sla')}
      onPrev={onPrev}>
      <HookForm className="tw:flex tw:flex-col tw:gap-3" form={form}>
        {renderCard(
          t('label.refresh-frequency'),
          t('message.refresh-frequency-contract-description'),
          renderPair(
            getField(
              numberField(
                'refresh_frequency_interval',
                t('label.interval'),
                'refresh-frequency-interval-input'
              )
            ),
            getField(
              unitField(
                'refresh_frequency_unit',
                refreshUnitItems,
                'refresh-frequency-unit-select'
              )
            )
          )
        )}
        {renderCard(
          t('label.max-latency'),
          t('message.max-latency-contract-description'),
          renderPair(
            getField(
              numberField(
                'max_latency_value',
                t('label.value'),
                'max-latency-value-input'
              )
            ),
            getField(
              unitField(
                'max_latency_unit',
                latencyUnitItems,
                'max-latency-unit-select'
              )
            )
          )
        )}
        {renderCard(
          t('label.availability-time'),
          t('message.availability-time-contract-description'),
          renderPair(
            <FormField control={form.control} name="availabilityTime">
              {({ field }) => (
                <Box className="tw:gap-1.5" direction="col">
                  <FormItemLabel label={t('label.time')} />
                  <TimePicker
                    aria-label={t('label.time')}
                    data-testid="availability"
                    hourCycle={24}
                    size="md"
                    value={field.value}
                    onChange={field.onChange}
                  />
                </Box>
              )}
            </FormField>,
            getField({
              helperText: t(
                'message.contract-sla-timezone-availability-default'
              ),
              helperTextType: HelperTextType.TOOLTIP,
              id: 'timezone',
              label: t('label.timezone'),
              name: 'timezone',
              placeholder: t('label.select-entity', {
                entity: t('label.timezone'),
              }),
              props: {
                'data-testid': 'timezone-select',
                options: timezoneItems,
              },
              type: FieldTypes.AUTOCOMPLETE,
            })
          )
        )}
        {renderCard(
          t('label.retention'),
          t('message.time-line-data-retention-description'),
          renderPair(
            getField(
              numberField(
                'retention_period',
                t('label.period'),
                'retention-period-input'
              )
            ),
            getField(
              unitField(
                'retention_unit',
                retentionUnitItems,
                'retention-unit-select'
              )
            )
          )
        )}
        {renderCard(
          t('label.column'),
          t('message.contract-sla-column-name-description'),
          getField({
            id: 'columnName-select',
            label: t('label.column-name'),
            name: 'columnName',
            placeholder: t('label.please-enter-entity-name', {
              entity: t('label.column'),
            }),
            props: {
              'data-testid': 'columnName-select',
              options: columnItems,
            },
            type: FieldTypes.AUTOCOMPLETE,
          })
        )}
      </HookForm>
    </ContractFormStep>
  );
};
