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
import { OwnerType } from '../enums/user.enum';

// `index.tsx` registers this util at startup, so a static import of
// UserPopOverCard put the hover-card tree — and with it most of
// ui-core-components — on the entry graph, costing ~95 KiB Brotli of first
// paint. Lazy keeps the registration cheap: the chip paints immediately and
// the card activates once its chunk lands, which is before anyone can hover.
const UserPopOverCard = lazy(
  () => import('../components/common/PopOverCard/UserPopOverCard')
);

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
  <Suspense fallback={chip}>
    <UserPopOverCard
      type={owner.type === 'team' ? OwnerType.TEAM : OwnerType.USER}
      userName={owner.name ?? ''}>
      {chip}
    </UserPopOverCard>
  </Suspense>
);
