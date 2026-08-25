import type { ReactNode, Ref } from 'react';
import { HelpCircle } from '@untitledui/icons';
import type { LabelProps as AriaLabelProps } from 'react-aria-components';
import { Label as AriaLabel } from 'react-aria-components';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { cx } from '@/utils/cx';

interface LabelProps extends AriaLabelProps {
  children: ReactNode;
  isRequired?: boolean;
  tooltip?: string;
  tooltipDescription?: string;
  ref?: Ref<HTMLLabelElement>;
}

export const Label = ({
  isRequired,
  tooltip,
  tooltipDescription,
  className,
  ...props
}: LabelProps) => {
  return (
    <AriaLabel
      // Used for conditionally hiding/showing the label element via CSS:
      // <Input label="Visible only on mobile" className="lg:**:data-label:hidden" />
      // or
      // <Input label="Visible only on mobile" className="lg:label:hidden" />
      data-label="true"
      {...props}
      className={cx(
        'tw:flex tw:cursor-default tw:items-center tw:gap-0.5 tw:text-sm tw:font-medium tw:text-secondary',
        className
      )}>
      {props.children}

      <span
        className={cx(
          'tw:hidden tw:text-error-primary',
          isRequired && 'tw:block',
          typeof isRequired === 'undefined' && 'tw:group-required:block'
        )}>
        *
      </span>

      {tooltip && (
        // isDisabled={false} on the wrapper overrides any disabled state
        // inherited from the parent form field — the help icon tooltip should
        // remain accessible even when the field itself is disabled.
        <Tooltip
          description={tooltipDescription}
          isDisabled={false}
          placement="top"
          title={tooltip}
          triggerClassName="tw:flex tw:items-center tw:cursor-pointer tw:text-fg-quaternary tw:transition tw:duration-200 tw:hover:text-fg-quaternary_hover tw:focus:text-fg-quaternary_hover">
          <HelpCircle className="tw:size-4" />
        </Tooltip>
      )}
    </AriaLabel>
  );
};

Label.displayName = 'Label';
