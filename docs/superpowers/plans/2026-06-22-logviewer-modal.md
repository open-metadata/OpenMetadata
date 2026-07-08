# LogViewer Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, presentational `LogViewerModal` component that displays log text in a dark terminal-style modal matching the design screenshot, using the existing `@melloware/react-logviewer` library and the `@openmetadata/ui-core-components` modal shell.

**Architecture:** A fully-controlled (open/onClose) presentational component in the main UI app. It composes `ModalOverlay` + `Modal` from `ui-core-components` with a custom dark body: a header row (title + copy/download/close icon-buttons) and a full-bleed `LazyLog`. No data fetching. Live-log ready via a pass-through `follow` prop.

**Tech Stack:** React + TypeScript, `@melloware/react-logviewer` (`LazyLog` v6.4.1), `@openmetadata/ui-core-components` (React-Aria modal/buttons), `react-aria-components` (`Dialog`), `@untitledui/icons`, Tailwind v4 (`tw:` prefix), Jest + React Testing Library.

## Global Constraints

- All Tailwind utility classes MUST use the `tw:` prefix (e.g. `tw:flex`, `tw:bg-primary`).
- No string literals in the component — use `useTranslation` (`const { t } = useTranslation()`); reuse existing keys: `label.download`, `label.search-entity`, `label.log-plural`. No new i18n keys are required.
- No `any` in production code (`.component.tsx`, `.interface.ts`). Test mocks may use minimal local typing.
- Use design tokens only (`bg-primary`, `text-primary`, `border-secondary`, etc.) — never hardcoded colors.
- Component library is `@openmetadata/ui-core-components` — NOT MUI, NOT Ant Design.
- Apache 2.0 license header on every new source file (run `yarn license-header-fix <files>`).
- Run the UI checkstyle sequence (organize-imports → eslint --fix → prettier --write) before finishing (see final task / `ui-checkstyle` skill).
- Component does NO data fetching; parent owns `open`, `logs`, `loading`, `follow`.
- File location root: `openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/`.

---

## File Structure

```
openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/
  LogViewerModal.interface.ts      # LogViewerModalProps (created in Task 1)
  LogViewerModal.component.tsx     # presentational component (Tasks 1-4)
  LogViewerModal.test.tsx          # Jest + RTL (Tasks 1-4)
  log-viewer-modal.less            # scoped theming for LazyLog internals (Task 4)
```

All commands below run from:
`openmetadata-ui/src/main/resources/ui`

---

### Task 1: Modal shell — title, logs body, open/close

**Files:**
- Create: `openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/LogViewerModal.interface.ts`
- Create: `openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/LogViewerModal.component.tsx`
- Test: `openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/LogViewerModal.test.tsx`

**Interfaces:**
- Produces: `LogViewerModalProps` and `default export LogViewerModal: FunctionComponent<LogViewerModalProps>`.
  ```ts
  interface LogViewerModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    logs: string;
    loading?: boolean;              // default false
    theme?: 'dark' | 'light';       // default 'dark'
    follow?: boolean;               // default false
    enableSearch?: boolean;         // default true
    enableCopy?: boolean;           // default true
    onDownload?: () => void;
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `LogViewerModal.test.tsx` (license header added later by `license-header-fix`):

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import LogViewerModal from './LogViewerModal.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: ({ text, follow }: { text: string; follow?: boolean }) => (
    <pre data-follow={String(follow)} data-testid="lazy-log">
      {text}
    </pre>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ModalOverlay: ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="modal-overlay">{children}</div> : null,
  Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ButtonUtility: ({
    icon,
    tooltip,
    onClick,
    'data-testid': testId,
  }: {
    icon: unknown;
    tooltip?: string;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <button aria-label={tooltip} data-testid={testId} onClick={onClick}>
      icon
    </button>
  ),
  CloseButton: ({
    onPress,
    'data-testid': testId,
  }: {
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} onClick={onPress}>
      close
    </button>
  ),
}));

jest.mock('react-aria-components', () => ({
  Dialog: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className} data-testid="dialog">
      {children}
    </div>
  ),
}));

jest.mock('../CopyToClipboardButton/CopyToClipboardButton', () => ({
  __esModule: true,
  default: ({ copyText }: { copyText: string }) => (
    <button data-copytext={copyText} data-testid="copy-button">
      copy
    </button>
  ),
}));

jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader">loading</div>,
}));

import { ReactNode } from 'react';

const defaultProps = {
  logs: 'line-one\nline-two',
  onClose: jest.fn(),
  open: true,
  title: 'Auto-document workflow · logs',
};

describe('LogViewerModal', () => {
  it('renders the title and logs when open', () => {
    render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('log-viewer-title')).toHaveTextContent(
      'Auto-document workflow · logs'
    );
    expect(screen.getByTestId('lazy-log')).toHaveTextContent('line-one');
  });

  it('renders nothing when closed', () => {
    render(<LogViewerModal {...defaultProps} open={false} />);

    expect(screen.queryByTestId('lazy-log')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(<LogViewerModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('log-viewer-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/components/common/LogViewerModal/LogViewerModal.test.tsx`
Expected: FAIL — `Cannot find module './LogViewerModal.component'`.

- [ ] **Step 3: Create the interface file**

Create `LogViewerModal.interface.ts`:

```ts
export interface LogViewerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  logs: string;
  loading?: boolean;
  theme?: 'dark' | 'light';
  follow?: boolean;
  enableSearch?: boolean;
  enableCopy?: boolean;
  onDownload?: () => void;
}
```

- [ ] **Step 4: Create the component (shell + title + logs body)**

Create `LogViewerModal.component.tsx`:

```tsx
import { LazyLog } from '@melloware/react-logviewer';
import {
  CloseButton,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { Dialog as AriaDialog } from 'react-aria-components';
import Loader from '../Loader/Loader';
import { LogViewerModalProps } from './LogViewerModal.interface';

const LogViewerModal: FunctionComponent<LogViewerModalProps> = ({
  open,
  onClose,
  title,
  logs,
  loading = false,
  theme = 'dark',
  follow = false,
  enableSearch = true,
}: LogViewerModalProps) => {
  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <Modal className="tw:w-full tw:max-w-4xl">
        <AriaDialog
          aria-label={title}
          className={classNames('log-viewer-modal', `theme-${theme}`, {
            'dark-mode': theme === 'dark',
          })}>
          <div className="tw:flex tw:h-[80vh] tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:bg-primary tw:shadow-xl">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-secondary tw:px-4 tw:py-3">
              <span
                className="tw:truncate tw:text-sm tw:font-semibold tw:text-primary"
                data-testid="log-viewer-title">
                {title}
              </span>
              <div className="tw:flex tw:items-center tw:gap-1">
                <CloseButton
                  data-testid="log-viewer-close"
                  size="sm"
                  onPress={onClose}
                />
              </div>
            </div>
            <div
              className="tw:relative tw:flex-1 tw:overflow-hidden"
              data-testid="log-viewer-body">
              {loading ? (
                <div className="tw:flex tw:h-full tw:items-center tw:justify-center">
                  <Loader />
                </div>
              ) : (
                <LazyLog
                  caseInsensitive
                  enableLineNumbers
                  selectableLines
                  enableSearch={enableSearch}
                  extraLines={1}
                  follow={follow}
                  text={logs}
                />
              )}
            </div>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
};

export default LogViewerModal;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/components/common/LogViewerModal/LogViewerModal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/
git commit -m "feat(ui): add LogViewerModal shell with title and log body"
```

---

### Task 2: Header actions — copy + download

**Files:**
- Modify: `openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/LogViewerModal.component.tsx`
- Test: `openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/LogViewerModal.test.tsx`

**Interfaces:**
- Consumes: `LogViewerModalProps` from Task 1 (`enableCopy`, `onDownload`).
- Produces: header renders `CopyToClipboardButton` (default on) and a `ButtonUtility` download button (only when `onDownload` provided). Download button `data-testid="log-viewer-download"`.

- [ ] **Step 1: Write the failing tests**

Append these `it` blocks inside the `describe('LogViewerModal', ...)` in `LogViewerModal.test.tsx`:

```tsx
  it('shows the copy button by default and hides it when enableCopy is false', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('copy-button')).toBeInTheDocument();

    rerender(<LogViewerModal {...defaultProps} enableCopy={false} />);

    expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument();
  });

  it('renders the download button only when onDownload is provided and fires it', () => {
    const onDownload = jest.fn();
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.queryByTestId('log-viewer-download')).not.toBeInTheDocument();

    rerender(<LogViewerModal {...defaultProps} onDownload={onDownload} />);
    fireEvent.click(screen.getByTestId('log-viewer-download'));

    expect(onDownload).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/components/common/LogViewerModal/LogViewerModal.test.tsx`
Expected: FAIL — `copy-button` / `log-viewer-download` not found.

- [ ] **Step 3: Add copy + download to the header**

In `LogViewerModal.component.tsx`, update the imports to add `ButtonUtility`, the download icon, translation hook, and the copy button:

```tsx
import { LazyLog } from '@melloware/react-logviewer';
import {
  ButtonUtility,
  CloseButton,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { Download01 } from '@untitledui/icons';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { Dialog as AriaDialog } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import CopyToClipboardButton from '../CopyToClipboardButton/CopyToClipboardButton';
import Loader from '../Loader/Loader';
import { LogViewerModalProps } from './LogViewerModal.interface';
```

Add `enableCopy = true` and `onDownload` to the destructured props, and `const { t } = useTranslation();` at the top of the component body:

```tsx
const LogViewerModal: FunctionComponent<LogViewerModalProps> = ({
  open,
  onClose,
  title,
  logs,
  loading = false,
  theme = 'dark',
  follow = false,
  enableSearch = true,
  enableCopy = true,
  onDownload,
}: LogViewerModalProps) => {
  const { t } = useTranslation();
```

Replace the header actions `<div className="tw:flex tw:items-center tw:gap-1">...</div>` block with:

```tsx
              <div className="tw:flex tw:items-center tw:gap-1">
                {enableCopy && (
                  <CopyToClipboardButton copyText={logs} position="top" />
                )}
                {onDownload && (
                  <ButtonUtility
                    data-testid="log-viewer-download"
                    icon={Download01}
                    tooltip={t('label.download')}
                    onClick={onDownload}
                  />
                )}
                <CloseButton
                  data-testid="log-viewer-close"
                  size="sm"
                  onPress={onClose}
                />
              </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/components/common/LogViewerModal/LogViewerModal.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/
git commit -m "feat(ui): add copy and download actions to LogViewerModal header"
```

---

### Task 3: Loading state + theme + follow

**Files:**
- Test: `openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/LogViewerModal.test.tsx`
- (Component already wired in Tasks 1-2 — this task locks behavior with tests.)

**Interfaces:**
- Consumes: `LogViewerModalProps` (`loading`, `theme`, `follow`) — already implemented in Tasks 1-2.
- Produces: verified behavior — `loading` swaps `LazyLog` for `Loader`; `theme` controls the `dark-mode`/`theme-light` class on the dialog root; `follow` flows to `LazyLog`.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('LogViewerModal', ...)`:

```tsx
  it('shows the loader instead of logs when loading', () => {
    render(<LogViewerModal {...defaultProps} loading />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('lazy-log')).not.toBeInTheDocument();
  });

  it('applies the dark theme class by default and the light theme class when requested', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('dialog')).toHaveClass('dark-mode');

    rerender(<LogViewerModal {...defaultProps} theme="light" />);

    expect(screen.getByTestId('dialog')).toHaveClass('theme-light');
    expect(screen.getByTestId('dialog')).not.toHaveClass('dark-mode');
  });

  it('passes the follow flag through to the log viewer', () => {
    render(<LogViewerModal {...defaultProps} follow />);

    expect(screen.getByTestId('lazy-log')).toHaveAttribute('data-follow', 'true');
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `yarn test src/components/common/LogViewerModal/LogViewerModal.test.tsx`
Expected: PASS (8 tests). These assert behavior already implemented in Tasks 1-2; if any fails, fix the component to satisfy it (e.g., confirm the `dark-mode`/`theme-${theme}` class wiring and the `loading` branch).

- [ ] **Step 3: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/LogViewerModal.test.tsx
git commit -m "test(ui): cover LogViewerModal loading, theme, and follow behavior"
```

---

### Task 4: LazyLog theming, license headers, checkstyle, visual verification

**Files:**
- Create: `openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/log-viewer-modal.less`
- Modify: `openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/LogViewerModal.component.tsx` (import the `.less`)

**Interfaces:**
- Consumes: the `.log-viewer-modal`, `.theme-dark`, `.theme-light` class names set on the dialog root in Task 1.
- Produces: themed `LazyLog` internals (full height, dark default, light override).

- [ ] **Step 1: Create the scoped LESS for LazyLog internals**

`LazyLog`'s internal DOM (line gutter, line text, search bar) is third-party and cannot take `tw:` classes, so theme it with a scoped stylesheet. Create `log-viewer-modal.less`:

```less
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

.log-viewer-modal {
  // LazyLog measures the nearest sized container; force it to fill the body.
  .react-lazylog {
    height: 100% !important;
    border-radius: 0;
  }

  &.theme-light {
    .react-lazylog {
      background-color: var(--color-bg-primary);
      color: var(--color-text-primary);
    }

    .react-lazylog .react-lazylog-searchbar {
      background-color: var(--color-bg-secondary);
      border-top: 1px solid var(--color-border-secondary);
    }
  }
}
```

- [ ] **Step 2: Import the LESS in the component**

In `LogViewerModal.component.tsx`, add the stylesheet import directly above the interface import (asset/style imports come last in the import order):

```tsx
import Loader from '../Loader/Loader';
import './log-viewer-modal.less';
import { LogViewerModalProps } from './LogViewerModal.interface';
```

- [ ] **Step 3: Re-run the unit tests (no regression)**

Run: `yarn test src/components/common/LogViewerModal/LogViewerModal.test.tsx`
Expected: PASS (8 tests). The `.less` import is a no-op in Jest (styles are mocked), so tests stay green.

- [ ] **Step 4: Add Apache license headers to the new TS/TSX files**

Run: `yarn license-header-fix "src/components/common/LogViewerModal/*.ts" "src/components/common/LogViewerModal/*.tsx"`
Expected: headers prepended to `LogViewerModal.component.tsx`, `LogViewerModal.interface.ts`, `LogViewerModal.test.tsx` (the `.less` already has one from Step 1).

- [ ] **Step 5: Run the UI checkstyle sequence on the changed files**

Run, in order (use the `ui-checkstyle` skill or run manually):
```bash
yarn organize-imports:cli src/components/common/LogViewerModal/LogViewerModal.component.tsx src/components/common/LogViewerModal/LogViewerModal.interface.ts src/components/common/LogViewerModal/LogViewerModal.test.tsx
yarn lint:fix src/components/common/LogViewerModal/
yarn pretty:base --write "src/components/common/LogViewerModal/**/*.{ts,tsx,less}"
```
Then type-check:
```bash
npx tsc --noEmit
```
Expected: no lint errors, no diff after prettier, no TS errors. Fix any reported issues (e.g., JSX prop ordering — alphabetical with callbacks last).

- [ ] **Step 6: Visual verification against the screenshot**

There is no consuming page yet, so verify visually by temporarily rendering the component:
1. Run `yarn start` (dev server on `localhost:3000`).
2. Temporarily mount `<LogViewerModal open title="Auto-document workflow · logs" logs={SAMPLE} onClose={() => {}} onDownload={() => {}} />` in a scratch route/page (do NOT commit this scratch wiring), with a multi-line `SAMPLE` string of timestamped log lines.
3. Confirm against `.context/attachments/hAgoyj/Screenshot 2026-06-22 at 10.36.07 AM.png`: dark surface, header title left + copy/download/close right, line-number gutter, monospace log lines, bottom search bar.
4. Remove the scratch wiring.

- [ ] **Step 7: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/src/components/common/LogViewerModal/
git commit -m "style(ui): theme LogViewerModal log panel and add license headers"
```

---

## Self-Review

**1. Spec coverage:**
- Pure presentational component, no fetching → Tasks 1-2 (controlled props, no API calls). ✓
- Uses existing `@melloware/react-logviewer` (`LazyLog`) → Task 1. ✓
- Untitled/Tailwind styling + `ui-core-components` shell → Tasks 1, 4. ✓
- Interface (`open`, `onClose`, `title`, `logs`, `loading`, `theme`, `follow`, `enableSearch`, `enableCopy`, `onDownload`) → Task 1 interface + wired across Tasks 1-3. ✓
- Controlled open/close → Task 1 (`ModalOverlay isOpen/onOpenChange`). ✓
- Download button included → Task 2. ✓
- `theme` prop default `'dark'` → Tasks 1, 3. ✓
- Live-logs `follow` (future-ready, default false) → Tasks 1, 3. ✓
- Dark terminal styling matching screenshot → Tasks 1, 4 + visual verification. ✓
- Tests for all behaviors → Tasks 1-3. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to" — every code step shows complete code. ✓

**3. Type consistency:** `LogViewerModalProps` field names are identical across the interface (Task 1) and all usages (Tasks 1-3). Component is `default export` and imported as `LogViewerModal` from `./LogViewerModal.component` consistently in the test and the plan. `data-testid` values (`log-viewer-title`, `log-viewer-close`, `log-viewer-download`, `log-viewer-body`, `copy-button`, `loader`, `lazy-log`, `dialog`) are consistent between component and tests. ✓
