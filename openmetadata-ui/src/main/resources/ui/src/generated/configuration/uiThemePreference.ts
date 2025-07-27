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
 * This schema defines  UI related configuration and settings.
 */
export interface UIThemePreference {
    /**
     * References the LogoConfiguration schema which includes settings related to the custom
     * logos used in the application's user interface.
     */
    customLogoConfig: LogoConfiguration;
    /**
     * References the ThemeConfiguration schema that defines the custom theme color used in the
     * application's user interface.
     */
    customTheme: ThemeConfiguration;
}

/**
 * References the LogoConfiguration schema which includes settings related to the custom
 * logos used in the application's user interface.
 *
 * This schema defines the Logo Configuration.
 */
export interface LogoConfiguration {
    /**
     * Favicon Page Logo Image Url
     */
    customFaviconUrlPath?: string;
    /**
     * Login Page Logo Image Url
     */
    customLogoUrlPath?: string;
    /**
     * Navigation Bar Logo Image Url
     */
    customMonogramUrlPath?: string;
}

/**
 * References the ThemeConfiguration schema that defines the custom theme color used in the
 * application's user interface.
 *
 * This schema defines the Theme Configuration for UI elements.
 */
export interface ThemeConfiguration {
    /**
     * Color used to indicate errors in the UI, in hex code format or empty
     */
    errorColor: string;
    /**
     * Color used for informational messages in the UI, in hex code format or empty
     */
    infoColor: string;
    /**
     * Primary color used in the UI, in hex code format or empty.
     */
    primaryColor: string;
    /**
     * Color used to indicate success in the UI, in hex code format or empty
     */
    successColor: string;
    /**
     * Color used to indicate warnings in the UI, in hex code format or empty
     */
    warningColor: string;
}
