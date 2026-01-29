/*
 *  Copyright 2024 Collate.
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
 * Identity function for MUI Autocomplete filterOptions prop.
 * Use this when search is performed server-side (async) to prevent
 * MUI Autocomplete from applying its default client-side filtering.
 * @see https://mui.com/material-ui/react-autocomplete/#search-as-you-type
 */
export const asyncFilterOptions = <T>(options: T[]): T[] => options;
