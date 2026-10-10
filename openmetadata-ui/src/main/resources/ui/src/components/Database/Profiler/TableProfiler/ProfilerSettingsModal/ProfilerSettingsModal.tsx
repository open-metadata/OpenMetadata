/*
 *  Copyright 2022 Collate.
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
  Autocomplete,
  Box,
  Button,
  FormField,
  FormItemLabel,
  FormSelectItem,
  Grid,
  HintText,
  HookForm,
  Input,
  NumberInput,
  Select,
  SlideoutMenu,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01, XClose } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { lazy, useEffect, useMemo, useState } from 'react';
import { FieldPath, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  INTERVAL_TYPE_OPTIONS,
  INTERVAL_UNIT_OPTIONS,
  MIN_PROFILE_SAMPLE,
  PROFILE_SAMPLE_OPTIONS,
  SUPPORTED_COLUMN_DATA_TYPE_FOR_INTERVAL,
  TIME_BASED_PARTITION,
} from '../../../../../constants/profiler.constant';
import { CSMode } from '../../../../../enums/codemirror.enum';
import {
  PartitionIntervalTypes,
  ProfileSampleType,
  TableProfilerConfig,
} from '../../../../../generated/entity/data/table';
import {
  getTableProfilerConfig,
  putTableProfileConfig,
} from '../../../../../rest/tableAPI';
import { getLayoutGutter } from '../../../../../utils/common/layout.utils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import withSuspenseFallback from '../../../../AppRouter/withSuspenseFallback';
import Loader from '../../../../common/Loader/Loader';
import SliderWithInput from '../../../../common/SliderWithInput/SliderWithInput';
import '../table-profiler.less';
import { ProfilerSettingsModalProps } from '../TableProfiler.interface';
import { ProfilerColumnSelect } from './ProfilerColumnSelect';
import { ProfilerMetricSelect } from './ProfilerMetricSelect';
import {
  DEFAULT_VALUES,
  getProfilerSelectItems,
  ProfilerSettingsValues,
  toFormValues,
  toProfilerConfig,
} from './ProfilerSettingsModal.utils';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../SchemaEditor/SchemaEditor'))
);

const ProfilerSettingsModal = ({
  tableId,
  columns,
  visible,
  onVisibilityChange,
}: ProfilerSettingsModalProps) => {
  const { t } = useTranslation();
  const form = useForm<ProfilerSettingsValues>({
    defaultValues: DEFAULT_VALUES,
  });
  const { reset } = form;
  const [storedConfig, setStoredConfig] = useState<TableProfilerConfig>();
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const values = useWatch({ control: form.control });
  const includeColumns = useFieldArray({
    control: form.control,
    name: 'includeColumns',
  });
  const partitionValues = useFieldArray({
    control: form.control,
    name: 'partitionValues',
  });
  const enablePartition = values.enablePartitioning ?? false;
  const partitionIntervalType = values.partitionIntervalType;
  const sampleType = values.profileSampleType;
  const columnItems = useMemo(
    () => columns.map(({ name }) => ({ id: name, label: name })),
    [columns]
  );
  const columnWithAll = useMemo(
    () => [{ id: 'all', label: t('label.all') }, ...columnItems],
    [columnItems, t]
  );
  const partitionColumnItems = useMemo(
    () =>
      columns
        .filter(
          (column) =>
            partitionIntervalType &&
            SUPPORTED_COLUMN_DATA_TYPE_FOR_INTERVAL[
              partitionIntervalType
            ].includes(column.dataType)
        )
        .map(({ name }) => ({ id: name, label: name })),
    [columns, partitionIntervalType]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsDataLoading(true);
      try {
        const { tableProfilerConfig } = await getTableProfilerConfig(tableId);
        if (active) {
          setStoredConfig(tableProfilerConfig);
          reset(
            tableProfilerConfig
              ? toFormValues(tableProfilerConfig)
              : DEFAULT_VALUES
          );
        }
      } catch (error) {
        if (active) {
          showErrorToast(
            error as AxiosError,
            t('server.fetch-table-profiler-config-error')
          );
        }
      } finally {
        if (active) {
          setIsDataLoading(false);
        }
      }
    };
    if (tableId) {
      load();
    } else {
      setIsDataLoading(false);
    }

    return () => {
      active = false;
    };
  }, [tableId, reset, t]);

  const handleCancel = () => {
    reset(storedConfig ? toFormValues(storedConfig) : DEFAULT_VALUES);
    onVisibilityChange(false);
  };

  const resetPartitionFields = () => {
    form.setValue('partitionColumnName', undefined);
    form.setValue('partitionIntegerRangeStart', undefined);
    form.setValue('partitionIntegerRangeEnd', undefined);
    form.setValue('partitionIntervalUnit', undefined);
    form.setValue('partitionInterval', undefined);
    partitionValues.replace([{ value: '' }]);
  };

  const handleSave = async (data: ProfilerSettingsValues) => {
    const profileConfig = toProfilerConfig(data);
    setIsLoading(true);
    try {
      const response = await putTableProfileConfig(tableId, profileConfig);
      if (!response) {
        throw new Error(
          t('server.entity-updating-error', {
            entity: t('label.profile-config'),
          })
        );
      }
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.profile-config') })
      );
      onVisibilityChange(false);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', { entity: t('label.profile-config') })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const required = (label: string) =>
    enablePartition
      ? { required: t('message.field-text-is-required', { fieldText: label }) }
      : undefined;
  const selectField = ({
    name,
    label,
    items,
    testId,
    placeholder,
    isDisabled = false,
    isRequired = false,
    searchable = false,
    onChange,
  }: {
    name: FieldPath<ProfilerSettingsValues>;
    label?: string;
    items: { id: string; label: string }[];
    testId: string;
    placeholder: string;
    isDisabled?: boolean;
    isRequired?: boolean;
    searchable?: boolean;
    onChange?: () => void;
  }) => {
    const accessibleLabel = label ?? placeholder;

    return (
      <FormField
        control={form.control}
        name={name}
        rules={isRequired ? required(accessibleLabel) : undefined}>
        {({ field, fieldState }) => {
          const key = typeof field.value === 'string' ? field.value : null;
          const completeItems = getProfilerSelectItems(items, key);
          const handleSelection = (selection: string | number | null) => {
            if (selection !== null) {
              field.onChange(String(selection));
              onChange?.();
            }
          };
          const content = (item: FormSelectItem) => (
            <Select.Item id={item.id}>{item.label}</Select.Item>
          );

          return (
            <Box direction="col" gap={2}>
              {label && (
                <FormItemLabel
                  label={label}
                  required={isRequired && enablePartition}
                />
              )}
              <Box align="center" gap={1}>
                {searchable ? (
                  <ProfilerColumnSelect
                    isDisabled={isDisabled}
                    isInvalid={fieldState.invalid}
                    items={completeItems}
                    label={accessibleLabel}
                    placeholder={placeholder}
                    selectedKey={key}
                    testId={testId}
                    onBlur={field.onBlur}
                    onSelectionChange={handleSelection}
                  />
                ) : (
                  <Select
                    aria-label={accessibleLabel}
                    className="tw:min-w-0 tw:flex-1"
                    data-testid={testId}
                    fontSize="sm"
                    isDisabled={isDisabled}
                    isInvalid={fieldState.invalid}
                    items={completeItems}
                    placeholder={placeholder}
                    selectedKey={key}
                    onBlur={field.onBlur}
                    onSelectionChange={handleSelection}>
                    {content}
                  </Select>
                )}
                {key !== null && !isDisabled && (
                  <Button
                    aria-label={`${t('label.clear')} ${accessibleLabel}`}
                    color="tertiary"
                    iconLeading={XClose}
                    size="xxs"
                    onPress={() => {
                      field.onChange(undefined);
                      onChange?.();
                    }}
                  />
                )}
              </Box>
              {fieldState.error && (
                <HintText isInvalid>{fieldState.error.message}</HintText>
              )}
            </Box>
          );
        }}
      </FormField>
    );
  };

  const numberField = (
    name:
      | 'profileSampleRows'
      | 'sampleDataCount'
      | 'partitionIntegerRangeStart'
      | 'partitionIntegerRangeEnd'
      | 'partitionInterval',
    label: string,
    testId: string,
    placeholder: string,
    min?: number,
    partition = false
  ) => (
    <FormField
      control={form.control}
      name={name}
      rules={partition ? required(label) : undefined}>
      {({ field, fieldState }) => (
        <NumberInput
          {...field}
          hint={fieldState.error?.message}
          inputDataTestId={testId}
          isDisabled={partition && !enablePartition}
          isInvalid={fieldState.invalid}
          label={label}
          minValue={min}
          placeholder={placeholder}
          value={field.value ?? NaN}
          onChange={(value) =>
            field.onChange(Number.isNaN(value) ? undefined : value)
          }
        />
      )}
    </FormField>
  );

  const content = isDataLoading ? (
    <Box align="center" className="profiler-settings-loader" justify="center">
      <Loader />
    </Box>
  ) : (
    <HookForm
      autoComplete="off"
      className="profiler-settings-drawer-content"
      form={form}
      id="profiler-setting-form"
      validationBehavior="aria"
      onSubmit={form.handleSubmit(handleSave)}>
      <Grid className="layout-row layout-grid" style={getLayoutGutter(16, 16)}>
        <Grid.Item
          className="layout-column"
          data-testid="profile-sample-container"
          span={24}>
          <Box
            className="profiler-settings-form"
            data-testid="configure-ingestion-container"
            direction="col"
            gap={6}>
            {selectField({
              name: 'profileSampleType',
              label: t('label.profile-sample-type', { type: '' }),
              items: PROFILE_SAMPLE_OPTIONS.map(({ value, label }) => ({
                id: value,
                label,
              })),
              testId: 'profile-sample',
              placeholder: t('label.please-select-entity', {
                entity: t('label.profile-sample-type', { type: '' }),
              }),
            })}
            {sampleType === ProfileSampleType.Percentage && (
              <FormField control={form.control} name="profileSamplePercentage">
                {({ field }) => (
                  <Box direction="col" gap={2}>
                    <FormItemLabel
                      label={t('label.profile-sample-type', {
                        type: t('label.value'),
                      })}
                    />
                    <SliderWithInput
                      className="p-x-xs"
                      min={MIN_PROFILE_SAMPLE}
                      value={field.value ?? undefined}
                      onChange={field.onChange}
                    />
                  </Box>
                )}
              </FormField>
            )}
            {sampleType === ProfileSampleType.Rows &&
              numberField(
                'profileSampleRows',
                t('label.profile-sample-type', { type: t('label.value') }),
                'metric-number-input',
                t('label.please-enter-value', {
                  name: t('label.row-count-lowercase'),
                }),
                MIN_PROFILE_SAMPLE
              )}
            {numberField(
              'sampleDataCount',
              t('label.sample-data-count'),
              'sample-data-count-input',
              t('label.please-enter-value', {
                name: t('label.sample-data-count-lowercase'),
              }),
              0
            )}
          </Box>
        </Grid.Item>
        <Grid.Item
          className="layout-column"
          data-testid="sql-editor-container"
          span={24}>
          <FormField control={form.control} name="profileQuery">
            {({ field }) => (
              <Box direction="col" gap={2}>
                <FormItemLabel
                  label={t('label.profile-sample-type', {
                    type: t('label.query'),
                  })}
                />
                <SchemaEditor
                  className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                  data-testid="profiler-setting-sql-editor"
                  mode={{ name: CSMode.SQL }}
                  refreshEditor={visible}
                  value={field.value}
                  onChange={field.onChange}
                />
              </Box>
            )}
          </FormField>
        </Grid.Item>
        <Grid.Item
          className="layout-column"
          data-testid="exclude-column-container"
          span={24}>
          <Box direction="col" gap={1}>
            <Typography as="p">{t('message.enable-column-profile')}</Typography>
            <Typography as="p" size="text-xs">
              {t('label.exclude')}:
            </Typography>
            <FormField control={form.control} name="excludeColumns">
              {({ field }) => (
                <Box align="center" gap={2}>
                  <Autocomplete
                    aria-label={t('label.exclude')}
                    className="tw:flex-1"
                    data-testid="exclude-column-select"
                    icon={null}
                    items={columnItems}
                    placeholder={t('label.select-column-plural-to-exclude')}
                    selectedItems={field.value.map(
                      (id) =>
                        columnItems.find((item) => item.id === id) ?? {
                          id,
                          label: id,
                        }
                    )}
                    onItemCleared={(id) =>
                      field.onChange(
                        field.value.filter((value) => value !== id)
                      )
                    }
                    onItemInserted={(id) =>
                      field.onChange([...new Set([...field.value, String(id)])])
                    }>
                    {(item) => (
                      <Autocomplete.Item id={item.id} textValue={item.label}>
                        {item.label}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete>
                  {field.value.length > 0 && (
                    <Button
                      aria-label={t('label.clear')}
                      color="tertiary"
                      data-testid="clear-excluded-columns"
                      iconLeading={XClose}
                      size="xs"
                      onPress={() => field.onChange([])}
                    />
                  )}
                </Box>
              )}
            </FormField>
          </Box>
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <Box direction="col" gap={2}>
            <Box align="center" gap={2}>
              <Typography as="p" size="text-xs">
                {t('label.include')}:
              </Typography>
              <Button
                aria-label={t('label.add-entity', {
                  entity: t('label.column'),
                })}
                iconLeading={Plus}
                size="xs"
                onPress={() => includeColumns.append({ metrics: ['all'] })}
              />
            </Box>
            <Box
              className={
                includeColumns.fields.length > 1
                  ? 'tw:max-h-40 tw:overflow-y-auto'
                  : undefined
              }
              data-testid="include-column-container"
              direction="col"
              gap={4}>
              {includeColumns.fields.map((row, index) => (
                <Grid
                  className="layout-row layout-grid"
                  key={row.id}
                  style={getLayoutGutter(16)}>
                  <Grid.Item className="layout-column" span={12}>
                    {selectField({
                      name: `includeColumns.${index}.columnName`,
                      items: columnWithAll,
                      testId: 'include-column-select',
                      placeholder: t('label.select-column-plural-to-include'),
                      searchable: true,
                    })}
                  </Grid.Item>
                  <Grid.Item className="layout-column" span={12}>
                    <Box align="start" gap={1}>
                      <Box className="tw:min-w-0 tw:flex-1">
                        <FormField
                          control={form.control}
                          name={`includeColumns.${index}.metrics`}>
                          {({ field }) => (
                            <ProfilerMetricSelect
                              testId={`include-metrics-${index}`}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          )}
                        </FormField>
                      </Box>
                      <Button
                        aria-label={t('label.remove-entity', {
                          entity: t('label.column'),
                        })}
                        color="tertiary"
                        iconLeading={Trash01}
                        size="xs"
                        onPress={() => includeColumns.remove(index)}
                      />
                    </Box>
                  </Grid.Item>
                </Grid>
              ))}
            </Box>
          </Box>
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <FormField control={form.control} name="enablePartitioning">
            {({ field }) => (
              <Box align="center" gap={3}>
                <Typography as="p">{t('label.enable-partition')}</Typography>
                <Toggle
                  aria-label={t('label.enable-partition')}
                  data-testid="enable-partition-switch"
                  isSelected={field.value}
                  size="sm"
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue('partitionIntervalType', undefined);
                    resetPartitionFields();
                  }}
                />
              </Box>
            )}
          </FormField>
        </Grid.Item>
        <Grid.Item className="layout-column" span={12}>
          {selectField({
            name: 'partitionIntervalType',
            label: t('label.interval-type'),
            items: INTERVAL_TYPE_OPTIONS.map(({ value, label }) => ({
              id: value,
              label,
            })),
            testId: 'interval-type',
            placeholder: t('message.select-interval-type'),
            isDisabled: !enablePartition,
            isRequired: true,
            onChange: resetPartitionFields,
          })}
        </Grid.Item>
        <Grid.Item className="layout-column" span={12}>
          {selectField({
            name: 'partitionColumnName',
            label: t('label.column-entity', { entity: t('label.name') }),
            items: partitionColumnItems,
            testId: 'column-name',
            placeholder: t('message.select-column-name'),
            isDisabled: !enablePartition,
            isRequired: true,
            searchable: true,
          })}
        </Grid.Item>
        {partitionIntervalType &&
          TIME_BASED_PARTITION.includes(partitionIntervalType) && (
            <>
              <Grid.Item className="layout-column" span={12}>
                {numberField(
                  'partitionInterval',
                  t('label.interval'),
                  'interval-required',
                  t('message.enter-interval'),
                  undefined,
                  true
                )}
              </Grid.Item>
              <Grid.Item className="layout-column" span={12}>
                {selectField({
                  name: 'partitionIntervalUnit',
                  label: t('label.interval-unit'),
                  items: INTERVAL_UNIT_OPTIONS.map(({ value, label }) => ({
                    id: value,
                    label,
                  })),
                  testId: 'select-interval-unit',
                  placeholder: t('message.select-interval-unit'),
                  isDisabled: !enablePartition,
                  isRequired: true,
                })}
              </Grid.Item>
            </>
          )}
        {partitionIntervalType === PartitionIntervalTypes.IntegerRange && (
          <>
            <Grid.Item className="layout-column" span={12}>
              {numberField(
                'partitionIntegerRangeStart',
                t('label.start-entity', { entity: t('label.range') }),
                'start-range',
                t('message.enter-a-field', {
                  field: t('label.start-entity', { entity: t('label.range') }),
                }),
                undefined,
                true
              )}
            </Grid.Item>
            <Grid.Item className="layout-column" span={12}>
              {numberField(
                'partitionIntegerRangeEnd',
                t('label.end-entity', { entity: t('label.range') }),
                'end-range',
                t('message.enter-a-field', {
                  field: t('label.end-entity', { entity: t('label.range') }),
                }),
                undefined,
                true
              )}
            </Grid.Item>
          </>
        )}
        {partitionIntervalType === PartitionIntervalTypes.ColumnValue && (
          <Grid.Item className="layout-column" span={24}>
            <Box direction="col" gap={4}>
              <Box align="center" gap={2}>
                <Typography as="p" size="text-xs">
                  {t('label.value')}:
                </Typography>
                <Button
                  aria-label={t('label.add-entity', {
                    entity: t('label.value'),
                  })}
                  iconLeading={Plus}
                  size="xs"
                  onPress={() => partitionValues.append({ value: '' })}
                />
              </Box>
              {partitionValues.fields.map((row, index) => (
                <Box align="start" gap={2} key={row.id}>
                  <Box className="tw:flex-1">
                    <FormField
                      control={form.control}
                      name={`partitionValues.${index}.value`}
                      rules={required(t('label.value'))}>
                      {({ field, fieldState }) => (
                        <Input
                          {...field}
                          aria-label={`${t('label.value')} ${index + 1}`}
                          hint={fieldState.error?.message}
                          inputDataTestId="partition-value"
                          isDisabled={!enablePartition}
                          isInvalid={fieldState.invalid}
                          placeholder={t('message.enter-a-field', {
                            field: t('label.value'),
                          })}
                        />
                      )}
                    </FormField>
                  </Box>
                  <Button
                    aria-label={t('label.remove-entity', {
                      entity: t('label.value'),
                    })}
                    color="tertiary"
                    iconLeading={Trash01}
                    size="xs"
                    onPress={() => partitionValues.remove(index)}
                  />
                </Box>
              ))}
            </Box>
          </Grid.Item>
        )}
      </Grid>
    </HookForm>
  );

  return (
    <SlideoutMenu
      aria-label={t('label.setting-plural')}
      className="profiler-settings-drawer tw:min-w-96 tw:z-50"
      data-testid="profiler-settings-modal"
      dialogClassName="tw:gap-0"
      isDismissable={false}
      isOpen={visible}
      width="40%"
      onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <SlideoutMenu.Header onClose={handleCancel}>
        <Typography size="text-md" weight="semibold">
          {t('label.setting-plural')}
        </Typography>
      </SlideoutMenu.Header>
      <SlideoutMenu.Content className="tw:py-6">{content}</SlideoutMenu.Content>
      <SlideoutMenu.Footer>
        <Box className="drawer-footer-actions" gap={4}>
          <Button color="secondary" onPress={handleCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            form="profiler-setting-form"
            isLoading={isLoading}
            type="submit">
            {t('label.save')}
          </Button>
        </Box>
      </SlideoutMenu.Footer>
    </SlideoutMenu>
  );
};

export default ProfilerSettingsModal;
