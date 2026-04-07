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
export interface ComplexTypesObject {
    "hyperlink-cp"?: Hyperlink;
    "table-cp"?:     Table;
    [property: string]: any;
}

/**
 * A hyperlink custom property containing a URL and optional display text. When display text
 * is provided, it renders as a clickable hyperlink with the text label.
 */
export interface Hyperlink {
    /**
     * Optional display text for the hyperlink. If not provided, the URL will be displayed.
     */
    displayText?: string;
    /**
     * The URL that the hyperlink points to.
     */
    url: string;
}

/**
 * A table-type custom property having rows and columns where all column data types are
 * strings.
 */
export interface Table {
    /**
     * List of column names defined at the entity type level.
     */
    columns: string[];
    /**
     * List of rows added at the entity instance level. Each row contains dynamic fields based
     * on the defined columns.
     */
    rows?: { [key: string]: string }[];
}
