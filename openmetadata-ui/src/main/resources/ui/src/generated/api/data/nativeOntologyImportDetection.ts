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
 * Format the server would parse a native ontology import with.
 */
export interface NativeOntologyImportDetection {
    /**
     * Absent when neither the content nor the file name matches a supported format.
     */
    detectedFormat?: Format;
}

/**
 * Absent when neither the content nor the file name matches a supported format.
 *
 * Serialization of a native ontology import source.
 */
export enum Format {
    CSV = "csv",
    Jsonld = "jsonld",
    Ntriples = "ntriples",
    Rdfxml = "rdfxml",
    Turtle = "turtle",
}
