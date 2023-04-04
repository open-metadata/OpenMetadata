/*
 *  Copyright 2023 Collate.
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
import { GlossaryAction } from 'components/Glossary/GlossaryV1.interfaces';
import {
  getGlossaryPathWithAction,
  getGlossaryVersionsPath,
} from './RouterUtils';

describe('RouterUtils', () => {
  it('should generate correct path with action', () => {
    const fqn = 'example_fqn';
    const action = GlossaryAction.IMPORT;
    const expectedPath = `/glossary/${fqn}/action/${action}`;

    expect(getGlossaryPathWithAction(fqn, action)).toEqual(expectedPath);
  });

  it('should generate correct path with version', () => {
    const glossaryName = 'example_fqn';
    const version = '1.0';
    const expectedPath = `/glossary/${glossaryName}/versions/${version}`;

    expect(getGlossaryVersionsPath(glossaryName, version)).toEqual(
      expectedPath
    );
  });
});
