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

// Separate build entry (@openmetadata/ui-core-components/icon) so Icon and the
// ICON_MAP it carries (a plain object referencing ~44 icon components, which a
// bundler cannot tree-shake key-by-key) stay out of the main `.`/`./components`
// barrel — consumers only pay for this when they actually import it, ideally
// via React.lazy.
export * from '../components/foundations/icon/icon';
export * from '../components/foundations/icon/icon.types';
