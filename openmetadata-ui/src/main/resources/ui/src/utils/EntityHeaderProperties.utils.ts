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
import { HeaderProperty } from '../components/DataAssets/EntityHeaderProperties/EntityHeaderProperties.types';

/**
 * The properties the header draws. An empty read-only property has nothing to
 * fill in, so it never shows; an empty editable one shows so it can be filled.
 */
export const getShownHeaderProperties = (
  properties: HeaderProperty[]
): HeaderProperty[] =>
  properties.filter(({ isEmpty, isReadOnly }) => !isEmpty || !isReadOnly);
