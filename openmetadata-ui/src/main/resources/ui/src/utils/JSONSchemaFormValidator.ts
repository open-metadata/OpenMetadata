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

import {
  customizeValidator,
  CustomValidatorOptionsType,
} from '@rjsf/validator-ajv8';
import Ajv2020 from 'ajv/dist/2020';

/**
 * The default export of `@rjsf/validator-ajv8` builds an Ajv that only carries the
 * draft-07 meta-schema. OpenMetadata's JSON Schemas declare
 * `https://json-schema.org/draft/2020-12/schema`, and Ajv rejects a dialect it has no
 * meta-schema for: compilation fails with `no schema with key or ref ...` and the form
 * reports that single error instead of validating any field. Constructing the validator
 * from Ajv's 2020-12 build is what keeps every RJSF form validating.
 *
 * Always build RJSF validators from here rather than importing `@rjsf/validator-ajv8`
 * directly.
 */
export const getJSONSchemaFormValidator = <T = unknown>(
  options: CustomValidatorOptionsType = {}
) => customizeValidator<T>({ ...options, AjvClass: Ajv2020 });

/** Shared, untyped validator for forms that do not need a generic form-data type. */
export const jsonSchemaFormValidator = getJSONSchemaFormValidator();
