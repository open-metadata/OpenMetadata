---
title: SAML XML File
slug: /deployment/security/saml/xml_file
collate: false
---

Here is the example XML code file to understand how to add certificate for SAML

```xml
<?xml version="1.0" encoding="UTF-8"?><md: EntityDescriptor xmlns:md="urn:oasis: names: tc:SAML:2.0:metadata" entityID="https://portal.sso.us-west-2.amazonaws. com/saml/assertion/MjQxMj IWNDQ50TgzX2lucy00M2JkYmI5NzEwMmJiN2Jm">
    <md: IDPSSODescriptor WantAuthnRequestsSigned="false"protocolSupportEnumeration="urn: oasis: names: tc: SAML: 2.0:protocol">
        <md:KeyDescriptor use="signing">
            <ds: KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
                <ds: X509Data>
                    ‹ds: X509Certificate>MIIDAzCCAeugAwIBAgIBATANBgkqhkiG9w0BAQsFADBFMRYwFAYDVQQDDA1hbWF6b25hd3MuY29tMQOwCwYDVQQLDARJREFTMQ8wDQYDVQQKDAZBbWF6b24×CzAJBgNVBAYTALV1MB4XDTIyMDYyNDA5MjY00VoXDTIЗMDYyNDA5MjY00VowRTEWMBQGA1UEAwwNYW1hem9uYXdzLmNvbTENMAsGA1UECwwESURBUzEPMA0GA1UECgwGQW1hem9uMQswCQYDVQQGEwJVUZCCASIWDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANakdytrWP1bEC/Wh1lufRx9eiсTcXkQRjZpхg95HdkBеMqhNTMcQ5ASIa2vSiRDBsiyHKJVwF4yQCcICIV0il2b[pCSMmrLZGMXzVswPWEjDRY0JiZoNoRIaxuiBdbyZTC20qeGPGZvXm4LTi4rMwr38VaJTDEKKu/nOBNbtL24dn4HZGvNv+wDrU2ae/5FEjhDcXeuhS7N/vWO/jRkGlgLu6YjgQ20umK8qcVj8n6Huaz33FQJl7oxS+XkbDXShcGKefBjiKItaqoNbJaG3anCxdxbrjh9ZYhZ338U/jypWfR0RKxxd3gDH3NPUBcPwWiUIsQUBdlQIcYZyyI/UNMCAwEAATANBgkqhkiG9w0BAQsFAA0CAQEARAXeDrw40SJY6pmpvWCxpjX92SEJ2cZOMMI7FaUDIBHP3W44wYZTzud9CqJNHh8iX/5uqFkxv/QTaEYvmRЗX71Jb9poNkGBz+SBЗqUaEYih3Cr9nGYchiPVySSPkYхAlQlMUW+38EhWYT8ZpDuUbRmCC3AGAUPZkfhyWCf00uGcQGfvweETTYUJEwxHixk/09BCCDzNXzVhEmKwgjLoipqwNJHYPDJs5V9zfGubRYKAdMqx9GMK+jpfwRj/tNzehoswmRNoKJ8jGDiCnZ1rHFЗINеcXX01pdvgFT517WPsrWN/gXj8abd4PEq0LjsE8avuBK1Ns1jMj5w90wXdЗLkw==
                    </ds: X509Certificate>
                </ds: X509Data>
            </ds: KeyInfo>
        </md:KeyDescriptor>
        <md :SingleLogoutService Binding="urn:oasis: names: tc: SAML:2.0:bindings:HTTP-POST" Location="https://portal.sso.us-west-2.amazonaws.com/saml/logout/MjOXMjIWNDQ50TgzX2lucy00M2JKYmI5NZEWMmJiN2Jm"/>
        <md: SingleLogoutService Binding="urn:oasis:names: tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://portal.sso.us-west-2.amazonaws.com/saml/logout/MjQxMj IwNDQ50TgzX2lucy00M2JkYmI5NzEwMmJ iN2Jm"/>
        <md: NameIDFormat>urn: oasis: names: tc: SAML:1.1: nameid-format: emailAddress</md:NameIDFormat>
        <md :SingleSignOnService Binding="urn:oasis:names: tc:SAML:2.0:bindings:HTTP-POST" Location="https://portal.sso.us-west-2.amazonaws.com/saml/assertion/MjQxMjIwNDQ50TgzX2lucy00M2JkYmI5NzEwMmJiN2Jm"/>
        <md:SingleSignOnService Binding="urn:oasis:names: tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://portal.sso.us-west-2.amazonaws.com/saml/assertion/MjQxMj IwNDQ50TgzX2lucy00M2JkYmI5NzEwMmJiN2Jm"/>
    </md: IDPSSODescriptor>
</md: EntityDescriptor>
```
