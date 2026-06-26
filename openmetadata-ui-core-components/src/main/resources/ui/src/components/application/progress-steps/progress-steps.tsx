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
import { Check } from '@untitledui/icons';
import type { FC, HTMLAttributes, ReactNode } from 'react';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import { cx, sortCx } from '@/utils/cx';

export type ProgressStepStatus = 'complete' | 'current' | 'incomplete';

export type ProgressStepType =
  | 'icon'
  | 'number'
  | 'featured-icon'
  | 'dot'
  | 'line';

export type ProgressStepsOrientation = 'horizontal' | 'vertical';

export type ProgressStepsSize = 'sm' | 'md' | 'lg';

/**
 * Where the step label sits relative to the indicator on horizontal layouts.
 *
 * - `bottom` (default): label is rendered below the indicator and centered —
 *   the standard Untitled UI horizontal stepper.
 * - `attach`: label sits inline to the right of the indicator. Incomplete
 *   steps render in a disabled style, and connectors collapse to short
 *   horizontal lines between adjacent step groups.
 */
export type ProgressStepsLabelPlacement = 'bottom' | 'attach';

export interface ProgressStepItem {
  /**
   * Stable identifier for the step. Used as the React key so that reordering,
   * inserting, or removing steps preserves the correct DOM nodes and
   * transitions. Falls back to the title, then the index, when omitted.
   */
  id?: string;
  /** Step title rendered as the primary label. */
  title?: ReactNode;
  /** Optional supporting text rendered below the title. */
  description?: ReactNode;
  /** Icon component shown inside the indicator for `icon`/`featured-icon` types. */
  icon?: FC<{ className?: string }>;
  /**
   * Explicit status for the step. When omitted, the status is derived from
   * `currentStep` on the parent `ProgressSteps`.
   */
  status?: ProgressStepStatus;
}

export interface ProgressStepsProps
  extends Omit<HTMLAttributes<HTMLOListElement>, 'children'> {
  /** Ordered list of steps to render. */
  steps: ProgressStepItem[];
  /**
   * Zero-based index of the active step. Steps before it become `complete`,
   * the step at the index becomes `current`, and steps after it stay
   * `incomplete`. The value is clamped to `[0, steps.length - 1]` so an
   * out-of-range index still resolves to a valid `current` step. Ignored for
   * any step that defines its own `status`.
   */
  currentStep?: number;
  /** Visual style of the step indicator. */
  type?: ProgressStepType;
  /** Layout direction of the stepper. */
  orientation?: ProgressStepsOrientation;
  /** Size of the indicator and typography. */
  size?: ProgressStepsSize;
  /** Render the connecting lines between steps. */
  showConnector?: boolean;
  /**
   * Where the step label sits relative to the indicator on horizontal
   * layouts. Defaults to `'bottom'`. Use `'attach'` to render the indicator
   * and label side-by-side with a disabled treatment for incomplete steps.
   * Ignored when `orientation` is `'vertical'` or when `type` is `'line'`.
   */
  labelPlacement?: ProgressStepsLabelPlacement;
  className?: string;
}

const sizes = sortCx({
  sm: {
    circle: 'tw:size-6',
    icon: 'tw:size-4',
    dot: 'tw:size-2',
    dotHalo: 'tw:size-5',
    number: 'tw:text-xs',
    title: 'tw:text-sm tw:font-semibold',
    description: 'tw:text-xs',
    featured: 'sm' as const,
  },
  md: {
    circle: 'tw:size-8',
    icon: 'tw:size-4.5',
    dot: 'tw:size-2.5',
    dotHalo: 'tw:size-6',
    number: 'tw:text-sm',
    title: 'tw:text-sm tw:font-semibold',
    description: 'tw:text-sm',
    featured: 'md' as const,
  },
  lg: {
    circle: 'tw:size-10',
    icon: 'tw:size-5',
    dot: 'tw:size-3',
    dotHalo: 'tw:size-7',
    number: 'tw:text-md',
    title: 'tw:text-md tw:font-semibold',
    description: 'tw:text-sm',
    featured: 'lg' as const,
  },
});

const circleStatusStyles = sortCx({
  complete: 'tw:bg-brand-solid tw:text-fg-white',
  current:
    'tw:bg-brand-secondary tw:text-fg-brand-primary tw:ring-2 tw:ring-inset tw:ring-bg-brand-solid',
  incomplete:
    'tw:bg-primary tw:text-fg-quaternary tw:ring-1 tw:ring-inset tw:ring-primary',
});

const titleStatusStyles = sortCx({
  complete: 'tw:text-brand-secondary',
  current: 'tw:text-brand-secondary',
  incomplete: 'tw:text-secondary',
});

const attachCircleStatusStyles = sortCx({
  complete: 'tw:bg-brand-solid tw:text-fg-white',
  current: 'tw:bg-brand-solid tw:text-fg-white',
  incomplete: 'tw:bg-disabled tw:text-disabled',
});

const attachTitleStatusStyles = sortCx({
  complete: 'tw:text-primary',
  current: 'tw:text-primary',
  incomplete: 'tw:text-disabled',
});

const resolveStatus = (
  step: ProgressStepItem,
  index: number,
  currentStep?: number
): ProgressStepStatus => {
  let status: ProgressStepStatus = step.status ?? 'incomplete';

  if (!step.status && currentStep !== undefined) {
    if (index < currentStep) {
      status = 'complete';
    } else if (index === currentStep) {
      status = 'current';
    } else {
      status = 'incomplete';
    }
  }

  return status;
};

const getStepKey = (step: ProgressStepItem, index: number): string => {
  let key = String(index);

  if (step.id) {
    key = step.id;
  } else if (typeof step.title === 'string' || typeof step.title === 'number') {
    key = String(step.title);
  }

  return key;
};

interface StepIndicatorProps {
  type: Exclude<ProgressStepType, 'line'>;
  status: ProgressStepStatus;
  size: ProgressStepsSize;
  index: number;
  icon?: FC<{ className?: string }>;
  /**
   * Render the indicator with the attached-variant treatment (solid brand fill
   * for the current step, disabled fill for incomplete steps). Defaults to
   * `false` so the standard Untitled UI palette is used.
   */
  attached?: boolean;
}

const FeaturedStepIcon = ({
  status,
  size,
  index,
  icon,
}: StepIndicatorProps) => {
  const isComplete = status === 'complete';
  const color = status === 'incomplete' ? 'gray' : 'brand';
  const theme = status === 'incomplete' ? 'modern' : 'light';
  const Icon = isComplete ? Check : icon;

  return (
    <FeaturedIcon
      color={color}
      icon={Icon}
      size={sizes[size].featured}
      theme={theme}>
      {!Icon && (
        <span className={cx('tw:font-semibold', sizes[size].number)}>
          {index + 1}
        </span>
      )}
    </FeaturedIcon>
  );
};

const DotStepIcon = ({ status, size }: StepIndicatorProps) => {
  const isActive = status === 'complete' || status === 'current';

  return (
    <span
      className={cx(
        'tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full',
        sizes[size].dotHalo,
        status === 'current' && 'tw:bg-brand-secondary'
      )}>
      <span
        className={cx(
          'tw:rounded-full',
          sizes[size].dot,
          isActive ? 'tw:bg-brand-solid' : 'tw:bg-fg-quaternary'
        )}
      />
    </span>
  );
};

const CircleStepIcon = ({
  type,
  status,
  size,
  index,
  icon: Icon,
  attached,
}: StepIndicatorProps) => {
  const isComplete = status === 'complete';
  let content: ReactNode;

  if (isComplete) {
    content = <Check className={sizes[size].icon} />;
  } else if (type === 'number') {
    content = (
      <span className={cx('tw:font-semibold', sizes[size].number)}>
        {index + 1}
      </span>
    );
  } else if (Icon) {
    content = <Icon className={sizes[size].icon} />;
  } else {
    content = (
      <span className={cx('tw:rounded-full tw:bg-current', sizes[size].dot)} />
    );
  }

  const statusStyles = attached
    ? attachCircleStatusStyles[status]
    : circleStatusStyles[status];

  return (
    <span
      className={cx(
        'tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:transition-colors',
        sizes[size].circle,
        statusStyles
      )}>
      {content}
    </span>
  );
};

const StepIndicator = (props: StepIndicatorProps) => {
  let indicator: ReactNode;

  if (props.type === 'featured-icon') {
    indicator = <FeaturedStepIcon {...props} />;
  } else if (props.type === 'dot') {
    indicator = <DotStepIcon {...props} />;
  } else {
    indicator = <CircleStepIcon {...props} />;
  }

  return indicator;
};

interface StepConnectorProps {
  orientation: ProgressStepsOrientation;
  isComplete: boolean;
  isHidden?: boolean;
}

const StepConnector = ({
  orientation,
  isComplete,
  isHidden,
}: StepConnectorProps) => (
  <span
    aria-hidden="true"
    className={cx(
      'tw:rounded-full',
      orientation === 'horizontal'
        ? 'tw:h-0.5 tw:w-full tw:flex-1'
        : 'tw:w-0.5 tw:flex-1',
      isComplete ? 'tw:bg-brand-solid' : 'tw:bg-quaternary',
      isHidden && 'tw:invisible'
    )}
  />
);

interface StepTextProps {
  step: ProgressStepItem;
  status: ProgressStepStatus;
  size: ProgressStepsSize;
  align: 'center' | 'left';
  /**
   * Apply the attached-variant title palette (primary text for the active
   * step, disabled text for incomplete steps). Defaults to `false`.
   */
  attached?: boolean;
}

const StepText = ({ step, status, size, align, attached }: StepTextProps) => {
  let text: ReactNode = null;

  const titleColor = attached
    ? attachTitleStatusStyles[status]
    : titleStatusStyles[status];

  if (step.title || step.description) {
    text = (
      <div
        className={cx(
          'tw:flex tw:flex-col tw:gap-0.5',
          align === 'center' ? 'tw:items-center tw:text-center' : 'tw:text-left'
        )}>
        {step.title && (
          <span className={cx(sizes[size].title, titleColor)}>
            {step.title}
          </span>
        )}
        {step.description && (
          <span className={cx('tw:text-tertiary', sizes[size].description)}>
            {step.description}
          </span>
        )}
      </div>
    );
  }

  return text;
};

interface RenderArgs {
  steps: ProgressStepItem[];
  statuses: ProgressStepStatus[];
  type: ProgressStepType;
  size: ProgressStepsSize;
  showConnector: boolean;
}

const AttachedHorizontalSteps = ({
  steps,
  statuses,
  type,
  size,
  showConnector,
}: RenderArgs) =>
  steps.map((step, index) => {
    const status = statuses[index];
    const isLast = index === steps.length - 1;

    return (
      <li
        aria-current={status === 'current' ? 'step' : undefined}
        className="tw:flex tw:items-center"
        key={getStepKey(step, index)}>
        <div className="tw:flex tw:items-center tw:gap-2">
          <StepIndicator
            attached
            icon={step.icon}
            index={index}
            size={size}
            status={status}
            type={type as Exclude<ProgressStepType, 'line'>}
          />
          <StepText
            attached
            align="left"
            size={size}
            status={status}
            step={step}
          />
        </div>
        {showConnector && !isLast && (
          <span
            aria-hidden="true"
            className="tw:mx-3 tw:h-px tw:w-8 tw:shrink-0 tw:bg-quaternary"
          />
        )}
      </li>
    );
  });

const HorizontalSteps = ({
  steps,
  statuses,
  type,
  size,
  showConnector,
}: RenderArgs) =>
  steps.map((step, index) => {
    const status = statuses[index];
    const isFirst = index === 0;
    const isLast = index === steps.length - 1;

    return (
      <li
        aria-current={status === 'current' ? 'step' : undefined}
        className="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:gap-3"
        key={getStepKey(step, index)}>
        <div className="tw:flex tw:w-full tw:items-center tw:gap-2">
          {showConnector && (
            <StepConnector
              isComplete={statuses[index - 1] === 'complete'}
              isHidden={isFirst}
              orientation="horizontal"
            />
          )}
          <StepIndicator
            icon={step.icon}
            index={index}
            size={size}
            status={status}
            type={type as Exclude<ProgressStepType, 'line'>}
          />
          {showConnector && (
            <StepConnector
              isComplete={status === 'complete'}
              isHidden={isLast}
              orientation="horizontal"
            />
          )}
        </div>
        <StepText align="center" size={size} status={status} step={step} />
      </li>
    );
  });

const VerticalSteps = ({
  steps,
  statuses,
  type,
  size,
  showConnector,
}: RenderArgs) =>
  steps.map((step, index) => {
    const status = statuses[index];
    const isLast = index === steps.length - 1;

    return (
      <li
        aria-current={status === 'current' ? 'step' : undefined}
        className="tw:flex tw:gap-3"
        key={getStepKey(step, index)}>
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-1">
          <StepIndicator
            icon={step.icon}
            index={index}
            size={size}
            status={status}
            type={type as Exclude<ProgressStepType, 'line'>}
          />
          {showConnector && !isLast && (
            <StepConnector
              isComplete={status === 'complete'}
              orientation="vertical"
            />
          )}
        </div>
        <div className={cx('tw:pt-1', !isLast && 'tw:pb-6')}>
          <StepText align="left" size={size} status={status} step={step} />
        </div>
      </li>
    );
  });

const LineSteps = ({ steps, statuses, size }: RenderArgs) =>
  steps.map((step, index) => {
    const status = statuses[index];
    const isActive = status === 'complete' || status === 'current';

    return (
      <li
        aria-current={status === 'current' ? 'step' : undefined}
        className={cx(
          'tw:flex tw:flex-1 tw:flex-col tw:gap-2 tw:border-t-2 tw:pt-3',
          isActive ? 'tw:border-brand-solid' : 'tw:border-secondary'
        )}
        key={getStepKey(step, index)}>
        <StepText align="left" size={size} status={status} step={step} />
      </li>
    );
  });

/**
 * ProgressSteps renders a multi-step progress indicator (a.k.a. stepper),
 * mirroring the Untitled UI "Progress steps" patterns. It supports several
 * indicator styles (`icon`, `number`, `featured-icon`, `dot`, `line`),
 * horizontal and vertical orientations, and three sizes — covering use cases
 * from compact wizards to onboarding checklists.
 *
 * Status can be driven declaratively per step (`step.status`) or derived from
 * the `currentStep` index.
 *
 * @example
 * <ProgressSteps
 *   currentStep={1}
 *   steps={[
 *     { title: 'Your details', description: 'Name and email' },
 *     { title: 'Company details', description: 'A few details' },
 *     { title: 'Invite team', description: 'Start collaborating' },
 *   ]}
 * />
 */
export const ProgressSteps = ({
  steps,
  currentStep,
  type = 'icon',
  orientation = 'horizontal',
  size = 'md',
  showConnector = true,
  labelPlacement = 'bottom',
  className,
  ...props
}: ProgressStepsProps) => {
  const clampedStep =
    currentStep === undefined
      ? undefined
      : Math.min(Math.max(currentStep, 0), steps.length - 1);

  const statuses = steps.map((step, index) =>
    resolveStatus(step, index, clampedStep)
  );

  const renderArgs: RenderArgs = { steps, statuses, type, size, showConnector };
  const isAttached =
    labelPlacement === 'attach' &&
    orientation === 'horizontal' &&
    type !== 'line';

  let content: ReactNode;
  let listClassName: string;

  if (type === 'line') {
    content = <LineSteps {...renderArgs} />;
    listClassName = 'tw:flex tw:w-full tw:gap-4';
  } else if (orientation === 'vertical') {
    content = <VerticalSteps {...renderArgs} />;
    listClassName = 'tw:flex tw:flex-col';
  } else if (isAttached) {
    content = <AttachedHorizontalSteps {...renderArgs} />;
    listClassName = 'tw:flex tw:items-center';
  } else {
    content = <HorizontalSteps {...renderArgs} />;
    listClassName = 'tw:flex tw:w-full';
  }

  return (
    <ol {...props} className={cx(listClassName, className)}>
      {content}
    </ol>
  );
};
