import { act, render, renderHook } from '@testing-library/react';
import { FieldDocProvider, useActiveFieldDoc, useFieldDocRegistry } from './field-doc-context';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FieldDocProvider enabled>{children}</FieldDocProvider>
);

describe('FieldDocContext', () => {
  it('registers entries and exposes the active one', () => {
    const { result } = renderHook(
      () => ({ reg: useFieldDocRegistry(), active: useActiveFieldDoc() }),
      { wrapper }
    );

    act(() => {
      result.current.reg.register('testType', { label: 'Test Type', doc: 'about test type' });
      result.current.reg.setActive('testType');
    });

    expect(result.current.active.name).toBe('testType');
    expect(result.current.active.entry?.doc).toBe('about test type');
  });

  it('has no active entry after unregister', () => {
    const { result } = renderHook(() => useFieldDocRegistry(), { wrapper });
    act(() => {
      result.current.register('name', { label: 'Name', doc: 'about name' });
      result.current.setActive('name');
      result.current.unregister('name');
    });
    expect(result.current.entries.has('name')).toBe(false);
  });

  it('reports disabled when not enabled', () => {
    const { result } = renderHook(() => useFieldDocRegistry(), {
      wrapper: ({ children }) => <FieldDocProvider>{children}</FieldDocProvider>,
    });
    expect(result.current.enabled).toBe(false);
  });
});
