/*
 *  Copyright 2024 Collate.
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
import { VariableUpdateListeners } from '../mathematics.interface';
import { evaluateExpression } from './evaluate-expression';

export function updateEvaluation(
  latex: string,
  id: string,
  resultSpan: HTMLSpanElement,
  showEvalResult: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editorStorage: any
) {
  let evalRes = evaluateExpression(
    latex,
    editorStorage.variables,
    editorStorage.variableListeners
  ); // Do not show if error occurs (in general, we probably want to make showing the result optional)
  const updateResultSpan = () => {
    if (evalRes?.result) {
      if (evalRes.result.toString().split('.')[1]?.length > 5) {
        resultSpan.innerText = '=' + evalRes.result.toFixed(4);
      } else {
        resultSpan.innerText = '=' + evalRes.result.toString();
      }
    } else {
      resultSpan.innerText = '=Error';
    }

    if (!showEvalResult) {
      resultSpan.style.display = 'none';
    } else {
      resultSpan.style.display = 'inline-block';
    }
  };
  updateResultSpan();
  if (evalRes?.variablesUsed) {
    for (const v of evalRes.variablesUsed) {
      // Register Listeners
      let listenersForV: VariableUpdateListeners =
        editorStorage.variableListeners[v];
      if (listenersForV === undefined) {
        listenersForV = [];
      }
      listenersForV.push({
        id: id,
        onUpdate: () => {
          {
            evalRes = evaluateExpression(
              latex,
              editorStorage.variables,
              editorStorage.variableListeners
            );
            updateResultSpan();
          }
        },
      });
      editorStorage.variableListeners[v] = listenersForV;
    }
  }

  return evalRes;
}
