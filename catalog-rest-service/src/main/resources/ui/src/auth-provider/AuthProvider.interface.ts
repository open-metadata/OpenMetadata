import { ComponentType, ReactNode } from 'react';

export interface AuthProviderProps {
  childComponentType: ComponentType;
  children?: ReactNode;
}

export type UserProfile = {
  email: string;
  name: string;
  picture: string;
  locale: string;
};

export type OidcUser = {
  id_token: string;
  scope: string;
  profile: UserProfile;
};
