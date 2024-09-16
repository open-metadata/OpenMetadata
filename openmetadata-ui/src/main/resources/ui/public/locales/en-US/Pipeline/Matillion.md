# Matillion 

In this section, we provide guides and references to use the Matillion connector.

## Requirements:

To extract metadata from Matillion, you need to create a user with the following permissions:

- `API` Permission ( While Creating the User, from Admin -> User )

## Connection Details

$$section
### Host Port $(id="hostPort")
This parameter specifies the network location where your Matillion ETL instance is accessible, combining both the hostname.
It should be formatted as a URI string, either `http://hostname` or `https://hostname`, depending on your security requirements.
$$

$$section
### Username $(id="username")
Username to connect to Matillion. This user should have access to the APIs to extract metadata. Other workflows may require different permissions -- refer to the section above for more information.
$$

$$section
### Password $(id="password")
Password of the user account to connect with Matillion.
$$

$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation.
$$
