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
  Badge,
  Button as CoreButton,
  Card as CoreCard,
  Checkbox as CoreCheckbox,
  Dialog,
  Input as CoreInput,
  Modal as CoreModal,
  ModalOverlay,
  NativeSelect,
  ProgressBar,
  RadioButton,
  RadioGroup as CoreRadioGroup,
  Table as CoreTable,
  Tabs as CoreTabs,
  TextArea as CoreTextArea,
} from '@openmetadata/ui-core-components';
import { AlertCircle, Check, FileSearch01, SearchLg } from '@untitledui/icons';
import {
  ComponentProps,
  CSSProperties,
  FC,
  Key,
  ReactElement,
  ReactNode,
} from 'react';

type Direction = 'horizontal' | 'vertical';
type Size = 'small' | 'middle' | 'large' | number;
type ButtonType =
  | 'primary'
  | 'link'
  | 'default'
  | 'button'
  | 'submit'
  | 'reset';
type NativeButtonType = 'button' | 'submit' | 'reset';

interface ValueChangeEvent<T extends string = string> {
  target: {
    value: T;
  };
}

interface CheckedChangeEvent {
  target: {
    checked: boolean;
  };
}

const GAP: Record<Exclude<Size, number>, number> = {
  small: 8,
  middle: 16,
  large: 24,
};

const getGap = (size?: Size): number =>
  typeof size === 'number' ? size : GAP[size ?? 'middle'];

const getButtonColor = ({
  danger,
  type,
}: {
  danger?: boolean;
  type?: ButtonType;
}): ComponentProps<typeof CoreButton>['color'] => {
  if (danger) {
    return type === 'primary' ? 'primary-destructive' : 'secondary-destructive';
  }
  if (type === 'primary') {
    return 'primary';
  }
  if (type === 'link') {
    return 'link-color';
  }

  return 'secondary';
};

export interface ButtonProps
  extends Omit<
    ComponentProps<typeof CoreButton>,
    'color' | 'iconLeading' | 'isDisabled' | 'isLoading' | 'type' | 'size'
  > {
  type?: ButtonType;
  htmlType?: NativeButtonType;
  danger?: boolean;
  ghost?: boolean;
  disabled?: boolean;
  href?: string;
  loading?: boolean;
  icon?: ReactNode;
  rel?: string;
  size?: Size;
  target?: string;
}

export const Button = ({
  children,
  danger,
  disabled,
  ghost: _ghost,
  htmlType,
  icon,
  loading,
  size,
  type,
  ...props
}: ButtonProps) => {
  const nativeType: NativeButtonType =
    type === 'button' || type === 'submit' || type === 'reset'
      ? type
      : htmlType ?? 'button';

  return (
    <CoreButton
      {...(props as ComponentProps<typeof CoreButton>)}
      color={getButtonColor({ danger, type })}
      iconLeading={icon}
      isDisabled={disabled}
      isLoading={loading}
      size={size === 'large' ? 'md' : 'sm'}
      {...(props.href ? {} : { type: nativeType })}>
      {children}
    </CoreButton>
  );
};

interface CardProps {
  title?: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
  className?: string;
  size?: 'small' | 'default';
  bodyStyle?: CSSProperties;
  bodyClassName?: string;
  bordered?: boolean;
  onClick?: () => void;
}

export const Card = ({
  bodyClassName,
  bodyStyle,
  bordered = true,
  children,
  className,
  extra,
  onClick,
  size,
  title,
}: CardProps) => (
  <CoreCard
    className={className}
    isClickable={Boolean(onClick)}
    size={size === 'small' ? 'sm' : 'md'}
    variant={bordered ? 'default' : 'ghost'}
    onClick={onClick}>
    {(title || extra) && <CoreCard.Header extra={extra} title={title} />}
    <CoreCard.Content className={bodyClassName} style={bodyStyle}>
      {children}
    </CoreCard.Content>
  </CoreCard>
);

interface EmptyProps {
  description?: ReactNode;
  image?: ReactNode;
}

type EmptyComponent = FC<EmptyProps> & {
  PRESENTED_IMAGE_SIMPLE: ReactElement;
};

export const Empty = (({ description, image }: EmptyProps) => (
  <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:py-8 tw:text-center">
    {image ?? <FileSearch01 className="tw:size-8 tw:text-fg-quaternary" />}
    {description && (
      <div className="tw:text-sm tw:font-medium tw:text-tertiary">
        {description}
      </div>
    )}
  </div>
)) as EmptyComponent;

Empty.PRESENTED_IMAGE_SIMPLE = (
  <FileSearch01 className="tw:size-8 tw:text-fg-quaternary" />
);

interface SkeletonProps {
  active?: boolean;
  paragraph?: {
    rows?: number;
  };
}

export const Skeleton = ({ paragraph }: SkeletonProps) => {
  const rows = paragraph?.rows ?? 3;

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className="tw:h-4 tw:animate-pulse tw:rounded tw:bg-secondary"
          key={index}
          style={{ width: `${Math.max(40, 100 - index * 9)}%` }}
        />
      ))}
    </div>
  );
};

interface SpinProps {
  size?: 'small' | 'default' | 'large';
}

export const Spin = ({ size = 'default' }: SpinProps) => (
  <span
    className="tw:inline-block tw:animate-spin tw:rounded-full tw:border-2 tw:border-brand-solid tw:border-t-transparent"
    style={{
      height: size === 'large' ? 28 : size === 'small' ? 16 : 22,
      width: size === 'large' ? 28 : size === 'small' ? 16 : 22,
    }}
  />
);

interface TagProps {
  children?: ReactNode;
  className?: string;
  color?: string;
  style?: CSSProperties;
}

interface CheckableTagProps extends TagProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

type TagComponent = FC<TagProps> & {
  CheckableTag: FC<CheckableTagProps>;
};

export const Tag = (({ children, className, style }: TagProps) => (
  <span className={className} style={style}>
    <Badge color="gray" size="sm">
      {children}
    </Badge>
  </span>
)) as TagComponent;

Tag.CheckableTag = ({ checked, children, className, onChange, style }) => (
  <CoreButton
    className={className}
    color={checked ? 'primary' : 'secondary'}
    size="xs"
    style={style}
    type="button"
    onClick={() => onChange?.(!checked)}>
    {children}
  </CoreButton>
);

interface TextProps {
  children?: ReactNode;
  className?: string;
  strong?: boolean;
  style?: CSSProperties;
  type?: 'secondary' | 'danger';
}

interface TitleProps extends TextProps {
  level?: 1 | 2 | 3 | 4 | 5;
}

interface LinkProps extends TextProps {
  onClick?: () => void;
}

const textTone = (type?: TextProps['type']) =>
  type === 'danger'
    ? 'tw:text-error-primary'
    : type === 'secondary'
    ? 'tw:text-tertiary'
    : 'tw:text-primary';

export const Typography = {
  Text: ({ children, className, strong, style, type }: TextProps) => (
    <span
      className={`${textTone(type)} ${strong ? 'tw:font-semibold' : ''} ${
        className ?? ''
      }`}
      style={style}>
      {children}
    </span>
  ),
  Paragraph: ({ children, className, style, type }: TextProps) => (
    <p className={`${textTone(type)} ${className ?? ''}`} style={style}>
      {children}
    </p>
  ),
  Title: ({ children, className, level = 3, style }: TitleProps) => {
    const titleClass = `tw:font-semibold tw:text-primary ${className ?? ''}`;

    if (level === 1) {
      return (
        <h1 className={titleClass} style={style}>
          {children}
        </h1>
      );
    }
    if (level === 2) {
      return (
        <h2 className={titleClass} style={style}>
          {children}
        </h2>
      );
    }
    if (level === 4) {
      return (
        <h4 className={titleClass} style={style}>
          {children}
        </h4>
      );
    }
    if (level === 5) {
      return (
        <h5 className={titleClass} style={style}>
          {children}
        </h5>
      );
    }

    return (
      <h3 className={titleClass} style={style}>
        {children}
      </h3>
    );
  },
  Link: ({ children, className, onClick, style }: LinkProps) => (
    <CoreButton
      className={className}
      color="link-color"
      size="sm"
      style={style}
      type="button"
      onClick={onClick}>
      {children}
    </CoreButton>
  ),
};

interface ModalProps {
  open?: boolean;
  title?: ReactNode;
  children?: ReactNode;
  centered?: boolean;
  className?: string;
  destroyOnClose?: boolean;
  footer?: ReactNode | null;
  cancelText?: ReactNode;
  okText?: ReactNode;
  okButtonProps?: {
    danger?: boolean;
    type?: ButtonType;
  };
  confirmLoading?: boolean;
  width?: number;
  closable?: boolean;
  maskClosable?: boolean;
  onCancel?: () => void;
  onOk?: () => void;
}

export const Modal = ({
  cancelText,
  className,
  children,
  closable = true,
  confirmLoading,
  footer,
  maskClosable = true,
  okButtonProps,
  okText,
  open,
  title,
  width,
  onCancel,
  onOk,
}: ModalProps) => (
  <ModalOverlay
    isDismissable={maskClosable}
    isOpen={Boolean(open)}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        onCancel?.();
      }
    }}>
    <CoreModal>
      <Dialog
        className={className}
        showCloseButton={closable}
        title={typeof title === 'string' ? title : undefined}
        width={width}
        onClose={onCancel}>
        {title && typeof title !== 'string' && (
          <Dialog.Header>{title}</Dialog.Header>
        )}
        {footer === null ? (
          children
        ) : (
          <>
            <Dialog.Content>{children}</Dialog.Content>
            <Dialog.Footer>
              {footer ?? (
                <>
                  <Button onClick={onCancel}>{cancelText}</Button>
                  <Button
                    danger={okButtonProps?.danger}
                    loading={confirmLoading}
                    type={okButtonProps?.type ?? 'primary'}
                    onClick={onOk}>
                    {okText}
                  </Button>
                </>
              )}
            </Dialog.Footer>
          </>
        )}
      </Dialog>
    </CoreModal>
  </ModalOverlay>
);

interface InputProps
  extends Omit<ComponentProps<typeof CoreInput>, 'onChange' | 'size'> {
  size?: Size;
  onChange?: (event: ValueChangeEvent) => void;
}

interface TextAreaProps
  extends Omit<ComponentProps<typeof CoreTextArea>, 'onChange'> {
  onChange?: (event: ValueChangeEvent) => void;
}

type InputComponent = FC<InputProps> & {
  TextArea: FC<TextAreaProps>;
};

export const Input = (({ onChange, size, ...props }: InputProps) => (
  <CoreInput
    {...props}
    size={size === 'large' ? 'md' : 'sm'}
    onChange={(value) => onChange?.({ target: { value } })}
  />
)) as InputComponent;

Input.TextArea = ({ onChange, ...props }) => (
  <CoreTextArea
    {...props}
    onChange={(value) => onChange?.({ target: { value } })}
  />
);

interface SelectOption<T extends string> {
  label: ReactNode;
  value: T;
  disabled?: boolean;
}

interface SelectProps<T extends string> {
  className?: string;
  options: SelectOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
}

export const Select = <T extends string>({
  className,
  options,
  value,
  onChange,
}: SelectProps<T>) => (
  <NativeSelect
    className={className}
    options={options.map((option) => ({
      ...option,
      label: String(option.label),
    }))}
    value={value}
    onChange={(event) => onChange?.(event.target.value as T)}
  />
);

interface CheckboxProps {
  checked?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onChange?: (event: CheckedChangeEvent) => void;
}

export const Checkbox = ({
  checked,
  children,
  className,
  style,
  onChange,
}: CheckboxProps) => (
  <CoreCheckbox
    className={className}
    isSelected={checked}
    label={children}
    style={style}
    onChange={(nextChecked) => onChange?.({ target: { checked: nextChecked } })}
  />
);

interface RadioOption<T extends string> {
  label: ReactNode;
  value: T;
}

interface RadioGroupProps<T extends string> {
  options: RadioOption<T>[];
  value?: T;
  onChange?: (event: ValueChangeEvent<T>) => void;
}

const RadioGroup = <T extends string>({
  options,
  value,
  onChange,
}: RadioGroupProps<T>) => (
  <CoreRadioGroup
    className="tw:flex tw:flex-row tw:flex-wrap tw:gap-4"
    value={value}
    onChange={(nextValue) => onChange?.({ target: { value: nextValue as T } })}>
    {options.map((option) => (
      <RadioButton
        key={option.value}
        label={option.label}
        value={option.value}
      />
    ))}
  </CoreRadioGroup>
);

export const Radio = {
  Group: RadioGroup,
};

interface StepsProps {
  current: number;
  items: Array<{ title: ReactNode }>;
  className?: string;
  size?: 'small' | 'default';
}

export const Steps = ({ className, current, items }: StepsProps) => (
  <ol className={`tw:flex tw:flex-wrap tw:gap-2 ${className ?? ''}`}>
    {items.map((item, index) => (
      <li
        className={`tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:px-2.5 tw:py-1.5 tw:text-sm tw:font-medium ${
          index <= current
            ? 'tw:bg-brand-primary_alt tw:text-brand-secondary'
            : 'tw:bg-secondary tw:text-tertiary'
        }`}
        key={index}>
        <span className="tw:flex tw:size-5 tw:items-center tw:justify-center tw:rounded-full tw:bg-primary tw:text-xs">
          {index < current ? <Check className="tw:size-3" /> : index + 1}
        </span>
        {item.title}
      </li>
    ))}
  </ol>
);

interface SpaceProps {
  align?: CSSProperties['alignItems'];
  children?: ReactNode;
  className?: string;
  direction?: Direction;
  size?: Size | [Size, Size];
  style?: CSSProperties;
  wrap?: boolean;
}

export const Space = ({
  align,
  children,
  className,
  direction = 'horizontal',
  size = 'small',
  style,
  wrap,
}: SpaceProps) => {
  const rowGap = Array.isArray(size) ? getGap(size[1]) : getGap(size);
  const columnGap = Array.isArray(size) ? getGap(size[0]) : getGap(size);

  return (
    <div
      className={className}
      style={{
        alignItems: align,
        display: 'flex',
        flexDirection: direction === 'vertical' ? 'column' : 'row',
        flexWrap: wrap ? 'wrap' : undefined,
        gap: `${rowGap}px ${columnGap}px`,
        ...style,
      }}>
      {children}
    </div>
  );
};

interface RowProps {
  align?: CSSProperties['alignItems'];
  children?: ReactNode;
  className?: string;
  gutter?: [number, number] | number;
}

export const Row = ({ align, children, className, gutter = 0 }: RowProps) => {
  const [columnGap, rowGap] = Array.isArray(gutter) ? gutter : [gutter, gutter];

  return (
    <div
      className={className}
      style={{
        alignItems: align,
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${rowGap}px ${columnGap}px`,
      }}>
      {children}
    </div>
  );
};

interface ColProps {
  children?: ReactNode;
  className?: string;
  flex?: string;
  lg?: number;
  md?: number;
  sm?: number;
  xs?: number;
}

const spanToFlex = (span?: number): string =>
  span ? `0 0 calc(${(span / 24) * 100}% - 12px)` : '1 1 0';

export const Col = ({ children, className, flex, lg, md, xs }: ColProps) => (
  <div
    className={className}
    style={{
      flex: flex ?? spanToFlex(lg ?? md ?? xs),
      minWidth: xs === 24 ? 280 : 0,
    }}>
    {children}
  </div>
);

interface ListProps<T> {
  dataSource?: T[];
  locale?: {
    emptyText?: ReactNode;
  };
  renderItem: (item: T) => ReactNode;
}

interface ListItemProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

type ListComponent = (<T>(props: ListProps<T>) => ReactElement) & {
  Item: FC<ListItemProps>;
};

export const List = (<T,>({
  dataSource = [],
  locale,
  renderItem,
}: ListProps<T>) => {
  if (dataSource.length === 0) {
    return (
      <div className="tw:py-4 tw:text-sm tw:text-tertiary">
        {locale?.emptyText}
      </div>
    );
  }

  return (
    <div className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary">
      {dataSource.map((item, index) => (
        <div key={index}>{renderItem(item)}</div>
      ))}
    </div>
  );
}) as ListComponent;

List.Item = ({ children, className, onClick }) => (
  <div
    className={`tw:py-3 ${onClick ? 'tw:cursor-pointer' : ''} ${
      className ?? ''
    }`}
    onClick={onClick}>
    {children}
  </div>
);

interface ProgressProps {
  percent: number;
  showInfo?: boolean;
  strokeColor?: string;
}

export const Progress = ({ percent, strokeColor }: ProgressProps) => (
  <div
    style={
      {
        '--ai-gov-progress-color': strokeColor,
      } as CSSProperties
    }>
    <ProgressBar
      className="tw:mt-2"
      progressClassName="ai-gov-untitled-progress-fill"
      value={percent}
      valueFormatter={(value) => `${value}%`}
    />
  </div>
);

interface StatisticProps {
  title: ReactNode;
  value: ReactNode;
  valueStyle?: CSSProperties;
}

export const Statistic = ({ title, value, valueStyle }: StatisticProps) => (
  <div>
    <div className="tw:text-sm tw:text-tertiary">{title}</div>
    <div
      className="tw:mt-1 tw:text-2xl tw:font-semibold tw:text-primary"
      style={valueStyle}>
      {value}
    </div>
  </div>
);

interface AvatarProps {
  children?: ReactNode;
  size?: number;
}

export const Avatar = ({ children, size = 24 }: AvatarProps) => (
  <span
    className="tw:inline-flex tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-primary_alt tw:text-xs tw:font-semibold tw:text-brand-secondary"
    style={{ height: size, width: size }}>
    {children}
  </span>
);

interface BreadcrumbProps {
  items: Array<{ title: ReactNode }>;
}

export const Breadcrumb = ({ items }: BreadcrumbProps) => (
  <nav className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-sm tw:text-tertiary">
    {items.map((item, index) => (
      <span className="tw:inline-flex tw:items-center tw:gap-2" key={index}>
        {item.title}
        {index < items.length - 1 && (
          <span className="tw:text-quaternary">/</span>
        )}
      </span>
    ))}
  </nav>
);

type TableRender<T extends object> = {
  bivarianceHack: (value: unknown, record: T, index: number) => ReactNode;
}['bivarianceHack'];

export interface TableColumn<T extends object> {
  title?: ReactNode;
  key?: Key;
  dataIndex?: keyof T;
  width?: number;
  render?: TableRender<T>;
}

export type ColumnsType<T extends object> = Array<TableColumn<T>>;

interface TableProps<T extends object> {
  columns: ColumnsType<T>;
  dataSource: T[];
  locale?: {
    emptyText?: ReactNode;
  };
  pagination?: boolean;
  rowKey: keyof T | ((record: T) => Key);
}

const getRowKey = <T extends object>(
  rowKey: TableProps<T>['rowKey'],
  record: T
): Key =>
  typeof rowKey === 'function'
    ? rowKey(record)
    : String(record[rowKey] ?? JSON.stringify(record));

export const Table = <T extends object>({
  columns,
  dataSource,
  locale,
  rowKey,
}: TableProps<T>) => {
  if (dataSource.length === 0) {
    return (
      <div className="tw:py-6 tw:text-center tw:text-sm tw:text-tertiary">
        {locale?.emptyText}
      </div>
    );
  }

  return (
    <CoreTable aria-label="AI Governance table">
      <CoreTable.Header columns={columns}>
        {(column) => (
          <CoreTable.Head id={String(column.key ?? column.dataIndex)}>
            {column.title}
          </CoreTable.Head>
        )}
      </CoreTable.Header>
      <CoreTable.Body items={dataSource}>
        {(record) => (
          <CoreTable.Row
            columns={columns}
            id={String(getRowKey(rowKey, record))}>
            {(column) => {
              const value = column.dataIndex
                ? record[column.dataIndex]
                : undefined;

              return (
                <CoreTable.Cell>
                  {column.render
                    ? column.render(value, record, 0)
                    : String(value ?? '')}
                </CoreTable.Cell>
              );
            }}
          </CoreTable.Row>
        )}
      </CoreTable.Body>
    </CoreTable>
  );
};

interface TimelineItem {
  children?: ReactNode;
  color?: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

export const Timeline = ({ items }: TimelineProps) => (
  <div className="tw:flex tw:flex-col tw:gap-4">
    {items.map((item, index) => (
      <div className="tw:flex tw:gap-3" key={index}>
        <span className="tw:mt-1.5 tw:size-2 tw:rounded-full tw:bg-brand-solid" />
        <div className="tw:flex-1">{item.children}</div>
      </div>
    ))}
  </div>
);

export const Tabs = CoreTabs;

export const SearchInput = CoreInput;

export const EmptyIcon = FileSearch01;

export const SearchIcon = SearchLg;

export const AlertIcon = AlertCircle;
