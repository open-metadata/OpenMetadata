/*
 *  Copyright 2022 Collate.
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

export const UrlEntityCharRegEx = /[#.%;?/\\]/g;
export const EMAIL_REG_EX = /^\S+@\S+\.\S+$/;

/**
 * strings that contain a combination of letters, alphanumeric characters, hyphens,
 * spaces, periods, single quotes, ampersands, and parentheses, with support for Unicode characters.
 */
export const ENTITY_NAME_REGEX = /^((?!::).)*$/;

/**
 * Matches any string that does NOT contain the following:
 * - Double colon (::)
 * - Double quote (")
 * - Greater-than symbol (>)
 * Useful for restricting names from including these forbidden characters.
 */
export const TEST_CASE_NAME_REGEX = /^((?!::)(?!")(?!>).)*$/;

export const TAG_NAME_REGEX = /^[\p{L}\p{M}\w\- .&()]+$/u;
export const NAME_LENGTH_REGEX = /^.{2,64}$/;

export const passwordRegex =
  /^(?=.*\d)(?=.*[A-Z])(?=.*[a-z])(?=.*[^\w\d\s:])([^\s]){8,56}$/g;

export const ONEOF_ANYOF_ALLOF_REGEX = /(oneof|anyof|allof)/;

export const markdownTextAndIdRegex = /^(\S.*?)\s*\$\(id="(.*?)"\)/;
export const MARKDOWN_MATCH_ID = /\$\(id="(.*?)"\)/;

export const CUSTOM_PROPERTY_NAME_REGEX =
  /^(?![\p{Lu}\p{Lt}])[\p{L}a-z][\p{L}a-zA-Z0-9]*$/u;

export const ENDS_WITH_NUMBER_REGEX = /\d+$/;

export const HEX_COLOR_CODE_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export const TASK_SANITIZE_VALUE_REGEX = /^"|"$/g;

export const TIMESTAMP_UNIX_IN_MILLISECONDS_REGEX = /^\d{13}$/;

export const ALL_ASTERISKS_REGEX = /^\*+$/;

// Split the input into pairs using `;` and handle quoted strings properly
export const SEMICOLON_SPLITTER = /;(?=(?:(?:[^"]*"){2})*[^"]*$)/;

// Use regex to check if the string starts and ends with escape characters
export const VALIDATE_ESCAPE_START_END_REGEX = /^(\\+|"+)([\s\S]*?)(\\+|"+)$/;

// Validates decimal numbers between 0 and 1 (inclusive)
// Matches: 0, 0.5, 0.123, 1, 1.0, 1.00, etc.
export const DECIMAL_ZERO_TO_ONE_REGEX = /^(0(\.\d+)?|1(\.0+)?)$/;

// Validates integers between 0 and 100 (inclusive)
// Matches: 0, 1, 9, 10, 50, 99, 100
export const INTEGER_ZERO_TO_HUNDRED_REGEX = /^(100|[1-9]?\d)$/;

// Validates locale/language codes (ISO 639-1 format)
// Matches: en, fr, de, en-US, fr-CA, de-DE, etc.
// Format: two lowercase letters optionally followed by hyphen and two uppercase letters
export const LOCALE_CODE_REGEX = /^[a-z]{2}(-[A-Z]{2})?$/;

// Matches URLs (http/https with content, absolute paths with content, data URIs) OR filenames with image extensions
// Filenames restricted to alphanumeric, hyphens, underscores, and dots for security
export const IMAGE_URL_PATTERN =
  /^(https?:\/\/.+|\/[^\s]+|data:image\/.+)|^[\w\-.]+\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i;
