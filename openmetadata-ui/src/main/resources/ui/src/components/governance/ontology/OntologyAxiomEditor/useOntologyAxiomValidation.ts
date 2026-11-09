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

import { AxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyProfileReport } from '../../../../generated/api/data/ontologyProfileReport';
import { validateOntologyAxiom } from '../../../../rest/ontologyAPI';
import { getErrorText } from '../../../../utils/StringUtils';
import {
  buildOntologyAxiomRequest,
  isOntologyAxiomReady,
  OntologyAxiomFormState,
} from './OntologyAxiomEditor.utils';

const LIVE_VALIDATION_DELAY_MILLIS = 450;

interface AxiomValidation {
  key: string;
  report?: OntologyProfileReport;
  rejection?: string;
}

/**
 * Checks the rule with the server as the person types. A 400 is kept as a
 * reason rather than dropped, so the form can show it beside the field.
 */
export const useOntologyAxiomValidation = (
  values: OntologyAxiomFormState,
  ontologyFullyQualifiedName: string,
  sentence: string
) => {
  const { t } = useTranslation();
  const sequence = useRef(0);
  const latest = useRef({ sentence, values });
  latest.current = { sentence, values };
  const [validation, setValidation] = useState<AxiomValidation>();
  const [isValidating, setIsValidating] = useState(false);
  const key = JSON.stringify(values);

  const request = useCallback(
    async (submitted: OntologyAxiomFormState, submittedSentence: string) => {
      const submittedKey = JSON.stringify(submitted);
      try {
        const report = await validateOntologyAxiom(
          buildOntologyAxiomRequest(
            ontologyFullyQualifiedName,
            submitted,
            submittedSentence
          )
        );

        return { key: submittedKey, report };
      } catch (error) {
        return {
          key: submittedKey,
          rejection: getErrorText(
            error as AxiosError,
            t('server.unexpected-error')
          ),
        };
      }
    },
    [ontologyFullyQualifiedName, t]
  );

  useEffect(() => {
    if (!isOntologyAxiomReady(latest.current.values)) {
      setValidation(undefined);

      return;
    }
    const current = ++sequence.current;
    const timeout = window.setTimeout(() => {
      void request(latest.current.values, latest.current.sentence).then(
        (result) => {
          if (current === sequence.current) {
            setValidation(result);
          }
        }
      );
    }, LIVE_VALIDATION_DELAY_MILLIS);

    return () => {
      window.clearTimeout(timeout);
      sequence.current += 1;
    };
  }, [key, request]);

  const clear = useCallback(() => setValidation(undefined), []);

  const validate = async (submitted = values) => {
    setIsValidating(true);
    const result = await request(submitted, latest.current.sentence);
    setValidation(result);
    setIsValidating(false);

    return result.report;
  };

  return {
    clear,
    current: validation?.key === key ? validation : undefined,
    isValidating,
    validate,
  };
};
