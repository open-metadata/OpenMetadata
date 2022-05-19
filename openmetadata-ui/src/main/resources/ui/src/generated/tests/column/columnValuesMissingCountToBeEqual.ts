/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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
 * This schema defines the test ColumnValuesMissingCount. Test the column values missing
 * count to be equal to given number.
 */
export interface ColumnValuesMissingCountToBeEqual {
    /**
     * No.of missing values to be equal to.
     */
    missingCountValue: number;
    /**
     * By default match all null and empty values to be missing. This field allows us to
     * configure additional strings such as N/A, NULL as missing strings as well.
     */
    missingValueMatch?: string[] | boolean | number | number | { [key: string]: any } | null | string;
}
