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

import { useCallback, useRef, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { OntologyAxiomFormState } from './OntologyAxiomEditor.utils';
import {
  EMPTY_QUICK_RULE,
  formToQuickRule,
  QuickRule,
  quickRuleToForm,
} from './OntologyAxiomQuickRule.utils';

export type AxiomEditorMode = 'quick' | 'advanced';

/**
 * Keeps the quick rule beside the form it writes, so each quick edit updates
 * the advanced fields and a switch back only happens when nothing is lost.
 */
export const useOntologyAxiomRule = (
  form: UseFormReturn<OntologyAxiomFormState>
) => {
  const [mode, setMode] = useState<AxiomEditorMode>('quick');
  const [quick, setQuick] = useState<QuickRule>(EMPTY_QUICK_RULE);
  const [lossyReason, setLossyReason] = useState<string>();
  const nameTouched = useRef(false);

  const load = useCallback((next: OntologyAxiomFormState, isSaved: boolean) => {
    const conversion = formToQuickRule(next);
    nameTouched.current = isSaved;
    setMode(conversion.rule ? 'quick' : 'advanced');
    setQuick(conversion.rule ?? EMPTY_QUICK_RULE);
    setLossyReason(conversion.rule ? undefined : conversion.reason);
  }, []);

  const changeQuick = (patch: Partial<QuickRule>) => {
    const next = { ...quick, ...patch };
    const nextForm = quickRuleToForm(next, form.getValues());
    setQuick(next);
    form.setValue('axiomType', nextForm.axiomType, { shouldDirty: true });
    form.setValue('subjectIri', nextForm.subjectIri, { shouldDirty: true });
    form.setValue('expressions', nextForm.expressions, { shouldDirty: true });
  };

  const changeMode = (next: AxiomEditorMode) => {
    const conversion = formToQuickRule(form.getValues());
    if (next === 'quick' && !conversion.rule) {
      setLossyReason(conversion.reason);

      return;
    }
    setMode(next);
    setLossyReason(undefined);
    if (conversion.rule) {
      setQuick(conversion.rule);
    }
  };

  return {
    changeMode,
    changeQuick,
    load,
    lossyReason,
    mode,
    nameTouched,
    quick,
  };
};
