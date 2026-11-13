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
import { useFieldDoc } from '@openmetadata/ui-core-components';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { FormDrawerHintConfig, useFormDrawerWithHook } from './useFormDrawer';

jest.mock('../../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn(({ markdown }: { markdown: string }) => <div>{markdown}</div>)
);

const DocumentedField = () => {
  const doc = useFieldDoc({ name: 'name', label: 'Name', doc: 'Name doc' });

  return (
    <div {...doc}>
      <input aria-label="name" />
    </div>
  );
};

const Harness = ({
  open,
  formHint,
  onSubmit = jest.fn(),
}: {
  open: boolean;
  formHint?: FormDrawerHintConfig;
  onSubmit?: () => void;
}) => {
  const form = useForm<{ name: string }>();
  const { formDrawer } = useFormDrawerWithHook({
    title: 'Add thing',
    testId: 'harness-drawer',
    hookForm: form,
    form: <DocumentedField />,
    formHint,
    open,
    onSubmit,
  });

  return formDrawer;
};

const getHintToggle = () =>
  screen.queryByRole('switch', { name: 'label.show-hint' });

describe('useFormDrawerWithHook', () => {
  it('opens and closes with the open option', async () => {
    const { rerender } = render(<Harness open formHint={{}} />);

    expect(await screen.findByTestId('harness-drawer')).toBeInTheDocument();

    rerender(<Harness formHint={{}} open={false} />);

    await act(async () => {
      jest.runAllTimers();
    });

    expect(screen.queryByTestId('harness-drawer')).not.toBeInTheDocument();
  });

  it('renders the Form Hint column and hides it with Show Hint', async () => {
    render(<Harness open formHint={{}} />);

    await act(async () => {
      fireEvent.focus(await screen.findByLabelText('name'));
    });

    expect(screen.getByText('label.form-hint')).toBeInTheDocument();
    expect(await screen.findByText('Name doc')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(getHintToggle() as HTMLElement);
    });

    expect(screen.queryByText('Name doc')).not.toBeInTheDocument();
  });

  it('animates the drawer width with the hint column, and only with formHint', async () => {
    const getPanel = () =>
      screen.getByLabelText('name').closest('[style*="max-width"]');
    const getAnimated = () =>
      document.querySelectorAll(String.raw`.tw\:transition-\[max-width\]`);

    const { unmount } = render(<Harness open formHint={{}} />);

    await screen.findByLabelText('name');
    await act(async () => {
      jest.runAllTimers();
    });

    expect(getPanel()).toHaveClass('tw:transition-[max-width]');
    expect([...getAnimated()]).toContain(getPanel());

    unmount();
    render(<Harness open />);

    await screen.findByLabelText('name');
    await act(async () => {
      jest.runAllTimers();
    });

    // No formHint means no width to animate: no max-width style either.
    expect(getPanel()).toBeNull();
    expect(getAnimated()).toHaveLength(0);
  });

  it('uses renderDoc for the active field doc', async () => {
    render(
      <Harness
        open
        formHint={{ renderDoc: (markdown) => <p>Custom: {markdown}</p> }}
      />
    );

    await act(async () => {
      fireEvent.focus(await screen.findByLabelText('name'));
    });

    expect(await screen.findByText('Custom: Name doc')).toBeInTheDocument();
  });

  it('hides the hint column and its toggle when the hint is disabled', async () => {
    render(<Harness open formHint={{ enabled: false }} />);

    await act(async () => {
      fireEvent.focus(await screen.findByLabelText('name'));
    });

    expect(getHintToggle()).not.toBeInTheDocument();
    expect(screen.queryByText('Name doc')).not.toBeInTheDocument();
  });

  it('adds no hint column or toggle without formHint', async () => {
    render(<Harness open />);

    expect(await screen.findByLabelText('name')).toBeInTheDocument();
    expect(getHintToggle()).not.toBeInTheDocument();
    expect(screen.queryByText('label.form-hint')).not.toBeInTheDocument();
  });

  it('submits through the form when the footer button is pressed', async () => {
    const onSubmit = jest.fn();
    render(<Harness open formHint={{}} onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.click(await screen.findByTestId('save-btn'));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
