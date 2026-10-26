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
/**
 * Dark brand-primary is translucent, so the base node paints it once as a
 * gradient layer over an opaque raised fill; its inner sections stay
 * transparent (custom-node.less). Repeating the tint per section stacked the
 * alpha into uneven bands of blue.
 */
export const BASE_NODE_FILL_CLASS =
  'tw:bg-raised tw:bg-linear-to-b tw:from-bg-brand-primary tw:to-bg-brand-primary';

/** Column panel fill: secondary in light, the node's own raised fill in dark. */
export const NODE_INSET_FILL_CLASS = 'tw:bg-secondary tw:dark:bg-raised';
