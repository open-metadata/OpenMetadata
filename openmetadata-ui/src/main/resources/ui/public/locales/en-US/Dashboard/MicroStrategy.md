# MicroStrategy

In this section, we provide guides and references to use the MicroStrategy connector.

## Connection Details

$$section
### Username $(id="username")

Username to connect to MicroStrategy, e.g., `user@organization.com`. This user should have access to relevant dashboards and charts in MicroStrategy to fetch the metadata.
$$

$$section
### Password $(id="password")

Password of the user account to connect with MicroStrategy.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host of the MicroStrategy instance. This should be specified as a URI string in the format http://hostname or https://hostname.

For example, you might set it to https://demo.microstrategy.com.
$$

$$section
### Login Mode $(id="loginMode")

Login Mode for Microstrategy's REST API connection. You can authenticate with one of the following authentication modes: `Standard (1)`, `Anonymous (8)`. Default will be `Standard (1)`.
If you're using demo account for Microstrategy, it will be needed to authenticate through loginMode `8`.
$$
