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
 * A typed property that a glossary term declares for itself and, when inheritable, for
 * every term below it. See
 * ADR:2026-11-12-glossary-terms-declare-their-own-properties-and-values.
 */
export interface GlossaryTermProperty {
    /**
     * Datatype of the property's values. It never changes after the property is declared.
     */
    datatype: GlossaryTermPropertyDatatype;
    /**
     * What the property captures.
     */
    description?: string;
    /**
     * Label shown for the property. It can change at any time.
     */
    displayName?: string;
    /**
     * Allowed values of an `enum` property. Required for `enum` and rejected otherwise.
     */
    enumValues?: string[];
    /**
     * When true every term below the declaring term gets the property and can inherit its value.
     */
    inheritable?: boolean;
    /**
     * When true the property holds up to 100 values. Allowed for `string` and `enum` only.
     */
    multiValued?: boolean;
    /**
     * Name of the property. Values are keyed by it, so it never changes.
     */
    name: string;
    /**
     * Display unit for the values. Nothing converts between units.
     */
    unit?: string;
}

/**
 * Datatype of the property's values. It never changes after the property is declared.
 *
 * Datatype of a glossary term property. Values are stored as lexical strings and checked
 * against the matching XSD datatype.
 */
export enum GlossaryTermPropertyDatatype {
    Boolean = "boolean",
    Date = "date",
    DateTime = "dateTime",
    Decimal = "decimal",
    Enum = "enum",
    Integer = "integer",
    String = "string",
    URL = "url",
}
