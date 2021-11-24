import { useEffect, useState } from 'react';
import AppState from '../AppState';

export const useTour = () => {
  const [isTourOpen, setIsTourOpen] = useState<boolean>();

  useEffect(() => {
    setIsTourOpen(AppState.isTourOpen);
  }, [AppState.isTourOpen]);

  const handleIsTourOpen = (value: boolean) => {
    AppState.isTourOpen = value;
  };

  return {
    isTourOpen,
    handleIsTourOpen,
  };
};
