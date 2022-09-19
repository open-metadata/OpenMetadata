export const getUserNameAndToken = (searchParam: string) => {
  const searchParams = new URLSearchParams(searchParam);

  if (searchParams) {
    const userName = searchParams.get('user');
    const token = searchParams.get('token');

    return {
      userName,
      token,
    };
  }

  return;
};
