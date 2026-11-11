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
 * Colour and icon of every domain and data product that has a style, so a client holding
 * only a domain or data product reference can draw its chip by id.
 */
export interface DomainStyles {
    /**
     * Styles of the domains and data products that have a colour or an icon. Entities without
     * either are omitted.
     */
    data: EntityStyle[];
}

/**
 * Colour and icon of one domain or data product. The cover image stays on the entity.
 */
export interface EntityStyle {
    /**
     * Id of the domain or data product.
     */
    id: string;
    /**
     * Colour and icon of the domain or data product.
     */
    style: Style;
    /**
     * Entity type: `domain` or `dataProduct`.
     */
    type: string;
}

/**
 * Colour and icon of the domain or data product.
 *
 * UI Style is used to associate a color code and/or icon to entity to customize the look of
 * that entity in UI.
 */
export interface Style {
    /**
     * Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
     */
    color?: string;
    /**
     * Cover image configuration for the entity.
     */
    coverImage?: CoverImage;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

/**
 * Cover image configuration for the entity.
 *
 * Cover image configuration for an entity. This is used to display a banner or header image
 * for entities like Domain, Glossary, Data Product, etc.
 */
export interface CoverImage {
    /**
     * Position of the cover image in CSS background-position format. Supports keywords (top,
     * center, bottom) or pixel values (e.g., '20px 30px').
     */
    position?: string;
    /**
     * URL of the cover image.
     */
    url?: string;
}
