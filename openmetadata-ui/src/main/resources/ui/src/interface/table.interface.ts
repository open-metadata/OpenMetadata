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

import { Key } from 'react';

/**
 * Structural mirror of antd's `FilterValue` (`(Key | boolean)[]`).
 *
 * Declared rather than re-exported: importing it from `antd/lib/table/interface`
 * here would register a new antd specifier with the deprecation guard, and the
 * component layer is migrating off antd. Structural typing means a value typed
 * with antd's version is still assignable to this one, so the table `onChange`
 * signature keeps working unchanged.
 */
export type FilterValue = (Key | boolean)[];
