import { useContext } from 'react';
import ToastContext from '../contexts/ToastContext';

export default function useToastContext() {
  return useContext(ToastContext);
}
