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
import type { Meta, StoryObj } from '@storybook/react';
import {
  type CSSProperties,
  type ReactElement,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {
  TypographySize,
  TypographyWeight,
} from '../components/foundations/typography';
import { Typography } from '../components/foundations/typography';

const meta = {
  title: 'Foundations/Typography',
  component: Typography,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          'Typography styles its content through the `.prose` class.',
          '',
          '`styles/typography.css` applies its real rules via a *descendant*',
          'selector (`.prose :not(...)`), and every rule in that block is gated',
          'on an element type — `p`, `h1`-`h6`, `ol`, `ul`, `li`, `blockquote`,',
          '`a`, `code`, `pre`, `img`, `figure`, table elements. Those need a',
          'wrapper for the rule to match, so Typography renders',
          '`<div class="prose"><p>…</p></div>`.',
          '',
          '`span` and `div` are targeted by no such rule, so no wrapper is',
          'emitted and `prose` sits on the element itself. That keeps the',
          'computed text style identical — the element-level `.prose` layer',
          'only sets inherited properties — while letting inline text stay',
          'inline. A wrapper would make every `as="span"` a block element and,',
          'when nested, produce a `<div>` inside a `<span>`.',
          '',
          'Ellipsis and non-default quote variants always keep the wrapper:',
          'the former carries the truncation classes, the latter is also',
          'styled through a descendant selector.',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <h1>Heading 1</h1>
        <p>
          This is a paragraph with <strong>bold text</strong> and{' '}
          <em>italic text</em>.
        </p>
      </>
    ),
  },
};

export const WithAsProp: Story = {
  name: "as='p' — keeps the .prose wrapper",
  render: () => <Typography as="p">Hello</Typography>,
};

export const WithAsAndClassName: Story = {
  name: "as='p' with className on the rendered element",
  render: () => (
    <Typography as="p" className="font-bold text-blue-600">
      Hello with className on the inner &lt;p&gt;
    </Typography>
  ),
};

export const Headings: StoryObj = {
  render: () => (
    <Typography>
      <h1>Heading 1</h1>
      <h2>Heading 2</h2>
      <h3>Heading 3</h3>
      <h4>Heading 4</h4>
      <h5>Heading 5</h5>
      <h6>Heading 6</h6>
    </Typography>
  ),
};

export const Paragraphs: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 600 }}>
      <Typography>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
        <p>
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
          nisi ut aliquip ex ea commodo consequat.
        </p>
      </Typography>
    </div>
  ),
};

export const Lists: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Typography>
        <h3>Unordered List</h3>
        <ul>
          <li>Item one</li>
          <li>Item two</li>
          <li>
            Item three with nested items
            <ul>
              <li>Nested item 1</li>
              <li>Nested item 2</li>
            </ul>
          </li>
        </ul>
        <h3>Ordered List</h3>
        <ol>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ol>
      </Typography>
    </div>
  ),
};

export const Links: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Typography>
        <p>
          Visit the <a href="#">OpenMetadata documentation</a> to learn more
          about the platform.
        </p>
      </Typography>
    </div>
  ),
};

export const CodeBlocks: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography>
        <p>
          Use inline <code>code formatting</code> for short snippets.
        </p>
        <pre>
          <code>{`const greeting = "Hello, World!";
console.log(greeting);`}</code>
        </pre>
      </Typography>
    </div>
  ),
};

export const Blockquote: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography quoteVariant="default">
        <blockquote>
          <p>The only way to do great work is to love what you do.</p>
        </blockquote>
      </Typography>
    </div>
  ),
};

export const CenteredQuote: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography quoteVariant="centered-quote">
        <blockquote>
          <p>The only way to do great work is to love what you do.</p>
        </blockquote>
      </Typography>
    </div>
  ),
};

export const MinimalQuote: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography quoteVariant="minimal-quote">
        <blockquote>
          <p>The only way to do great work is to love what you do.</p>
        </blockquote>
      </Typography>
    </div>
  ),
};

export const DomStructure: StoryObj = {
  name: 'DOM structure — wrapper vs no wrapper',
  parameters: {
    docs: {
      description: {
        story:
          'Inspect these in the DOM panel. `span` and `div` render bare with ' +
          '`prose` on the element; `p` and the other prose-targeted elements ' +
          'keep the `<div class="prose">` wrapper so the descendant rules ' +
          'still match.',
      },
    },
  },
  render: () => (
    <div style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
      <div>
        <code>as=&quot;span&quot;</code> →{' '}
        <code>&lt;span class=&quot;prose&quot;&gt;</code>
        <div>
          <Typography>no wrapper</Typography>
        </div>
      </div>
      <div>
        <code>as=&quot;div&quot;</code> →{' '}
        <code>&lt;div class=&quot;prose&quot;&gt;</code>
        <div>
          <Typography as="div">no wrapper</Typography>
        </div>
      </div>
      <div>
        <code>as=&quot;p&quot;</code> →{' '}
        <code>&lt;div class=&quot;prose&quot;&gt;&lt;p&gt;</code>
        <div>
          <Typography as="p">
            wrapper kept — .prose p sets its margins
          </Typography>
        </div>
      </div>
      <div>
        <code>ellipsis</code> → wrapper kept (carries the truncation classes)
        <div style={{ width: 200 }}>
          <Typography ellipsis>
            wrapper kept because ellipsis needs somewhere to clip
          </Typography>
        </div>
      </div>
    </div>
  ),
};

export const InlineFlow: StoryObj = {
  name: 'Inline flow — text stays in the sentence',
  parameters: {
    docs: {
      description: {
        story:
          'The reason `span` drops the wrapper. A block-level wrapper would ' +
          'push each Typography onto its own line, breaking any sentence that ' +
          'mixes plain text with emphasised fragments — activity-feed headers ' +
          'and form labels beside links are the common cases.',
      },
    },
  },
  render: () => (
    <p style={{ maxWidth: 460 }}>
      Updated by <Typography className="tw:font-semibold">Alice</Typography> in{' '}
      <Typography className="tw:font-semibold">Sales Pipeline</Typography> — all
      three fragments share one line.
    </p>
  ),
};

export const AsArticle: StoryObj = {
  name: "as='article' — inner element is article",
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography as="article">
        <h1>Article Title</h1>
        <p>
          This Typography component renders the inner element as an article.
        </p>
      </Typography>
    </div>
  ),
};

const ALL_SIZES: {
  value: TypographySize;
  px: number;
  lineHeight: number;
  letterSpacing?: string;
}[] = [
  { value: 'display-2xl', px: 72, lineHeight: 90, letterSpacing: '-2%' },
  { value: 'display-xl', px: 60, lineHeight: 72, letterSpacing: '-2%' },
  { value: 'display-lg', px: 48, lineHeight: 60, letterSpacing: '-2%' },
  { value: 'display-md', px: 36, lineHeight: 44, letterSpacing: '-2%' },
  { value: 'display-sm', px: 30, lineHeight: 38 },
  { value: 'display-xs', px: 24, lineHeight: 32 },
  { value: 'text-xl', px: 20, lineHeight: 30 },
  { value: 'text-lg', px: 18, lineHeight: 28 },
  { value: 'text-md', px: 16, lineHeight: 24 },
  { value: 'text-sm', px: 14, lineHeight: 20 },
  { value: 'text-xs', px: 12, lineHeight: 18 },
];

const ALL_WEIGHTS: {
  label: string;
  fontWeight: number;
  value: TypographyWeight;
}[] = [
  { label: 'Regular', fontWeight: 400, value: 'regular' },
  { label: 'Medium', fontWeight: 500, value: 'medium' },
  { label: 'Semibold', fontWeight: 600, value: 'semibold' },
  { label: 'Bold', fontWeight: 700, value: 'bold' },
];

const metaStyle: CSSProperties = {
  fontSize: '11px',
  color: '#98a2b3',
  fontWeight: 400,
  lineHeight: 1.4,
};
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0 48px 12px 0',
  fontWeight: 500,
  color: '#344054',
  fontSize: '12px',
};
const tdMetaStyle: CSSProperties = {
  padding: '20px 48px 20px 0',
  verticalAlign: 'top',
};

export const AllVariants: StoryObj = {
  name: 'All Variants',
  parameters: { layout: 'padded' },
  render: () => (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif' }}>
      <p
        style={{
          fontSize: '12px',
          color: '#667085',
          marginBottom: '24px',
          marginTop: 0,
        }}>
        Font size tokens and weight variants available on the{' '}
        <code style={{ fontSize: '11px' }}>Typography</code> component via{' '}
        <code style={{ fontSize: '11px' }}>size</code> and{' '}
        <code style={{ fontSize: '11px' }}>weight</code> props.
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, paddingBottom: '12px' }}>
              <div>Size</div>
              <div style={metaStyle}>token / px</div>
            </th>
            {ALL_WEIGHTS.map(({ label, fontWeight }) => (
              <th key={label} style={{ ...thStyle, paddingBottom: '12px' }}>
                <div>{label}</div>
                <div style={metaStyle}>{fontWeight}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_SIZES.map(({ value: size, px, lineHeight, letterSpacing }) => (
            <tr key={size} style={{ borderTop: '1px solid #f2f4f7' }}>
              <td style={{ ...tdMetaStyle, whiteSpace: 'nowrap' }}>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#344054',
                    fontWeight: 500,
                  }}>
                  {size}
                </div>
                <div style={metaStyle}>Size: {px}px</div>
                <div style={metaStyle}>Line height: {lineHeight}px</div>
                {letterSpacing && (
                  <div style={metaStyle}>Letter spacing: {letterSpacing}</div>
                )}
              </td>
              {ALL_WEIGHTS.map(({ value: weight }) => (
                <td key={weight} style={tdMetaStyle}>
                  <Typography size={size} weight={weight}>
                    {size.startsWith('display')
                      ? `Display ${size.replace('display-', '')}`
                      : `Text ${size.replace('text-', '')}`}
                  </Typography>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};

const LONG_TEXT =
  'This is a very long piece of text that will be truncated when the ellipsis prop is used. It keeps going and going to demonstrate the overflow behaviour of the Typography component with various ellipsis configurations.';

export const EllipsisSingleLine: StoryObj = {
  name: 'Ellipsis — single line (ellipsis={true})',
  render: () => (
    <div style={{ maxWidth: 300 }}>
      <Typography ellipsis as="p">
        {LONG_TEXT}
      </Typography>
    </div>
  ),
};

export const EllipsisMultiLine: StoryObj = {
  name: 'Ellipsis — multi-line (rows=3)',
  render: () => (
    <div style={{ maxWidth: 300 }}>
      <Typography as="p" ellipsis={{ rows: 3 }}>
        {LONG_TEXT}
      </Typography>
    </div>
  ),
};

export const EllipsisWithTooltip: StoryObj = {
  name: 'Ellipsis — with tooltip',
  render: () => (
    <div style={{ maxWidth: 300 }}>
      <Typography as="p" ellipsis={{ tooltip: LONG_TEXT }}>
        {LONG_TEXT}
      </Typography>
    </div>
  ),
};

export const EllipsisMultiLineWithTooltip: StoryObj = {
  name: 'Ellipsis — multi-line with tooltip (rows=2)',
  render: () => (
    <div style={{ maxWidth: 300 }}>
      <Typography as="p" ellipsis={{ rows: 2, tooltip: LONG_TEXT }}>
        {LONG_TEXT}
      </Typography>
    </div>
  ),
};

type ParityRow = {
  antd: string;
  core: string;
  node: ReactElement;
  expected: Partial<Record<ParityProp, string>>;
};

type ParityProp =
  | 'fontSize'
  | 'lineHeight'
  | 'fontWeight'
  | 'color'
  | 'marginBottom';

const PARITY_PROPS: ParityProp[] = [
  'fontSize',
  'lineHeight',
  'fontWeight',
  'color',
  'marginBottom',
];

// Chrome serialises color-mix() output as color(srgb …); compare as rgba.
const normalizeColor = (value: string) =>
  value.replace(
    /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+) \/ ([\d.]+)\)/,
    (_, r, g, b, a) =>
      `rgba(${[r, g, b]
        .map((c) => Math.round(Number(c) * 255))
        .join(', ')}, ${Number(a)})`
  );

// Light-mode values measured from antd Typography rendered with the app's
// antd-master.less + global overrides, 14px / 1.5715 body.
const PARITY_ROWS: ParityRow[] = [
  {
    antd: '<Text>',
    core: '<Typography variant="text">',
    node: <Typography variant="text">Text</Typography>,
    expected: { fontSize: '14px', fontWeight: '400', color: 'rgb(24, 29, 39)' },
  },
  {
    antd: '<Text type="secondary">',
    core: 'variant="text" color="secondary"',
    node: (
      <Typography color="secondary" variant="text">
        Secondary
      </Typography>
    ),
    expected: { color: 'rgba(0, 0, 0, 0.45)' },
  },
  {
    antd: '<Text type="danger">',
    core: 'variant="text" color="danger"',
    node: (
      <Typography color="danger" variant="text">
        Danger
      </Typography>
    ),
    expected: { color: 'rgb(217, 45, 32)' },
  },
  {
    antd: '<Text strong>',
    core: 'variant="text" strong',
    node: (
      <Typography strong variant="text">
        Strong
      </Typography>
    ),
    expected: { fontWeight: '600' },
  },
  {
    antd: '<Text code>',
    core: 'variant="text" code',
    node: (
      <Typography code variant="text">
        code
      </Typography>
    ),
    expected: { fontSize: '11.9px' },
  },
  {
    antd: '<Paragraph>',
    core: 'variant="paragraph"',
    node: <Typography variant="paragraph">Paragraph</Typography>,
    expected: { marginBottom: '14px' },
  },
  {
    antd: '<Title level={1}>',
    core: 'variant="title" level={1}',
    node: (
      <Typography level={1} variant="title">
        Title 1
      </Typography>
    ),
    expected: {
      fontSize: '38px',
      lineHeight: '46.74px',
      fontWeight: '600',
      color: 'rgba(0, 0, 0, 0.85)',
      marginBottom: '19px',
    },
  },
  {
    antd: '<Title level={2}>',
    core: 'variant="title" level={2}',
    node: (
      <Typography level={2} variant="title">
        Title 2
      </Typography>
    ),
    expected: {
      fontSize: '30px',
      lineHeight: '40.5px',
      fontWeight: '600',
      marginBottom: '15px',
    },
  },
  {
    antd: '<Title level={3}>',
    core: 'variant="title" level={3}',
    node: (
      <Typography level={3} variant="title">
        Title 3
      </Typography>
    ),
    expected: {
      fontSize: '24px',
      lineHeight: '32.4px',
      fontWeight: '600',
      marginBottom: '12px',
    },
  },
  {
    antd: '<Title level={4}>',
    core: 'variant="title" level={4}',
    node: (
      <Typography level={4} variant="title">
        Title 4
      </Typography>
    ),
    expected: {
      fontSize: '20px',
      lineHeight: '28px',
      fontWeight: '600',
      marginBottom: '10px',
    },
  },
  {
    antd: '<Title level={5}>',
    core: 'variant="title" level={5}',
    node: (
      <Typography level={5} variant="title">
        Title 5
      </Typography>
    ),
    expected: {
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: '600',
      marginBottom: '8px',
    },
  },
  {
    antd: '<Link href>',
    core: 'variant="link" href',
    node: (
      <Typography href="#parity" variant="link">
        Link
      </Typography>
    ),
    expected: {
      fontSize: '14px',
      lineHeight: '21px',
      fontWeight: '500',
      color: 'rgb(23, 92, 211)',
    },
  },
];

const ParityCheck = ({ row }: { row: ParityRow }) => {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [actual, setActual] = useState<Partial<Record<ParityProp, string>>>({});

  useLayoutEffect(() => {
    const el = cellRef.current?.querySelector('[data-typography]');
    const text = el?.querySelector('strong, code') ?? el;
    if (!el || !text) {
      return;
    }
    const outer = getComputedStyle(el);
    const inner = getComputedStyle(text);
    setActual({
      fontSize: inner.fontSize,
      lineHeight: inner.lineHeight,
      fontWeight: inner.fontWeight,
      color: normalizeColor(inner.color),
      marginBottom: outer.marginBottom,
    });
  }, []);

  const mismatches = PARITY_PROPS.filter(
    (prop) => row.expected[prop] && row.expected[prop] !== actual[prop]
  );

  return (
    <tr>
      <td>
        <code>{row.antd}</code>
      </td>
      <td>
        <code>{row.core}</code>
      </td>
      <td ref={cellRef}>{row.node}</td>
      <td>
        {PARITY_PROPS.filter((prop) => row.expected[prop]).map((prop) => (
          <div key={prop}>
            {prop}: {row.expected[prop]} / {actual[prop]}
          </div>
        ))}
      </td>
      <td data-testid="parity-result">
        {mismatches.length ? `MISMATCH: ${mismatches.join(', ')}` : 'match'}
      </td>
    </tr>
  );
};

export const AntdParity: StoryObj = {
  name: 'antd parity (variant)',
  parameters: {
    docs: {
      description: {
        story: [
          '`variant` reproduces antd Typography. Each row renders the core',
          'element and compares its live computed style with the value antd',
          'renders in the app (light mode). antd is not a core dependency, so',
          'the antd column is the measured reference, not a live render; the',
          'wrapper sets the antd body font (14px / 1.5715).',
        ].join(' '),
      },
    },
  },
  render: () => (
    <table style={{ fontSize: 14, lineHeight: 1.5715, borderSpacing: 12 }}>
      <thead>
        <tr>
          <th>antd</th>
          <th>core</th>
          <th>rendered</th>
          <th>expected / actual</th>
          <th>result</th>
        </tr>
      </thead>
      <tbody>
        {PARITY_ROWS.map((row) => (
          <ParityCheck key={row.antd} row={row} />
        ))}
      </tbody>
    </table>
  ),
};
