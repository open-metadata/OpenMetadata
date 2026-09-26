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
import { CalendarDate } from '@internationalized/date';
import {
  BadgeWithDot,
  BadgeWithIcon,
  Box,
  Button,
  Input,
  ProgressBarBase,
  RangeCalendar,
  Select,
  TimePicker,
  TimePickerValue,
  Toggle,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock } from '@openmetadata/ui-core-components/icons';
import { ComponentProps, FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TimeIntervalType } from '../../CustomPropertyTable.interface';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.types';
import {
  DateTimeParts,
  formatDurationText,
  formatIntervalDate,
  formatIntervalTime,
  formatIntervalTooltip,
  fromDateTimeParts,
  getIntervalDurationMs,
  getZoneLabel,
  getPresetRange,
  getTimeIntervalProgress,
  ManualIntervalText,
  mergeManualInterval,
  resolveEditedInterval,
  TimeIntervalPreset,
  TimeIntervalStatus,
  TimeIntervalZone,
  toDateTimeParts,
  toEpochText,
} from './TimeIntervalPropertyValue.utils';

const STATUS_BADGE: Record<
  TimeIntervalStatus,
  { color: 'success' | 'brand' | 'gray'; labelKey: string }
> = {
  ongoing: { color: 'success', labelKey: 'message.time-interval-ongoing' },
  upcoming: { color: 'brand', labelKey: 'message.time-interval-upcoming' },
  ended: { color: 'gray', labelKey: 'message.time-interval-ended' },
};

const PRESETS: { id: TimeIntervalPreset; labelKey: string }[] = [
  { id: 'today', labelKey: 'label.today' },
  { id: 'last7Days', labelKey: 'label.last-7-days' },
  { id: 'last30Days', labelKey: 'label.last-30-days' },
  { id: 'thisMonth', labelKey: 'label.this-month' },
  { id: 'custom', labelKey: 'label.custom' },
];

const PERCENT = 100;

// @internationalized/date resolves to different patch versions in the app and
// in ui-core-components, so TypeScript sees two nominal DateValue types.
type CalendarRange = NonNullable<ComponentProps<typeof RangeCalendar>['value']>;
type CalendarDateValue = CalendarRange['start'];

const toCalendarDate = ({ year, month, day }: DateTimeParts) =>
  new CalendarDate(year, month, day) as unknown as CalendarDateValue;

const IntervalEndpoint = ({
  label,
  ms,
  zone,
  align,
}: {
  label: string;
  ms: number;
  zone: TimeIntervalZone;
  align: 'start' | 'end';
}) => {
  const { i18n } = useTranslation();

  return (
    <Box
      align={align}
      className="tw:shrink-0"
      data-testid={`time-interval-${align}`}
      direction="col"
      gap={1}>
      <Typography className="tw:text-tertiary" size="text-xs">
        {label}
      </Typography>
      <Typography className="tw:text-primary" size="text-sm" weight="semibold">
        {formatIntervalDate(ms, zone, i18n.language)}
      </Typography>
      <Tooltip title={formatIntervalTooltip(ms, i18n.language)}>
        <Typography
          className="tw:text-tertiary tw:underline tw:decoration-dotted"
          size="text-xs">
          {formatIntervalTime(ms, zone, i18n.language)}
        </Typography>
      </Tooltip>
    </Box>
  );
};

const hasBothBounds = (value: unknown): value is TimeIntervalType =>
  typeof (value as TimeIntervalType)?.start === 'number' &&
  typeof (value as TimeIntervalType)?.end === 'number';

const TimeIntervalStatusBadge = ({ value }: PropertyViewProps) => {
  const { t, i18n } = useTranslation();

  if (!hasBothBounds(value)) {
    return null;
  }

  const now = Date.now();
  const { status, remainingMs } = getTimeIntervalProgress(
    value.start,
    value.end,
    now
  );
  const statusBadge = STATUS_BADGE[status];
  const statusMs = {
    upcoming: value.start - now,
    ongoing: remainingMs,
    ended: now - value.end,
  }[status];

  return (
    <BadgeWithDot
      color={statusBadge.color}
      data-testid="time-interval-status"
      size="sm"
      type="pill-color">
      {t(statusBadge.labelKey, {
        duration: formatDurationText(statusMs, i18n.language),
      })}
    </BadgeWithDot>
  );
};

const IntervalStat = ({ label, value }: { label: string; value: string }) => (
  <Box align="center" gap={6} justify="between">
    <Typography className="tw:text-tertiary" size="text-xs">
      {label}
    </Typography>
    <Typography
      className="tw:whitespace-nowrap tw:text-primary"
      size="text-sm"
      weight="semibold">
      {value}
    </Typography>
  </Box>
);

const TimeIntervalPropertyView = ({ value }: PropertyViewProps) => {
  const { t, i18n } = useTranslation();

  // Legacy values can hold only one bound; there is no timeline to draw.
  if (!hasBothBounds(value)) {
    const { start, end } = (value ?? {}) as Partial<TimeIntervalType>;

    return (
      <Typography
        className="tw:text-secondary"
        data-testid="time-interval-value"
        size="text-sm">
        {[start, end].filter((bound) => bound !== undefined).join(' – ')}
      </Typography>
    );
  }

  const { start, end } = value;
  const { status, progress, totalMs, elapsedMs, remainingMs } =
    getTimeIntervalProgress(start, end, Date.now());
  const locale = i18n.language;
  const percent = progress * PERCENT;

  return (
    <Box
      align="center"
      data-end={end}
      data-start={start}
      data-testid="time-interval-value"
      gap={6}
      wrap="wrap">
      <Box align="center" className="tw:min-w-0 tw:flex-1" gap={6}>
        <IntervalEndpoint
          align="start"
          label={t('label.start')}
          ms={start}
          zone="local"
        />
        <Box className="tw:min-w-40 tw:flex-1" direction="col" gap={1}>
          <Box justify="center">
            <BadgeWithIcon
              color="gray"
              iconLeading={Clock}
              size="sm"
              type="modern">
              {formatDurationText(totalMs, locale)}
            </BadgeWithIcon>
          </Box>
          <div className="tw:relative tw:py-2">
            <ProgressBarBase value={percent} />
            {status === 'ongoing' && (
              <span
                aria-hidden
                className="tw:absolute tw:top-0 tw:h-6 tw:w-0.5 tw:-translate-x-1/2 tw:rounded-full tw:bg-fg-primary"
                style={{ left: `${percent}%` }}
              />
            )}
          </div>
          <div className="tw:relative tw:h-5">
            {status === 'ongoing' && (
              <Typography
                className="tw:absolute tw:-translate-x-1/2 tw:text-primary"
                size="text-xs"
                style={{ left: `${percent}%` }}
                weight="semibold">
                {t('label.now')}
              </Typography>
            )}
          </div>
        </Box>
        <IntervalEndpoint
          align="end"
          label={t('label.end')}
          ms={end}
          zone="local"
        />
      </Box>
      <Box
        className="tw:w-64 tw:border-l tw:border-secondary tw:pl-6"
        direction="col"
        gap={2}>
        <IntervalStat
          label={t('label.elapsed')}
          value={formatDurationText(elapsedMs, locale)}
        />
        <IntervalStat
          label={t('label.remaining')}
          value={formatDurationText(remainingMs, locale)}
        />
        <IntervalStat
          label={t('label.timezone')}
          value={getZoneLabel(locale)}
        />
      </Box>
    </Box>
  );
};

const toTimeValue = ({ hour, minute }: DateTimeParts): TimePickerValue => ({
  hour,
  minute,
});

const IntervalPresetList = ({
  selected,
  isDisabled,
  onSelect,
}: {
  selected: TimeIntervalPreset;
  isDisabled: boolean;
  onSelect: (preset: TimeIntervalPreset) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      aria-label={t('label.quick-select')}
      className="tw:w-36 tw:shrink-0"
      direction="col"
      gap={1}
      role="group">
      <Typography
        className="tw:px-3 tw:text-tertiary"
        size="text-xs"
        weight="medium">
        {t('label.quick-select')}
      </Typography>
      {PRESETS.map((item) => (
        <Button
          aria-pressed={selected === item.id}
          className={
            selected === item.id
              ? 'tw:justify-start tw:bg-brand-primary tw:text-brand-secondary'
              : 'tw:justify-start'
          }
          color="tertiary"
          data-testid={`time-interval-preset-${item.id}`}
          isDisabled={isDisabled}
          key={item.id}
          size="sm"
          onPress={() => onSelect(item.id)}>
          {t(item.labelKey)}
        </Button>
      ))}
    </Box>
  );
};

const IntervalEndpointEditor = ({
  label,
  parts,
  zone,
  isDisabled,
  onTimeChange,
}: {
  label: string;
  parts?: DateTimeParts;
  zone: TimeIntervalZone;
  isDisabled: boolean;
  onTimeChange: (ms: number) => void;
}) => {
  const { t, i18n } = useTranslation();

  return (
    <Box direction="col" gap={1}>
      <Typography className="tw:text-secondary" size="text-sm" weight="medium">
        {label}
      </Typography>
      <Box align="center" gap={2}>
        <Typography className="tw:min-w-28 tw:text-primary" size="text-sm">
          {parts
            ? formatIntervalDate(
                fromDateTimeParts(parts, zone),
                zone,
                i18n.language
              )
            : t('label.select-field', { field: t('label.date') })}
        </Typography>
        <TimePicker
          aria-label={`${label} ${t('label.time')}`}
          isDisabled={isDisabled || !parts}
          value={parts ? toTimeValue(parts) : null}
          onChange={(time) => {
            if (parts && time) {
              onTimeChange(fromDateTimeParts({ ...parts, ...time }, zone));
            }
          }}
        />
      </Box>
    </Box>
  );
};

const ManualIntervalInputs = ({
  start,
  end,
  isDisabled,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  isDisabled: boolean;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box gap={3} wrap="wrap">
      <Input
        aria-label={t('label.start')}
        className="tw:flex-1"
        inputDataTestId="start-input"
        isDisabled={isDisabled}
        placeholder={t('message.unix-epoch-time-in-ms', {
          prefix: t('label.start'),
        })}
        value={start}
        onChange={onStartChange}
      />
      <Input
        aria-label={t('label.end')}
        className="tw:flex-1"
        inputDataTestId="end-input"
        isDisabled={isDisabled}
        placeholder={t('message.unix-epoch-time-in-ms', {
          prefix: t('label.end'),
        })}
        value={end}
        onChange={onEndChange}
      />
    </Box>
  );
};

const IntervalCalendarPanel = ({
  label,
  start,
  end,
  zone,
  preset,
  isDisabled,
  onPresetSelect,
  onBoundsChange,
}: {
  label: string;
  start?: number;
  end?: number;
  zone: TimeIntervalZone;
  preset: TimeIntervalPreset;
  isDisabled: boolean;
  onPresetSelect: (preset: TimeIntervalPreset) => void;
  onBoundsChange: (start?: number, end?: number) => void;
}) => {
  const { t } = useTranslation();
  const startParts =
    start === undefined ? undefined : toDateTimeParts(start, zone);
  const endParts = end === undefined ? undefined : toDateTimeParts(end, zone);
  const rangeValue =
    startParts && endParts
      ? { start: toCalendarDate(startParts), end: toCalendarDate(endParts) }
      : null;

  // Picking days keeps each bound's time of day (midnight for a new bound).
  const handleRangeChange = (range: CalendarRange) => {
    const mergeDate = (date: CalendarDateValue, time?: DateTimeParts) =>
      fromDateTimeParts(
        {
          year: date.year,
          month: date.month,
          day: date.day,
          hour: time?.hour ?? 0,
          minute: time?.minute ?? 0,
        },
        zone
      );
    onBoundsChange(
      mergeDate(range.start, startParts),
      mergeDate(range.end, endParts)
    );
  };

  return (
    <Box gap={4} wrap="wrap">
      <IntervalPresetList
        isDisabled={isDisabled}
        selected={preset}
        onSelect={onPresetSelect}
      />
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={3}>
        <Box align="end" gap={3} wrap="wrap">
          <IntervalEndpointEditor
            isDisabled={isDisabled}
            label={t('label.start')}
            parts={startParts}
            zone={zone}
            onTimeChange={(ms) => onBoundsChange(ms, end)}
          />
          <IntervalEndpointEditor
            isDisabled={isDisabled}
            label={t('label.end')}
            parts={endParts}
            zone={zone}
            onTimeChange={(ms) => onBoundsChange(start, ms)}
          />
        </Box>
        <div className="tw:rounded-lg tw:border tw:border-secondary">
          <RangeCalendar
            aria-label={label}
            isDisabled={isDisabled}
            value={rangeValue}
            onChange={handleRangeChange}
          />
        </div>
      </Box>
    </Box>
  );
};

const IntervalEditFooter = ({
  isManual,
  zone,
  durationMs,
  isSaving,
  onManualChange,
  onZoneChange,
}: {
  isManual: boolean;
  zone: TimeIntervalZone;
  durationMs?: number;
  isSaving: boolean;
  onManualChange: (isManual: boolean) => void;
  onZoneChange: (zone: TimeIntervalZone) => void;
}) => {
  const { t, i18n } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:border-t tw:border-secondary tw:pt-3"
      gap={4}
      wrap="wrap">
      <Toggle
        data-testid="time-interval-manual-toggle"
        isDisabled={isSaving}
        isSelected={isManual}
        label={t('label.enter-manually')}
        size="sm"
        onChange={onManualChange}
      />
      {!isManual && (
        <Box align="center" gap={2}>
          <Typography className="tw:text-secondary" size="text-sm">
            {t('label.timezone')}
          </Typography>
          <Select
            aria-label={t('label.timezone')}
            isDisabled={isSaving}
            size="sm"
            value={zone}
            onChange={(key) => onZoneChange(key as TimeIntervalZone)}>
            <Select.Item id="local" label={t('label.local-timezone')} />
            <Select.Item id="utc" label={t('label.utc')} />
          </Select>
        </Box>
      )}
      <Box align="center" className="tw:ml-auto" gap={3}>
        {durationMs !== undefined && (
          <Typography className="tw:text-secondary" size="text-sm">
            {t('message.duration-total', {
              duration: formatDurationText(durationMs, i18n.language),
            })}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const TimeIntervalPropertyEdit = ({
  property,
  value,
  isSaving,
  onSave,
  formId,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const stored = value as Partial<TimeIntervalType> | undefined;
  const [zone, setZone] = useState<TimeIntervalZone>('local');
  const [preset, setPreset] = useState<TimeIntervalPreset>('custom');
  const [bounds, setBounds] = useState({
    start: stored?.start,
    end: stored?.end,
  });
  const [manual, setManual] = useState<ManualIntervalText>();
  const [error, setError] = useState<string>();

  const handleBoundsChange = (start?: number, end?: number) => {
    setPreset('custom');
    setError(undefined);
    setBounds({ start, end });
  };

  const handlePresetSelect = (nextPreset: TimeIntervalPreset) => {
    setPreset(nextPreset);
    setError(undefined);
    if (nextPreset !== 'custom') {
      setBounds(getPresetRange(nextPreset, Date.now(), zone));
    }
  };

  const handleManualChange = (isManual: boolean) => {
    setError(undefined);
    if (isManual) {
      setManual({
        start: toEpochText(bounds.start),
        end: toEpochText(bounds.end),
      });
    } else if (manual) {
      setBounds(mergeManualInterval(manual, bounds.start, bounds.end));
      setManual(undefined);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = resolveEditedInterval(manual, bounds.start, bounds.end);
    if (result.isValid) {
      onSave(result.value);
    } else {
      setError(t(result.errorKey));
    }
  };

  return (
    <form noValidate id={formId} onSubmit={handleSubmit}>
      <Box direction="col" gap={3}>
        {manual ? (
          <ManualIntervalInputs
            end={manual.end}
            isDisabled={isSaving}
            start={manual.start}
            onEndChange={(text) => setManual({ ...manual, end: text })}
            onStartChange={(text) => setManual({ ...manual, start: text })}
          />
        ) : (
          <IntervalCalendarPanel
            end={bounds.end}
            isDisabled={isSaving}
            label={property.displayName || property.name}
            preset={preset}
            start={bounds.start}
            zone={zone}
            onBoundsChange={handleBoundsChange}
            onPresetSelect={handlePresetSelect}
          />
        )}
        {error && (
          <Typography
            className="tw:text-error-primary"
            role="alert"
            size="text-sm">
            {error}
          </Typography>
        )}
        <IntervalEditFooter
          durationMs={getIntervalDurationMs(bounds.start, bounds.end)}
          isManual={Boolean(manual)}
          isSaving={isSaving}
          zone={zone}
          onManualChange={handleManualChange}
          onZoneChange={setZone}
        />
      </Box>
    </form>
  );
};

export const timeIntervalPropertyRenderer: CustomPropertyRenderer = {
  View: TimeIntervalPropertyView,
  Edit: TimeIntervalPropertyEdit,
  TitleAddon: TimeIntervalStatusBadge,
};
