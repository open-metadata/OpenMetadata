import moment from 'moment';
import { AuthType, JWTTokenExpiry } from '../generated/entity/teams/user';

export const getJWTTokenExpiryOptions = () => {
  return Object.keys(JWTTokenExpiry).map((expiry) => {
    const expiryValue = JWTTokenExpiry[expiry as keyof typeof JWTTokenExpiry];
    const isHourOption = expiryValue === JWTTokenExpiry.OneHour;

    return {
      label: isHourOption ? '1 hr' : `${expiryValue} days`,
      value: expiryValue,
    };
  });
};

export const getAuthMechanismTypeOptions = () => {
  return Object.keys(AuthType).map((authType) => ({
    label: authType,
    value: AuthType[authType as keyof typeof AuthType],
  }));
};

export const getTokenExpiryText = (expiry: string) => {
  if (expiry === JWTTokenExpiry.Unlimited) {
    return 'The token will never expire!';
  } else if (expiry === JWTTokenExpiry.OneHour) {
    return `The token will expire in ${expiry}`;
  } else {
    return `The token will expire on ${moment()
      .add(expiry, 'days')
      .format('ddd Do MMMM, YYYY')}`;
  }
};
