import type { FC, ReactNode, Ref } from 'react';
import { isValidElement } from 'react';
import { cx, sortCx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';

const iconsSizes = {
  sm: 'tw:*:data-icon:size-4',
  md: 'tw:*:data-icon:size-5',
  lg: 'tw:*:data-icon:size-6',
  xl: 'tw:*:data-icon:size-7',
};

const styles = sortCx({
  light: {
    base: 'tw:rounded-full',
    sizes: {
      sm: 'tw:size-8',
      md: 'tw:size-10',
      lg: 'tw:size-12',
      xl: 'tw:size-14',
    },
    colors: {
      brand: 'tw:bg-brand-secondary tw:text-featured-icon-light-fg-brand',
      gray: 'tw:bg-tertiary tw:text-featured-icon-light-fg-gray',
      error: 'tw:bg-error-secondary tw:text-featured-icon-light-fg-error',
      warning: 'tw:bg-warning-secondary tw:text-featured-icon-light-fg-warning',
      success: 'tw:bg-success-secondary tw:text-featured-icon-light-fg-success',
    },
  },

  gradient: {
    base: 'tw:rounded-full tw:text-fg-white tw:before:absolute tw:before:inset-0 tw:before:size-full tw:before:rounded-full tw:before:border tw:before:mask-b-from-0% tw:after:absolute tw:after:block tw:after:rounded-full',
    sizes: {
      sm: 'tw:size-8 tw:after:size-6 tw:*:data-icon:size-4',
      md: 'tw:size-10 tw:after:size-7 tw:*:data-icon:size-4',
      lg: 'tw:size-12 tw:after:size-8 tw:*:data-icon:size-5',
      xl: 'tw:size-14 tw:after:size-10 tw:*:data-icon:size-5',
    },
    colors: {
      brand:
        'tw:before:border-utility-brand-200 tw:before:bg-utility-brand-50 tw:after:bg-brand-solid',
      gray: 'tw:before:border-utility-gray-200 tw:before:bg-utility-gray-50 tw:after:bg-secondary-solid',
      error:
        'tw:before:border-utility-error-200 tw:before:bg-utility-error-50 tw:after:bg-error-solid',
      warning:
        'tw:before:border-utility-warning-200 tw:before:bg-utility-warning-50 tw:after:bg-warning-solid',
      success:
        'tw:before:border-utility-success-200 tw:before:bg-utility-success-50 tw:after:bg-success-solid',
    },
  },

  dark: {
    base: 'tw:text-fg-white tw:shadow-xs-skeumorphic tw:before:absolute tw:before:inset-px tw:before:border tw:before:border-white/12 tw:before:mask-b-from-0%',
    sizes: {
      sm: 'tw:size-8 tw:rounded-md tw:before:rounded-[5px]',
      md: 'tw:size-10 tw:rounded-lg tw:before:rounded-[7px]',
      lg: 'tw:size-12 tw:rounded-[10px] tw:before:rounded-[9px]',
      xl: 'tw:size-14 tw:rounded-xl tw:before:rounded-[11px]',
    },
    colors: {
      brand: 'tw:bg-brand-solid tw:before:border-utility-brand-200/12',
      gray: 'tw:bg-secondary-solid tw:before:border-utility-gray-200/12',
      error: 'tw:bg-error-solid tw:before:border-utility-error-200/12',
      warning: 'tw:bg-warning-solid tw:before:border-utility-warning-200/12',
      success: 'tw:bg-success-solid tw:before:border-utility-success-200/12',
    },
  },

  modern: {
    base: 'tw:bg-primary tw:shadow-xs-skeumorphic tw:ring-1 tw:ring-inset',
    sizes: {
      sm: 'tw:size-8 tw:rounded-md',
      md: 'tw:size-10 tw:rounded-lg',
      lg: 'tw:size-12 tw:rounded-[10px]',
      xl: 'tw:size-14 tw:rounded-xl',
    },
    colors: {
      brand: '',
      gray: 'tw:text-fg-secondary tw:ring-primary',
      error: '',
      warning: '',
      success: '',
    },
  },
  'modern-neue': {
    base: [
      'tw:bg-primary_alt tw:ring-1 tw:ring-inset tw:before:absolute tw:before:inset-1',
      // Shadow
      'tw:before:shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1),0px_3px_3px_0px_rgba(0,0,0,0.09),1px_8px_5px_0px_rgba(0,0,0,0.05),2px_21px_6px_0px_rgba(0,0,0,0),0px_0px_0px_1px_rgba(0,0,0,0.08),1px_13px_5px_0px_rgba(0,0,0,0.01),0px_-2px_2px_0px_rgba(0,0,0,0.13)_inset] tw:before:ring-1 tw:before:ring-secondary_alt',
    ].join(' '),
    sizes: {
      sm: 'tw:size-8 tw:rounded-[8px] tw:before:rounded-[4px]',
      md: 'tw:size-10 tw:rounded-[10px] tw:before:rounded-[6px]',
      lg: 'tw:size-12 tw:rounded-[12px] tw:before:rounded-[8px]',
      xl: 'tw:size-14 tw:rounded-[14px] tw:before:rounded-[10px]',
    },
    colors: {
      brand: '',
      gray: 'tw:text-fg-secondary tw:ring-primary',
      error: '',
      warning: '',
      success: '',
    },
  },

  outline: {
    base: 'tw:before:absolute tw:before:rounded-full tw:before:border-2 tw:after:absolute tw:after:rounded-full tw:after:border-2',
    sizes: {
      sm: 'tw:size-4 tw:before:size-6 tw:after:size-8.5',
      md: 'tw:size-5 tw:before:size-7 tw:after:size-9.5',
      lg: 'tw:size-6 tw:before:size-8 tw:after:size-10.5',
      xl: 'tw:size-7 tw:before:size-9 tw:after:size-11.5',
    },
    colors: {
      brand:
        'tw:text-fg-brand-primary tw:before:border-fg-brand-primary/30 tw:after:border-fg-brand-primary/10',
      gray: 'tw:text-fg-tertiary tw:before:border-fg-tertiary/30 tw:after:border-fg-tertiary/10',
      error:
        'tw:text-fg-error-primary tw:before:border-fg-error-primary/30 tw:after:border-fg-error-primary/10',
      warning:
        'tw:text-fg-warning-primary tw:before:border-fg-warning-primary/30 tw:after:border-fg-warning-primary/10',
      success:
        'tw:text-fg-success-primary tw:before:border-fg-success-primary/30 tw:after:border-fg-success-primary/10',
    },
  },
});

interface FeaturedIconProps {
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
  className?: string;
  icon?: FC<{ className?: string }> | ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color: 'brand' | 'gray' | 'success' | 'warning' | 'error';
  theme?: 'light' | 'gradient' | 'dark' | 'outline' | 'modern' | 'modern-neue';
}

export const FeaturedIcon = (props: FeaturedIconProps) => {
  const {
    ref,
    className,
    children,
    size = 'sm',
    theme: variant = 'light',
    color = 'brand',
    icon: Icon,
    ...otherProps
  } = props;

  return (
    <div
      ref={ref}
      {...otherProps}
      data-featured-icon
      className={cx(
        'tw:relative tw:flex tw:shrink-0 tw:items-center tw:justify-center',

        iconsSizes[size],
        styles[variant].base,
        styles[variant].sizes[size],
        styles[variant].colors[color],

        className
      )}>
      {isReactComponent(Icon) && <Icon data-icon className="tw:z-1" />}
      {isValidElement(Icon) && <div className="tw:z-1">{Icon}</div>}

      {children}
    </div>
  );
};
