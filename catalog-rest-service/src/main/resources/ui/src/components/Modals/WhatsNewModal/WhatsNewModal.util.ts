export const getReleaseVersionExpiry = () => {
  return new Date(Date.now() + 60 * 60 * 24 * 31 * 1000);
};
