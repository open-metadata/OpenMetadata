# MicroStrategy

In this section, we provide guides and references to use the MicroStrategy connector.

You can find further information on the MicroStrategy connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/microstrategy" target="_blank">docs</a>.

## Connection Details

$$section
### Username $(id="username")

Username to connect to MicroStrategy, e.g., `user@organization.com`. This user should have access to relevant dashboards and charts in MicroStrategy to fetch the metadata. Not needed with the Anonymous login mode.
$$

$$section
### Password $(id="password")

Password of the user account to connect with MicroStrategy. Not needed with the Anonymous login mode.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host of the MicroStrategy instance. This should be specified as a URI string in the format http://hostname or https://hostname.

For example, you might set it to https://demo.microstrategy.com. Do not include the Library path; set it under Library Path.
$$

$$section
### Library Path $(id="libraryPath")

Name of the MicroStrategy Library web app on the server. It defaults to `MicroStrategyLibrary`. Change it only when the Library app is deployed under another name, for example `MicroStrategyLibrary2` for a second Library deployment. The connector calls `<Host Port>/<Library Path>/api` and builds dashboard links from `<Host Port>/<Library Path>/app`.
$$

$$section
### Login Mode $(id="loginMode")

Login Mode for Microstrategy's REST API connection. You can authenticate with one of the following authentication modes: `Standard (1)`, `Anonymous (8)`, `LDAP (16)`. Default will be `Standard (1)`.
If you're using demo account for Microstrategy, it will be needed to authenticate through loginMode `8`.
$$

$$section
### Verify SSL $(id="verifySSL")

Client SSL verification. Use `validate` with the CA certificate under SSL Config for a server behind an internal certificate authority, or `ignore` for a self-signed certificate.
$$

$$section
### SSL Config $(id="sslConfig")

Client SSL configuration. Provide the CA certificate that signed the MicroStrategy server certificate.
$$
