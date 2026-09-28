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
import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps, SVGProps } from 'react';
import { Button } from '../components/base/buttons/button';
import './antd-button-reference.css';

/*
 * Migration aid for the antd Button -> core Button replacement: every antd
 * configuration in use (OSS + Collate) next to the core configuration the
 * migration spec maps it to. The left column is antd 4.24 markup styled by the
 * app's own compiled antd CSS (see antd-button-reference.css), so it renders as
 * the app does. Delete this story and the CSS once the migration is done.
 */

type AntdType = 'default' | 'primary' | 'text' | 'link';
type AntdSize = 'small' | 'middle' | 'large';

interface AntdConfig {
  type: AntdType;
  size: AntdSize;
  danger?: boolean;
  ghost?: boolean;
  icon?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  loading?: boolean;
  shape?: 'circle' | 'round';
  block?: boolean;
}

const PlusGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    fill="currentColor"
    height="1em"
    viewBox="64 64 896 896"
    width="1em"
    {...props}>
    <path d="M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8z" />
    <path d="M192 474h672q8 0 8 8v60q0 8-8 8H160q-8 0-8-8v-60q0-8 8-8z" />
  </svg>
);

const LoadingGlyph = () => (
  <svg
    aria-hidden="true"
    fill="currentColor"
    height="1em"
    viewBox="0 0 1024 1024"
    width="1em">
    <path d="M988 548c-19.9 0-36-16.1-36-36 0-59.4-11.6-117-34.6-171.3a440.45 440.45 0 00-94.3-139.9 437.71 437.71 0 00-139.9-94.3C629 83.6 571.4 72 512 72c-19.9 0-36-16.1-36-36s16.1-36 36-36c69.1 0 136.2 13.5 199.3 40.3C772.3 66 827 103 874 150c47 47 83.9 101.8 109.7 162.7 26.7 63.1 40.2 130.2 40.2 199.3.1 19.9-16 36-35.9 36z" />
  </svg>
);

const ANTD_SIZE_CLASS: Record<AntdSize, string | undefined> = {
  small: 'ant-btn-sm',
  middle: undefined,
  large: 'ant-btn-lg',
};

/** Mirrors the class list and children antd 4.24 `Button` renders. */
const AntdReference = ({ config }: { config: AntdConfig }) => {
  const className = [
    'ant-btn',
    config.shape && `ant-btn-${config.shape}`,
    `ant-btn-${config.type}`,
    ANTD_SIZE_CLASS[config.size],
    config.iconOnly && 'ant-btn-icon-only',
    config.ghost && 'ant-btn-background-ghost',
    config.loading && 'ant-btn-loading',
    config.danger && 'ant-btn-dangerous',
    config.block && 'ant-btn-block',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={className} disabled={config.disabled} type="button">
      {config.loading ? (
        <span className="ant-btn-loading-icon">
          <span className="anticon anticon-loading anticon-spin" role="img">
            <LoadingGlyph />
          </span>
        </span>
      ) : (
        config.icon && (
          <span className="anticon anticon-plus" role="img">
            <PlusGlyph />
          </span>
        )
      )}
      {!config.iconOnly && <span>Label</span>}
    </button>
  );
};

const CORE_SIZE = { small: 'sm', middle: 'md', large: 'lg' } as const;
const CORE_COLOR = {
  default: 'secondary',
  primary: 'primary',
  text: 'tertiary',
  link: 'link-color',
} as const;

/** The mapping from button-migration-spec.md, as code. */
const toCoreProps = (config: AntdConfig): ComponentProps<typeof Button> => {
  const color = config.danger
    ? 'primary-destructive'
    : config.ghost
    ? 'secondary-brand'
    : CORE_COLOR[config.type];

  return {
    boxed: color === 'link-color' || undefined,
    className:
      [
        config.block && 'tw:w-full',
        config.shape && 'tw:rounded-full tw:before:rounded-full',
      ]
        .filter(Boolean)
        .join(' ') || undefined,
    color,
    iconLeading: config.icon ? PlusGlyph : undefined,
    isDisabled: config.disabled,
    isLoading: config.loading,
    showTextWhileLoading: config.loading || undefined,
    size: CORE_SIZE[config.size],
  };
};

const configId = (c: AntdConfig) =>
  [
    `type=${c.type}`,
    c.size !== 'middle' && `size=${c.size}`,
    c.danger && 'danger',
    c.ghost && 'ghost',
    c.iconOnly ? 'icon-only' : c.icon && 'icon',
    c.shape && `shape=${c.shape}`,
    c.disabled && 'disabled',
    c.loading && 'loading',
    c.block && 'block',
  ]
    .filter(Boolean)
    .join(' ');

const TYPES: AntdType[] = ['default', 'primary', 'text', 'link'];
const SIZES: AntdSize[] = ['small', 'middle', 'large'];

const buildConfigs = (size: AntdSize): AntdConfig[] => [
  ...TYPES.flatMap((type) => [
    { type, size },
    { type, size, icon: true },
    { type, size, icon: true, iconOnly: true },
    { type, size, danger: true },
    { type, size, disabled: true },
    { type, size, loading: true },
  ]),
  { type: 'primary', size, ghost: true },
  { type: 'primary', size, ghost: true, icon: true },
  { type: 'primary', size, danger: true, disabled: true },
  { type: 'default', size, icon: true, iconOnly: true, shape: 'circle' },
  { type: 'text', size, icon: true, iconOnly: true, shape: 'circle' },
  { type: 'default', size, shape: 'round' },
  { type: 'primary', size, block: true },
];

const ParityTable = ({ size }: { size: AntdSize }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(220px, auto) 200px 200px',
      gap: 12,
      alignItems: 'center',
    }}>
    <strong className="tw:text-primary">antd config</strong>
    <strong className="tw:text-primary">antd (app CSS)</strong>
    <strong className="tw:text-primary">core mapping</strong>
    {buildConfigs(size).map((config) => {
      const id = configId(config);

      return [
        <code className="tw:text-xs tw:text-secondary" key={`${id}-label`}>
          {id}
        </code>,
        <div className="antd-ref" key={`${id}-antd`}>
          <AntdReference config={config} />
        </div>,
        <div key={`${id}-core`}>
          <Button {...toCoreProps(config)}>
            {config.iconOnly ? undefined : 'Label'}
          </Button>
        </div>,
      ];
    })}
  </div>
);

const meta = {
  title: 'Migration/Button antd parity',
  parameters: { layout: 'padded', theme: 'both' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = { render: () => <ParityTable size="small" /> };

export const Middle: Story = { render: () => <ParityTable size="middle" /> };

export const Large: Story = { render: () => <ParityTable size="large" /> };

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {SIZES.map((size) => (
        <ParityTable key={size} size={size} />
      ))}
    </div>
  ),
};
