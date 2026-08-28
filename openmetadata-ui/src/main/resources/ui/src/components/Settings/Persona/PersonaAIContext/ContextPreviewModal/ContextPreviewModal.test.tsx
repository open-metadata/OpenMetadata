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
import { render, screen, waitFor } from '@testing-library/react';
import { CacheState } from '../../../../../generated/type/personaContextDefinition';
import {
  getPersonaAIContextDocument,
  PersonaContextDocument,
} from '../../../../../rest/PersonaAPI';
import { ContextPreviewModal } from './ContextPreviewModal.component';

jest.mock('../../../../../rest/PersonaAPI', () => ({
  getPersonaAIContextDocument: jest.fn(),
  refreshPersonaAIContextDocument: jest.fn(),
}));

jest.mock('../../../../../hooks/useClipBoard', () => ({
  useClipboard: () => ({
    hasCopied: false,
    onCopyToClipBoard: jest.fn(),
  }),
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../common/RichTextEditor/RichTextEditorPreviewNew', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => (
    <div data-testid="markdown-preview">{markdown}</div>
  ),
}));

const contextDocument: PersonaContextDocument = {
  bytes: 25,
  cacheState: CacheState.Fresh,
  entitiesIncluded: 1,
  generatedAt: 1783700000000,
  markdown: '# Persona context',
  tokensEst: 7,
  truncated: false,
  truncatedCount: 0,
};

const mockedGetPersonaAIContextDocument =
  getPersonaAIContextDocument as jest.MockedFunction<
    typeof getPersonaAIContextDocument
  >;

describe('ContextPreviewModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetPersonaAIContextDocument.mockResolvedValue(contextDocument);
  });

  it('loads the document once when the parent callback changes', async () => {
    const { rerender } = render(
      <ContextPreviewModal
        open
        personaDisplayName="Business Analyst"
        personaId="11111111-1111-1111-1111-111111111111"
        onClose={jest.fn()}
        onDocumentLoaded={jest.fn()}
      />
    );

    expect(await screen.findByTestId('markdown-preview')).toHaveTextContent(
      '# Persona context'
    );
    expect(mockedGetPersonaAIContextDocument).toHaveBeenCalledTimes(1);
    expect(mockedGetPersonaAIContextDocument).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111'
    );

    rerender(
      <ContextPreviewModal
        open
        personaDisplayName="Business Analyst"
        personaId="11111111-1111-1111-1111-111111111111"
        onClose={jest.fn()}
        onDocumentLoaded={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(mockedGetPersonaAIContextDocument).toHaveBeenCalledTimes(1)
    );
  });
});
