import { cx, sortCx } from '@/utils/cx';
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { SliderProps as AriaSliderProps } from 'react-aria-components';
import {
  Label as AriaLabel,
  Slider as AriaSlider,
  SliderOutput as AriaSliderOutput,
  SliderThumb as AriaSliderThumb,
  SliderTrack as AriaSliderTrack,
} from 'react-aria-components';
import { createPortal } from 'react-dom';

const styles = sortCx({
  default: 'tw:hidden',
  bottom:
    'tw:absolute tw:top-2 tw:left-1/2 tw:-translate-x-1/2 tw:translate-y-full tw:text-md tw:font-medium tw:text-primary',
  top: 'tw:absolute tw:bottom-2 tw:left-1/2 tw:-translate-x-1/2 tw:-translate-y-full tw:text-md tw:font-medium tw:text-primary',
  'top-floating': 'tw:sr-only',
  'bottom-floating': 'tw:sr-only',
});

interface SliderProps extends AriaSliderProps {
  label?: ReactNode;
  labelPosition?: keyof typeof styles;
  labelFormatter?: (value: number) => string;
  showRange?: boolean;
  showHoverPreview?: boolean;
  rangeCount?: number;
}

const toArray = (v: number | number[]): number[] =>
  Array.isArray(v) ? v : [v];

// Guards against floating-point drift when comparing stepped values
// (e.g. 0.1 + 0.2 !== 0.3 in IEEE 754).
const EPSILON = 1e-9;
const isApproxEqual = (a: number, b: number) => Math.abs(a - b) < EPSILON;

export const Slider = ({
  label,
  labelPosition = 'default',
  minValue = 0,
  maxValue = 100,
  step,
  labelFormatter,
  formatOptions,
  showRange = false,
  showHoverPreview = false,
  rangeCount,
  onChange,
  ...rest
}: SliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    percent: number;
    value: number;
  } | null>(null);

  // In controlled mode (rest.value is defined), activeValues is always derived
  // from the prop so the range highlight stays in sync with external updates.
  // In uncontrolled mode, internal state is kept up to date via handleChange.
  // useEffect (not useMemo) is used here because useState's initializer only
  // runs once and would become stale on subsequent controlled-value changes.
  const isControlled = rest.value !== undefined;

  const [internalValues, setInternalValues] = useState<number[]>(() =>
    toArray(rest.value ?? rest.defaultValue ?? minValue)
  );

  useEffect(() => {
    if (isControlled) {
      setInternalValues(toArray(rest.value!));
    }
  }, [isControlled, rest.value]);

  const activeValues = isControlled ? toArray(rest.value!) : internalValues;

  // Snaps a raw value to the nearest step boundary and clamps it within
  // [minValue, maxValue]. No-op when step is not set.
  const snapToStep = (raw: number): number => {
    if (!step) {
      return raw;
    }

    return Math.min(
      maxValue,
      Math.max(minValue, Math.round((raw - minValue) / step) * step + minValue)
    );
  };

  // Minimum of 2 prevents division by zero in the position formula
  // (i / (resolvedRangeCount - 1)) when rangeCount is 1.
  const resolvedRangeCount = Math.max(2, rangeCount ?? 2);
  const rangeValues = Array.from({ length: resolvedRangeCount }, (_, i) =>
    snapToStep(
      minValue + (i / (resolvedRangeCount - 1)) * (maxValue - minValue)
    )
  );

  const numberFormatter = useMemo(
    () =>
      formatOptions ? new Intl.NumberFormat(undefined, formatOptions) : null,
    [formatOptions]
  );

  const formatRangeValue = (value: number): string => {
    if (labelFormatter) {
      return labelFormatter(value);
    }
    if (numberFormatter) {
      return numberFormatter.format(value);
    }

    return String(value);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!showHoverPreview || !trackRef.current) {
      return;
    }

    const rect = trackRef.current.getBoundingClientRect();
    const rawPercent = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    const snappedValue = snapToStep(
      minValue + rawPercent * (maxValue - minValue)
    );
    const range = maxValue - minValue;
    const snappedPercent = range === 0 ? 0 : (snappedValue - minValue) / range;

    setHoverInfo({
      percent: snappedPercent,
      value: snappedValue,
    });
  };

  const handleMouseLeave = () => setHoverInfo(null);

  const handleChange = (v: number | number[]) => {
    if (!isControlled) {
      setInternalValues(toArray(v));
    }
    onChange?.(v);
  };

  return (
    <AriaSlider
      {...rest}
      {...{ minValue, maxValue, step }}
      formatOptions={formatOptions}
      onChange={handleChange}>
      <AriaLabel>{label}</AriaLabel>
      <AriaSliderTrack
        className="tw:relative tw:h-6 tw:w-full"
        ref={trackRef}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}>
        {({
          state: { values, getThumbValue, getThumbPercent, isDisabled },
        }) => {
          // fillStart / fillWidth define the filled portion of the track as
          // fractions in [0, 1]. Single-thumb: fill from left edge to thumb.
          // Range (two thumbs): fill between the two thumbs.
          const fillStart = values.length === 1 ? 0 : getThumbPercent(0);
          const fillWidth =
            values.length === 1
              ? getThumbPercent(0)
              : getThumbPercent(1) - fillStart;

          const trackRect = trackRef.current?.getBoundingClientRect();
          // thumbTopY / thumbBottomY are used to position portalled tooltips in
          // fixed coordinates. ±12 converts from track center to the top/bottom
          // edge of the 24 px (size-6) thumb.
          const thumbTopY = trackRect
            ? trackRect.top + trackRect.height / 2 - 12
            : 0;
          const thumbBottomY = trackRect
            ? trackRect.top + trackRect.height / 2 + 12
            : 0;

          // Convert a 12 px half-thumb radius to a fraction of track width so the
          // hover ghost hides when the cursor is physically over a thumb handle.
          // Falls back to 0.04 before the track has been laid out.
          const thumbRadiusFraction = trackRect ? 12 / trackRect.width : 0.04;
          const isOverThumb =
            hoverInfo !== null &&
            values.some(
              (_, i) =>
                Math.abs(getThumbPercent(i) - hoverInfo.percent) <
                thumbRadiusFraction
            );

          return (
            <>
              {/* Track rail (unfilled) */}
              <span className="tw:absolute tw:top-1/2 tw:h-2 tw:w-full tw:-translate-y-1/2 tw:rounded-full tw:bg-quaternary" />

              {/* Track fill — uses disabled token when the slider is not interactive */}
              <span
                className={cx(
                  'tw:absolute tw:top-1/2 tw:h-2 tw:-translate-y-1/2 tw:rounded-full',
                  isDisabled ? 'tw:bg-disabled' : 'tw:bg-brand-solid'
                )}
                style={{
                  left: `${fillStart * 100}%`,
                  width: `${fillWidth * 100}%`,
                }}
              />

              {/* Hover ghost — suppressed when slider is disabled */}
              {showHoverPreview && hoverInfo && !isOverThumb && !isDisabled && (
                <span
                  className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:-translate-x-1/2 tw:-translate-y-1/2 tw:size-5 tw:rounded-full tw:border-2 tw:border-brand-solid tw:bg-slider-handle-bg tw:opacity-60"
                  style={{ left: `${hoverInfo.percent * 100}%` }}
                />
              )}

              {values.map((_, index) => {
                const thumbCenterX = trackRect
                  ? trackRect.left + getThumbPercent(index) * trackRect.width
                  : 0;

                return (
                  <AriaSliderThumb
                    className={({
                      isFocusVisible,
                      isDragging,
                      isDisabled: thumbDisabled,
                    }) =>
                      cx(
                        'tw:top-1/2 tw:box-border tw:size-6 tw:rounded-full tw:bg-slider-handle-bg tw:shadow-md tw:ring-2 tw:ring-slider-handle-border tw:ring-inset',
                        thumbDisabled
                          ? 'tw:cursor-not-allowed tw:opacity-50'
                          : 'tw:cursor-grab',
                        isFocusVisible &&
                          !thumbDisabled &&
                          'tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring',
                        isDragging && !thumbDisabled && 'tw:cursor-grabbing'
                      )
                    }
                    // Use index as key — using the value would cause a key collision
                    // when both thumbs of a range slider are at the same position.
                    index={index}
                    key={index}>
                    {({ isHovered, isDragging }) => (
                      <>
                        <AriaSliderOutput
                          className={cx(
                            'tw:whitespace-nowrap',
                            styles[labelPosition]
                          )}>
                          {formatRangeValue(getThumbValue(index))}
                        </AriaSliderOutput>
                        {(labelPosition === 'top-floating' ||
                          labelPosition === 'bottom-floating') &&
                          (isHovered || isDragging) &&
                          trackRect &&
                          createPortal(
                            <div
                              className="tw:pointer-events-none tw:fixed tw:z-[9999] tw:whitespace-nowrap tw:rounded-lg tw:bg-primary tw:px-3 tw:py-2 tw:text-xs tw:font-semibold tw:text-secondary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt"
                              style={
                                labelPosition === 'top-floating'
                                  ? {
                                      left: thumbCenterX,
                                      top: thumbTopY - 8,
                                      transform:
                                        'translateX(-50%) translateY(-100%)',
                                    }
                                  : {
                                      left: thumbCenterX,
                                      top: thumbBottomY + 8,
                                      transform: 'translateX(-50%)',
                                    }
                              }>
                              {formatRangeValue(getThumbValue(index))}
                            </div>,
                            document.body,
                            // Use index (not value) to avoid key collision when
                            // thumbs overlap at the same value.
                            `slider-floating-${index}`
                          )}
                      </>
                    )}
                  </AriaSliderThumb>
                );
              })}

              {/* Hover-preview tooltip — suppressed when slider is disabled */}
              {showHoverPreview &&
                hoverInfo &&
                !isOverThumb &&
                !isDisabled &&
                trackRect &&
                createPortal(
                  <div
                    className="tw:pointer-events-none tw:fixed tw:z-[9998] tw:whitespace-nowrap tw:rounded tw:bg-primary tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:text-secondary tw:opacity-80 tw:shadow-md tw:ring-1 tw:ring-secondary_alt"
                    style={{
                      left:
                        trackRect.left + hoverInfo.percent * trackRect.width,
                      top: thumbTopY - 8,
                      transform: 'translateX(-50%) translateY(-100%)',
                    }}>
                    {formatRangeValue(hoverInfo.value)}
                  </div>,
                  document.body
                )}
            </>
          );
        }}
      </AriaSliderTrack>
      {showRange && (
        <div className="tw:relative tw:mt-0.5 tw:w-full tw:h-4 tw:text-xs tw:text-tertiary">
          {rangeValues.map((value, i) => {
            const range = maxValue - minValue;
            const percent =
              range === 0 ? 0 : ((value - minValue) / range) * 100;
            const isFirst = i === 0;
            const isLast = i === rangeValues.length - 1;
            // Use epsilon comparison to handle floating-point imprecision in
            // step-snapped range labels vs. the values emitted by react-aria.
            const isActive = activeValues.some((v) => isApproxEqual(v, value));
            let translateClass = 'tw:-translate-x-1/2';
            if (isFirst) {
              translateClass = '';
            } else if (isLast) {
              translateClass = 'tw:-translate-x-full';
            }

            return (
              <span
                className={cx(
                  'tw:absolute',
                  translateClass,
                  isActive ? 'tw:text-brand-secondary tw:font-medium' : ''
                )}
                key={`${value}-${i}`}
                style={{ left: `${percent}%` }}>
                {formatRangeValue(value)}
              </span>
            );
          })}
        </div>
      )}
    </AriaSlider>
  );
};
