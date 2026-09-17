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
import type { OwnerRef } from '../../../types';
import type { RenderOwnerContent } from './owner.types';

/**
 * App-wide owner display registration.
 *
 * The library cannot compute two things itself — the owner hover card
 * (`UserPopOverCard` fetches user/team data) and the in-app profile href
 * (built from the app's routing). The app registers both once at bootstrap and
 * every `OwnerChip` (compact, stack, overflow) picks them up automatically, so
 * call sites just pass the owner array — no `renderOwnerContent` prop and no
 * `toOwnersWithHref` wrapping.
 *
 * When nothing is registered (Storybook, library unit tests) chips render bare
 * with no link, which is the correct standalone default.
 */
let ownerRenderer: RenderOwnerContent | undefined;
let ownerHrefResolver: ((owner: OwnerRef) => string | undefined) | undefined;

/** Register the owner chip hover-card wrapper. Call once at app startup. */
export const setOwnerRenderer = (
  renderer: RenderOwnerContent | undefined
): void => {
  ownerRenderer = renderer;
};

export const getOwnerRenderer = (): RenderOwnerContent | undefined =>
  ownerRenderer;

/** Register how an owner's in-app profile href is resolved. Call once at
 * startup. Owner chips use it to make the owner name a link. */
export const setOwnerHrefResolver = (
  resolver: ((owner: OwnerRef) => string | undefined) | undefined
): void => {
  ownerHrefResolver = resolver;
};

/** An explicit `href` on the ref wins; otherwise fall back to the registered
 * resolver. Returns undefined when neither is available (name renders as text). */
export const resolveOwnerHref = (owner: OwnerRef): string | undefined =>
  owner.href ?? ownerHrefResolver?.(owner);
