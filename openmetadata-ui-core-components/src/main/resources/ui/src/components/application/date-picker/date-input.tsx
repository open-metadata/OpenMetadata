import type { DateInputProps as AriaDateInputProps } from 'react-aria-components';
import {
  DateInput as AriaDateInput,
  DateSegment as AriaDateSegment,
} from 'react-aria-components';
import { cx } from '@/utils/cx';

type DateInputProps = Omit<AriaDateInputProps, 'children'>;

export const DateInput = (props: DateInputProps) => {
  return (
    <AriaDateInput
      {...props}
      className={cx(
        // Border drawn with outline, not a ring: WebKit does not pixel-snap box-shadow,
        // so rings thin/vanish in Safari when zoomed out.
        'tw:flex tw:rounded-lg tw:bg-primary tw:px-2.5 tw:py-2 tw:text-md tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary tw:focus-within:outline-2 tw:focus-within:-outline-offset-2 tw:focus-within:outline-brand',
        typeof props.className === 'string' && props.className
      )}>
      {(segment) => (
        <AriaDateSegment
          className={cx(
            'tw:rounded tw:px-0.5 tw:text-primary tw:tabular-nums tw:caret-transparent tw:focus:bg-brand-solid tw:focus:font-medium tw:focus:text-white tw:focus:outline-hidden',
            // The placeholder segment.
            segment.isPlaceholder && 'tw:text-placeholder tw:uppercase',
            // The separator "/" segment.
            segment.type === 'literal' && 'tw:text-fg-quaternary'
          )}
          segment={segment}
        />
      )}
    </AriaDateInput>
  );
};
