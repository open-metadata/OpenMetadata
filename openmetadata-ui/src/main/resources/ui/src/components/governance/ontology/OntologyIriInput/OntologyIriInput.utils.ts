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

import { OntologyIriOption } from './OntologyIriInput.types';

/** The context and IRI shown under an option's name. */
// The core option row does not truncate its second line, and IRIs and FQNs run longer than the
// narrowest drawer's list. Keep the start and the unique tail so two same-named options still differ.
export const OPTION_SUPPORTING_TEXT_MAX = 44;

export const truncateMiddle = (
  text: string,
  max: number = OPTION_SUPPORTING_TEXT_MAX
) => {
  if (text.length <= max) {
    return text;
  }
  const head = Math.ceil((max - 1) / 2);

  return `${text.slice(0, head)}…${text.slice(text.length - (max - 1 - head))}`;
};

export const optionSupportingText = (option: OntologyIriOption) =>
  truncateMiddle(
    option.context ? `${option.context} · ${option.iri}` : option.iri
  );

/** A hidden label still names the field for assistive tech. */
export const fieldLabelProps = (label: string, hideLabel?: boolean) => ({
  'aria-label': label,
  label: hideLabel ? undefined : label,
});

/** A combobox without a visible label shows it as a plain placeholder, as the design's row inputs do. */
export const comboBoxLabelProps = (label: string, hideLabel?: boolean) => ({
  ...fieldLabelProps(label, hideLabel),
  fontSize: hideLabel ? ('sm' as const) : undefined,
  placeholder: hideLabel ? label : undefined,
  shortcut: !hideLabel,
  showSearchIcon: !hideLabel,
});
