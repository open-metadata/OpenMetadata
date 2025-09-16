/*
 *  Copyright 2025 Collate.
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
 * User-specific preferences for a persona that override default persona UI customization.
 * These are limited customizations that users can apply to personalize their experience
 * while still inheriting the base persona configuration.
 */
export interface PersonaPreferences {
    /**
     * User's personal customizations for the landing page.
     */
    landingPageSettings?: LandingPageSettings;
    /**
     * UUID of the persona these preferences belong to.
     */
    personaId: string;
    /**
     * Name of the persona for quick reference and linking.
     */
    personaName: string;
}

/**
 * User's personal customizations for the landing page.
 */
export interface LandingPageSettings {
    /**
     * Custom header background color for the landing page.
     */
    headerColor?: string;
    /**
     * Reference to a custom header background image (reserved for future use).
     */
    headerImage?: string;
}
