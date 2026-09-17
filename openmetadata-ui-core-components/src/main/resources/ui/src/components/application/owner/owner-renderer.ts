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
import type { RenderOwnerContent } from './owner.types';

/**
 * App-wide owner chip renderer.
 *
 * The library cannot import the consuming app's owner hover card
 * (`UserPopOverCard` fetches user/team data and uses app routing), so the app
 * registers how an owner chip should be wrapped — once, at bootstrap — and
 * every `OwnerChip` (compact, stack, overflow) picks it up automatically. This
 * keeps hover behaviour identical everywhere without threading a
 * `renderOwnerContent` prop through every call site.
 *
 * When nothing is registered (Storybook, library unit tests) chips render
 * bare, which is the correct standalone default.
 */
let ownerRenderer: RenderOwnerContent | undefined;

/** Register the owner chip wrapper. Call once at app startup. */
export const setOwnerRenderer = (
  renderer: RenderOwnerContent | undefined
): void => {
  ownerRenderer = renderer;
};

export const getOwnerRenderer = (): RenderOwnerContent | undefined =>
  ownerRenderer;
