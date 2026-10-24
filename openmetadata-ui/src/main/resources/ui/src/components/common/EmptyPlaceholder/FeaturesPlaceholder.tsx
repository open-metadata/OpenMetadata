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
import { EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { EmptyPlaceholderVariantProps } from './EmptyPlaceholder.interface';

/**
 * Onboarding empty state: a title and description above feature columns
 * (`features`), with optional actions. Use it where a collection is empty
 * because the feature has not been set up yet, rather than for "no data".
 * Kept as a wrapper so every empty state shares one entry point
 * (ADR:2026-10-21-empty-states-render-through-the-placeholder-wrappers).
 *
 * The underlying `EmptyPlaceholder` is absolutely positioned, so the host
 * container must set `position: relative` for it to be visible.
 */
const FeaturesPlaceholder = (props: EmptyPlaceholderVariantProps) => (
  <EmptyPlaceholder variant="features" {...props} />
);

export default FeaturesPlaceholder;
