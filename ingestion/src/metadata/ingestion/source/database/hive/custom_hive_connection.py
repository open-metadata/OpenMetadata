import contextlib
import getpass
import ssl

import thrift.protocol.TBinaryProtocol
import thrift.transport.TSocket
import thrift.transport.TTransport
from pyhive.hive import Connection as BaseConnection
from pyhive.hive import _check_status, get_installed_sasl
from TCLIService import TCLIService, ttypes


class CustomHiveConnection(BaseConnection):
    """Custom Hive connection that integrates puretransport and SSL certificate support"""

    def __init__(
        self,
        host=None,
        port=None,
        scheme=None,
        username=None,
        database="default",
        auth=None,
        configuration=None,
        kerberos_service_name=None,
        password=None,
        check_hostname=None,
        ssl_cert=None,
        thrift_transport=None,
        use_ssl=False,
        ssl_certfile=None,
        ssl_keyfile=None,
        ssl_ca_certs=None,
        ssl_cert_reqs=None,
        ssl_check_hostname=None,
    ):
        """Connect to HiveServer2 with integrated puretransport and SSL support"""

        # Handle HTTPS scheme with SSL context
        if scheme in ("https", "http") and thrift_transport is None:
            port = port or 1000
            ssl_context = None
            if scheme == "https":
                from ssl import create_default_context

                ssl_context = create_default_context()
                ssl_context.check_hostname = check_hostname == "true"
                ssl_cert = ssl_cert or "none"
                ssl_cert_parameter_map = {
                    "none": 0,  # CERT_NONE
                    "optional": 1,  # CERT_OPTIONAL
                    "required": 2,  # CERT_REQUIRED
                }
                ssl_context.verify_mode = ssl_cert_parameter_map.get(ssl_cert, 0)
            thrift_transport = thrift.transport.THttpClient.THttpClient(
                uri_or_host="{scheme}://{host}:{port}/cliservice/".format(
                    scheme=scheme, host=host, port=port
                ),
                ssl_context=ssl_context,
            )

            if auth in ("BASIC", "NOSASL", "NONE", None):
                # Always needs the Authorization header
                self._set_authorization_header(thrift_transport, username, password)
            elif auth == "KERBEROS" and kerberos_service_name:
                self._set_kerberos_header(thrift_transport, kerberos_service_name, host)
            else:
                raise ValueError(
                    "Authentication is not valid use one of:"
                    "BASIC, NOSASL, KERBEROS, NONE"
                )
            host, port, auth, kerberos_service_name, password = (
                None,
                None,
                None,
                None,
                None,
            )

        username = username or getpass.getuser()
        configuration = configuration or {}

        if (password is not None) != (auth in ("LDAP", "CUSTOM")):
            raise ValueError(
                "Password should be set if and only if in LDAP or CUSTOM mode; "
                "Remove password or use one of those modes"
            )
        if (kerberos_service_name is not None) != (auth == "KERBEROS"):
            raise ValueError(
                "kerberos_service_name should be set if and only if in KERBEROS mode"
            )

        # Use puretransport if SSL is enabled or if thrift_transport is provided
        if use_ssl or thrift_transport is not None:
            if thrift_transport is not None:
                # Use provided thrift_transport
                self._transport = thrift_transport
            else:
                # Create puretransport with SSL
                import puretransport

                # Prepare socket_kwargs for SSL
                socket_kwargs = {}
                if ssl_certfile:
                    socket_kwargs["certfile"] = ssl_certfile
                if ssl_keyfile:
                    socket_kwargs["keyfile"] = ssl_keyfile
                if ssl_ca_certs:
                    socket_kwargs["ca_certs"] = ssl_ca_certs
                if ssl_cert_reqs is not None:
                    socket_kwargs["cert_reqs"] = ssl_cert_reqs
                elif use_ssl:
                    socket_kwargs["cert_reqs"] = ssl.CERT_NONE

                # Create puretransport
                self._transport = puretransport.transport_factory(
                    host=host or "localhost",
                    port=port or 10000,
                    username=username,
                    password=password or username,
                    use_ssl=use_ssl,
                    socket_kwargs=socket_kwargs if socket_kwargs else None,
                )
        else:
            # Use standard connection logic
            if port is None:
                port = 10000
            if auth is None:
                auth = "NONE"
            socket = thrift.transport.TSocket.TSocket(host, port)
            if auth == "NOSASL":
                # NOSASL corresponds to hive.server2.authentication=NOSASL in hive-site.xml
                self._transport = thrift.transport.TTransport.TBufferedTransport(socket)
            elif auth in ("LDAP", "KERBEROS", "NONE", "CUSTOM"):
                # Defer import so package dependency is optional
                import thrift_sasl

                if auth == "KERBEROS":
                    # KERBEROS mode in hive.server2.authentication is GSSAPI in sasl library
                    sasl_auth = "GSSAPI"
                else:
                    sasl_auth = "PLAIN"
                    if password is None:
                        # Password doesn't matter in NONE mode, just needs to be nonempty.
                        password = "x"

                self._transport = thrift_sasl.TSaslClientTransport(
                    lambda: get_installed_sasl(
                        host=host,
                        sasl_auth=sasl_auth,
                        service=kerberos_service_name,
                        username=username,
                        password=password,
                    ),
                    sasl_auth,
                    socket,
                )
            else:
                # All HS2 config options:
                # https://cwiki.apache.org/confluence/display/Hive/Setting+Up+HiveServer2#SettingUpHiveServer2-Configuration
                # PAM currently left to end user via thrift_transport option.
                raise NotImplementedError(
                    "Only NONE, NOSASL, LDAP, KERBEROS, CUSTOM "
                    "authentication are supported, got {}".format(auth)
                )

        protocol = thrift.protocol.TBinaryProtocol.TBinaryProtocol(self._transport)
        self._client = TCLIService.Client(protocol)
        # oldest version that still contains features we care about
        # "V6 uses binary type for binary payload (was string) and uses columnar result set"
        protocol_version = ttypes.TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V6

        try:
            self._transport.open()
            open_session_req = ttypes.TOpenSessionReq(
                client_protocol=protocol_version,
                configuration=configuration,
                username=username,
            )
            response = self._client.OpenSession(open_session_req)
            _check_status(response)
            assert (
                response.sessionHandle is not None
            ), "Expected a session from OpenSession"
            self._sessionHandle = response.sessionHandle
            assert (
                response.serverProtocolVersion == protocol_version
            ), "Unable to handle protocol version {}".format(
                response.serverProtocolVersion
            )
            with contextlib.closing(self.cursor()) as cursor:
                cursor.execute("USE `{}`".format(database))
        except:
            self._transport.close()
            raise
