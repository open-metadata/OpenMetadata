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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContextPromptCard } from './ContextPromptCard.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SAVED_PROMPT = 'You assist finance analysts.';
const SAVE_BUTTON = 'persona-context-prompt-save';
const CANCEL_BUTTON = 'persona-context-prompt-cancel';

const promptBox = () => screen.getByRole('textbox', { name: 'label.prompt' });

describe('ContextPromptCard', () => {
  it('renders nothing for a read-only user when no prompt is set', () => {
    const { container } = render(
      <ContextPromptCard canEdit={false} onSave={jest.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the prompt to read-only users without an editor', () => {
    render(
      <ContextPromptCard
        canEdit={false}
        prompt={SAVED_PROMPT}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByTestId('persona-context-prompt-text')).toHaveTextContent(
      SAVED_PROMPT
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId(SAVE_BUTTON)).not.toBeInTheDocument();
  });

  it('only offers to save once the draft differs from the saved prompt', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<ContextPromptCard canEdit prompt={SAVED_PROMPT} onSave={onSave} />);

    expect(screen.getByTestId(SAVE_BUTTON)).toBeDisabled();

    fireEvent.change(promptBox(), {
      target: { value: 'You assist finance analysts in EMEA.' },
    });
    fireEvent.click(screen.getByTestId(SAVE_BUTTON));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        'You assist finance analysts in EMEA.'
      )
    );
  });

  it('treats whitespace around the saved prompt as no change', () => {
    render(
      <ContextPromptCard canEdit prompt={SAVED_PROMPT} onSave={jest.fn()} />
    );

    fireEvent.change(promptBox(), { target: { value: `  ${SAVED_PROMPT}\n` } });

    // The server trims, so saving this would write back the same prompt.
    expect(screen.getByTestId(SAVE_BUTTON)).toBeDisabled();
  });

  it('lets an editor clear the prompt by saving an empty draft', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<ContextPromptCard canEdit prompt={SAVED_PROMPT} onSave={onSave} />);

    fireEvent.change(promptBox(), { target: { value: '' } });
    fireEvent.click(screen.getByTestId(SAVE_BUTTON));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''));
  });

  it('discards the draft on cancel', () => {
    render(
      <ContextPromptCard canEdit prompt={SAVED_PROMPT} onSave={jest.fn()} />
    );

    fireEvent.change(promptBox(), { target: { value: 'Unsaved draft' } });
    fireEvent.click(screen.getByTestId(CANCEL_BUTTON));

    expect(promptBox()).toHaveValue(SAVED_PROMPT);
    expect(screen.getByTestId(SAVE_BUTTON)).toBeDisabled();
  });

  it('picks up a prompt that changed underneath, such as a restored version', () => {
    const { rerender } = render(
      <ContextPromptCard canEdit prompt={SAVED_PROMPT} onSave={jest.fn()} />
    );

    rerender(
      <ContextPromptCard canEdit prompt="Restored prompt" onSave={jest.fn()} />
    );

    expect(promptBox()).toHaveValue('Restored prompt');
  });
});
