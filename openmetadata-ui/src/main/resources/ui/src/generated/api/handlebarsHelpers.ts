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
 * List of available Handlebars helpers with metadata
 *
 * Metadata describing a Handlebars helper
 */
export interface HandlebarsHelpers {
    /**
     * Character offset position in the template where the cursor should be placed after helper
     * insertion
     */
    cursorOffset?: number;
    /**
     * Brief description of what the helper does (max 15 words)
     */
    description: string;
    /**
     * Helper name as used in templates
     */
    name: string;
    /**
     * List of usage examples showing different ways to use the helper
     */
    usages: HandlebarsHelperUsage[];
}

/**
 * Usage example for a Handlebars helper
 */
export interface HandlebarsHelperUsage {
    /**
     * Concrete example demonstrating the helper usage
     */
    example: string;
    /**
     * Syntax pattern showing how to use the helper
     */
    syntax: string;
}
