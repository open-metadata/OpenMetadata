import { ReactNode } from 'react';

export interface ApplicationCardProps {
  logo?: ReactNode;
  title: string;
  description: string;
  linkTitle: string;
  className?: string;
  onClick: () => void;
  appName: string;
}
