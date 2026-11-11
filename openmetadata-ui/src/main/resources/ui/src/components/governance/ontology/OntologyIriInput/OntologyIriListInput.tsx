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
import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import OntologyIriInput from './OntologyIriInput';
import { OntologyIriOption } from './OntologyIriInput.types';

interface OntologyIriListInputProps {
  label: string;
  value: string[];
  options?: ReadonlyArray<OntologyIriOption>;
  isDisabled?: boolean;
  testId: string;
  onChange: (iris: string[]) => void;
}

const OntologyIriListInput = ({
  label,
  value,
  options,
  isDisabled,
  testId,
  onChange,
}: OntologyIriListInputProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const candidate = draft.trim();
  const isValid = isAbsoluteOntologyIri(candidate);
  const error =
    candidate && !isValid ? t('message.invalid-concept-iri') : undefined;
  const labelOf = (iri: string) =>
    options?.find((option) => option.iri === iri)?.label ?? iri;
  const add = () => {
    if (isValid && !value.includes(candidate)) {
      onChange([...value, candidate]);
    }
    setDraft('');
  };

  return (
    <Box data-testid={testId} direction="col" gap={2}>
      {value.length > 0 && (
        <Box direction="row" gap={2} wrap="wrap">
          {value.map((iri) => (
            <Button
              aria-label={`${t('label.remove')} ${labelOf(iri)}`}
              color="secondary"
              iconTrailing={XClose}
              isDisabled={isDisabled}
              key={iri}
              size="sm"
              title={iri}
              onPress={() => onChange(value.filter((entry) => entry !== iri))}>
              {labelOf(iri)}
            </Button>
          ))}
        </Box>
      )}
      <Box align="end" direction="row" gap={2}>
        <OntologyIriInput
          error={error}
          isDisabled={isDisabled}
          label={label}
          options={options}
          value={draft}
          onChange={setDraft}
          onSubmit={add}
        />
        <Button
          color="secondary"
          isDisabled={isDisabled || !isValid}
          onPress={add}>
          {t('label.add')}
        </Button>
      </Box>
      {value.length === 0 && (
        <Typography color="secondary" size="text-xs">
          {t('message.ontology-iri-picker-hint')}
        </Typography>
      )}
    </Box>
  );
};

export default OntologyIriListInput;
