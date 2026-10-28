import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { useFieldDoc } from '../../application/form-field/field-doc-context';
import { Input } from '../input/input';
import { FormField, HookForm } from './hook-form';

const RequiredNameForm = ({ onSubmit }: { onSubmit: () => void }) => {
  const form = useForm({ defaultValues: { name: '' } });

  return (
    <HookForm form={form} onSubmit={form.handleSubmit(onSubmit)}>
      <FormField
        control={form.control}
        name="name"
        rules={{ required: 'Name is required' }}>
        {({ field, fieldState }) => (
          <Input
            isRequired
            hint={fieldState.error?.message}
            isInvalid={fieldState.invalid}
            label="Name"
            value={field.value}
            onChange={field.onChange}
          />
        )}
      </FormField>
      <button type="submit">Save</button>
    </HookForm>
  );
};

describe('HookForm', () => {
  it('lets react-hook-form report a required field instead of native validation', async () => {
    const onSubmit = vi.fn();
    render(<RequiredNameForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

const DocumentedNameForm = () => {
  const form = useForm();
  const DocumentedField = () => {
    const fieldDoc = useFieldDoc({ name: 'name', label: 'Name', doc: 'Docs' });

    return (
      <div {...fieldDoc}>
        <input aria-label="Name" />
      </div>
    );
  };

  return (
    <HookForm showFieldDocs fieldDocVariant="muted" form={form}>
      <DocumentedField />
    </HookForm>
  );
};

describe('HookForm field docs', () => {
  it('forwards fieldDocVariant to the doc popover', async () => {
    render(<DocumentedNameForm />);

    await userEvent.click(screen.getByLabelText('Name'));

    expect((await screen.findByRole('note')).parentElement).toHaveClass(
      'tw:bg-primary_alt'
    );
  });
});
