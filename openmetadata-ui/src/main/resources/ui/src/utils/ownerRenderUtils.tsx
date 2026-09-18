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
import { lazy, Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { OwnerType } from '../enums/user.enum';

// `index.tsx` registers this util at startup, so a static import of
// UserPopOverCard put the hover-card tree — and with it most of
// ui-core-components — on the entry graph, costing ~95 KiB Brotli of first
// paint for a card nobody has hovered yet.
const loadUserPopOverCard = () =>
  import('../components/common/PopOverCard/UserPopOverCard');

const UserPopOverCard = lazy(loadUserPopOverCard);

// Warm the chunk once the browser goes idle. `import()` is still a split point,
// so this keeps the card out of the entry bundle, but it resolves the lazy
// component during startup — before any owner chip exists to point at. Without
// it a pointer already resting on the fallback would miss the `mouseenter` that
// the real trigger needs, and the card would stay shut until the pointer left
// and came back.
if (typeof window !== 'undefined') {
  const warm = () => void loadUserPopOverCard().catch(() => undefined);
  const idle = (
    window as typeof window & {
      requestIdleCallback?: (callback: () => void) => number;
    }
  ).requestIdleCallback;

  idle ? idle(warm) : window.setTimeout(warm, 0);
}

/**
 * Wraps an owner chip in a UserPopOverCard so hovering the owner avatar/name
 * shows the user/team hover card. Pass as the `renderOwnerContent` prop of a
 * non-compact `<Owner>`.
 *
 * This is a plain module-level function (referentially stable, no hooks) so it
 * can be used from column-render utilities — which cannot call
 * `useOwnerDisplayProps` — as well as from components.
 */
export const renderOwnerPopover = (
  owner: { name?: string; type?: string },
  chip: ReactNode
): ReactNode => (
  // A hover card that fails to load must not take the page with it: a
  // `React.lazy` rejection otherwise reaches the app-level boundary. Both
  // fallbacks are the chip itself, so the owner name survives either way.
  <ErrorBoundary fallbackRender={() => <>{chip}</>}>
    <Suspense fallback={chip}>
      <UserPopOverCard
        type={owner.type === 'team' ? OwnerType.TEAM : OwnerType.USER}
        userName={owner.name ?? ''}>
        {chip}
      </UserPopOverCard>
    </Suspense>
  </ErrorBoundary>
);
