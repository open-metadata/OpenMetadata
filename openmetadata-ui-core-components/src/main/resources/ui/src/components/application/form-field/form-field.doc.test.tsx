import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { HookForm } from '../../base/form/hook-form';
import { FieldDocProvider, useActiveFieldDoc } from './field-doc-context';
import { getField } from './form-field';
import { FieldTypes } from './form-field.types';

const ActiveProbe = () => {
  const { name } = useActiveFieldDoc();

  return <div data-testid="active">{name ?? 'none'}</div>;
};

const Harness = () => {
  const form = useForm({ defaultValues: { title: '' } });

  return (
    <FieldDocProvider enabled>
      <HookForm form={form}>
        {getField({
          name: 'title',
          label: 'Title',
          type: FieldTypes.TEXT,
          doc: 'about the title',
          id: 'title',
        })}
        <ActiveProbe />
      </HookForm>
    </FieldDocProvider>
  );
};

describe('Field doc registration', () => {
  it('sets the active field when the control is focused', async () => {
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });
    render(<Harness />);

    expect(screen.getByTestId('active')).toHaveTextContent('none');

    await user.click(screen.getByRole('textbox'));

    expect(screen.getByTestId('active')).toHaveTextContent('title');
  });
});
