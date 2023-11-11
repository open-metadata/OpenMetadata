# Custom Login Configuration

These are the custom option for application login configuration.

$$note
It might take a few minutes to reflect changes.
$$

Following configuration is needed to allow OpenMetadata to update login configurations.

$$section

### Max Login Fail Attempts $(id="maxLoginFailAttempts")

Failed Login Attempts allowed for user. Default: `3`.
$$

$$section

### Access Block Time $(id="accessBlockTime")

Access Block time for user on exceeding failed attempts(in seconds). Default: `600`.
$$

$$section

### JWT Token Expiry Time $(id="jwtTokenExpiryTime")

Jwt Token Expiry time for login in seconds. Default: `3600`.
$$

