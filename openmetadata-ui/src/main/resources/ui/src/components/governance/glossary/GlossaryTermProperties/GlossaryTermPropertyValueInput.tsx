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
import { useTranslation } from 'react-i18next';
import { GlossaryTermPropertyDatatype } from '../../../../generated/type/glossaryTermProperty';
import { GlossaryTermPropertyValueInputProps } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';
import GlossaryTermPropertyDateValue from './GlossaryTermPropertyDateValue';
import GlossaryTermPropertySelectValue from './GlossaryTermPropertySelectValue';
import GlossaryTermPropertyTextValue from './GlossaryTermPropertyTextValue';

const GlossaryTermPropertyValueInput = (
  inputProps: GlossaryTermPropertyValueInputProps
) => {
  const { t } = useTranslation();
  const { error } = inputProps;
  const props = {
    ...inputProps,
    errorMessage: error ? t(error.key, error.values) : undefined,
  };
  const { datatype, multiValued } = props.property;

  if (datatype === GlossaryTermPropertyDatatype.Boolean) {
    return <GlossaryTermPropertySelectValue {...props} />;
  }
  if (datatype === GlossaryTermPropertyDatatype.Enum && !multiValued) {
    return <GlossaryTermPropertySelectValue {...props} />;
  }
  if (datatype === GlossaryTermPropertyDatatype.Date && !multiValued) {
    return <GlossaryTermPropertyDateValue {...props} />;
  }

  return <GlossaryTermPropertyTextValue {...props} />;
};

export default GlossaryTermPropertyValueInput;
