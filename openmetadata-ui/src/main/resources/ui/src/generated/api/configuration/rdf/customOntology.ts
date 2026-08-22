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
 * A user-authored extension to the canonical OpenMetadata ontology. Custom classes and
 * properties live in the om-extension: namespace and never collide with the read-only
 * canonical om: namespace.
 */
export interface CustomOntology {
    /**
     * Custom OWL classes defined by this extension.
     */
    classes?: CustomClass[];
    /**
     * Markdown description of the extension. Should explain why these classes/properties are
     * needed.
     */
    description?: string;
    displayName?: string;
    /**
     * Stable identifier for the extension. Lowercase letters, digits, hyphen.
     */
    name: string;
    /**
     * Custom OWL properties defined by this extension.
     */
    properties?: CustomProperty[];
}

/**
 * A user-defined OWL class.
 */
export interface CustomClass {
    /**
     * Markdown description of the class.
     */
    description?: string;
    /**
     * Human-readable label (rdfs:label).
     */
    label?: string;
    /**
     * Parent class URIs. May reference canonical om: classes (e.g. om:DataAsset) or other
     * custom classes within this same extension. Must not be empty.
     */
    subClassOf: string[];
    /**
     * Full URI of the class. Must start with the om-extension: namespace.
     */
    uri: string;
}

/**
 * A user-defined OWL ObjectProperty or DatatypeProperty.
 */
export interface CustomProperty {
    /**
     * Markdown description of the property.
     */
    description?: string;
    /**
     * URI of the property's rdfs:domain (the class instances this property applies to).
     */
    domain: string;
    /**
     * Human-readable label.
     */
    label?: string;
    /**
     * URI of the property's rdfs:range. For DatatypeProperty, an XSD datatype URI; for
     * ObjectProperty, a class URI.
     */
    range: string;
    /**
     * Optional parent properties.
     */
    subPropertyOf?: string[];
    /**
     * OWL property type.
     */
    type: Type;
    /**
     * Full URI of the property. Must start with the om-extension: namespace.
     */
    uri: string;
}

/**
 * OWL property type.
 */
export enum Type {
    DatatypeProperty = "DatatypeProperty",
    ObjectProperty = "ObjectProperty",
}
