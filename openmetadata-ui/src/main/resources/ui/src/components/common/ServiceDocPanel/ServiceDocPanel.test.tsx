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
import { act, render, screen } from '@testing-library/react';
import ServiceRequirements from './ServiceDocPanel';

jest.mock('../Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../RichTextEditor/RichTextEditorPreviewer', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="requirement-text">{markdown}</div>
    ))
);

jest.mock('../../../rest/miscAPI', () => ({
  fetchMarkdownFile: jest
    .fn()
    .mockImplementation(() => Promise.resolve('markdown text')),
}));

const mockOnBack = jest.fn();
const mockOnNext = jest.fn();

const mockProps = {
  serviceName: 'Test Service',
  serviceType: 'Test Type',
  onBack: mockOnBack,
  onNext: mockOnNext,
};

describe('ServiceRequirements Component', () => {
  it('Should render the requirements and action buttons', async () => {
    await act(async () => {
      render(<ServiceRequirements {...mockProps} />);
    });

    expect(screen.getByTestId('service-requirements')).toBeInTheDocument();

    const requirementTextElement = screen.getByTestId('requirement-text');

    expect(requirementTextElement).toBeInTheDocument();

    expect(requirementTextElement).toHaveTextContent('markdown text');
  });
});
