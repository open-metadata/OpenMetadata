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
import evaluatex from 'evaluatex/dist/evaluatex';
import { generateUUID } from '../../../../../utils/StringsUtils';
import {
  AllVariableUpdateListeners,
  MathVariable,
  MathVariables,
  VariableUpdateListeners,
} from '../mathematics.interface';

export function evaluateExpression(
  latex: string,
  variables: MathVariables,
  variableListeners: AllVariableUpdateListeners
):
  | {
      result: number | undefined;
      definedVariableID: string | undefined;
      variablesUsed: Set<string>;
    }
  | undefined {
  try {
    const regex = /\\pi({})?/g;
    let changedLatex = latex.replace(regex, '{PI}').trim();
    let definesVariable = undefined;
    const assignmentRegex = /^[\S\s]*?(?=\s*:=)\s*:=\s*/;
    const assRegexRes = assignmentRegex.exec(changedLatex);
    if (assRegexRes && assRegexRes[0]) {
      changedLatex = changedLatex.substring(assRegexRes[0].length);
      definesVariable = assRegexRes[1].trim();
    }
    const splitAtEq = changedLatex.split('=');
    if (splitAtEq[splitAtEq.length - 1].length > 0) {
      changedLatex = splitAtEq[splitAtEq.length - 1];
    } else if (splitAtEq.length >= 2) {
      changedLatex = splitAtEq[splitAtEq.length - 2];
    }
    const variableObj: Record<string, number> = {};
    let definedVariableID = undefined;
    let aliases: string[] = [];
    if (definesVariable) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      aliases = getVariableAliases(definesVariable);
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    changedLatex = getVariableName(changedLatex.replace('}', '}'));
    for (const id in variables) {
      const variable: MathVariable = variables[id];
      variableObj[id] = variable.value;
      for (const alias of variable.aliases) {
        // Replace all occurences of alias with
        const regexSafeAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const r = new RegExp(
          '(^|(?<=[^a-zA-Z]))' + regexSafeAlias + '($|(?=[^a-zA-Z]))',
          'g'
        );
        changedLatex = changedLatex.replace(r, id);
        for (const a of aliases) {
          if (alias === a) {
            definedVariableID = id;
          }
        }
      }
    }
    const res = evaluatex(changedLatex, {}, { latex: true });
    const usedVars: Set<string> = new Set(
      res.tokens
        .filter((t) => t.type === 'SYMBOL')
        .map((t) => t.value as string)
    );
    const resNum = res(variableObj);

    if (definesVariable !== undefined) {
      if (definedVariableID === undefined) {
        definedVariableID = generateUUID();
      }
      // Cyclic dependency! Fail early
      if (usedVars.has(definedVariableID)) {
        return undefined;
      }
      variables[definedVariableID] = {
        value: resNum,
        aliases: aliases,
      };
      const listeners: VariableUpdateListeners =
        variableListeners[definedVariableID];
      if (listeners !== undefined) {
        for (const l of listeners) {
          l.onUpdate();
        }
      }
    }

    return {
      definedVariableID: definedVariableID,
      variablesUsed: usedVars,
      result: resNum,
    };
  } catch (e) {
    return undefined;
  }
}

function getVariableAliases(variable: string) {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return [getVariableName(variable), getVariableName(variable, true)];
}

function parseInnerVariablePart(
  variablePart: string,
  skipOptionalBrackets = false
): string {
  variablePart = variablePart.trim();
  let mode: 'main' | 'sub' | 'sup' | 'after' = 'main';
  let depth = 0;
  let prevBackslash = false;
  let main = '';
  let sup = '';
  let sub = '';
  let after = '';
  let inCommand = false;
  for (const c of variablePart) {
    let writeC = true;
    if (c === '\\') {
      if (!prevBackslash && depth === 0) {
        inCommand = true;
      }
      prevBackslash = !prevBackslash;
    } else {
      prevBackslash = false;
    }
    if (c === ' ' && depth === 0) {
      inCommand = false;
    }
    if (!prevBackslash) {
      if (c === '_' && depth === 0 && mode === 'main') {
        mode = 'sub';
        writeC = false;
      }
      if (c === '^' && depth === 0 && mode === 'main') {
        mode = 'sup';
        writeC = false;
      }
      if (c === '{') {
        depth++;
      }
      if (c === '}') {
        depth--;
        if (depth === 0) {
          inCommand = false;
        }
      }
    }
    if (mode === 'main' && c === ' ' && depth === 0) {
      mode = 'after';
      writeC = false;
    }
    if (mode === 'main' && c === '\\' && depth === 0 && main !== '') {
      mode = 'after';
    }
    if (writeC) {
      if (mode === 'main') {
        main += c;
      } else if (mode === 'sub') {
        sub += c;
      } else if (mode === 'sup') {
        sup += c;
      } else if (mode === 'after') {
        after += c;
      }
      // Unless in a "group" {...}, go back to main mode
      // or command
      if ((mode === 'sub' || mode === 'sup') && depth === 0 && !inCommand) {
        mode = 'main';
      }
    }
  }
  if (sup.startsWith('{') && sup.endsWith('}')) {
    sup = sup.substring(1, sup.length - 1);
  }
  if (sub.startsWith('{') && sub.endsWith('}')) {
    sub = sub.substring(1, sub.length - 1);
  }
  let subpart = sub.trim();
  let suppart = sup.trim();
  if (skipOptionalBrackets && subpart.indexOf(' ') === -1) {
    subpart = sub !== '' ? `_${subpart}` : '';
  } else {
    subpart = sub !== '' ? `_{${subpart}}` : '';
  }
  if (skipOptionalBrackets && suppart.indexOf(' ') === -1) {
    suppart = sup !== '' ? `^${sup.trim()}` : '';
  } else {
    suppart = sup !== '' ? `^{${sup.trim()}}` : '';
  }
  const processedAfter =
    after !== '' ? ' ' + parseInnerVariablePart(after) : '';

  return `${main}${subpart}${suppart}${processedAfter}`;
}

function getVariableName(
  variablePart: string,
  skipOptionalBrackets = false
): string {
  variablePart = variablePart.trim();
  if (variablePart.startsWith('{') && variablePart.endsWith('}')) {
    return getVariableName(variablePart.substring(1, variablePart.length - 1));
  }
  const colorRegex = /(?![^\\])\\color{\w*}/g;
  if (colorRegex.test(variablePart)) {
    return getVariableName(variablePart.replace(colorRegex, ' '));
  }

  const textColorRegex = /\\textcolor{\w*}/g;
  if (textColorRegex.test(variablePart)) {
    return getVariableName(variablePart.replace(textColorRegex, ' '));
  }

  return parseInnerVariablePart(variablePart, skipOptionalBrackets);
}
