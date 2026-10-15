import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
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
