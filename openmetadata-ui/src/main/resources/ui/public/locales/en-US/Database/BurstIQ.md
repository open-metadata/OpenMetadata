# BurstIQ
In this section, we provide guides and references to use the BurstIQ connector.

## Requirements

To extract metadata from BurstIQ LifeGraph, the user used in the connection needs to have privileges to read all the metadata in BurstIQ LifeGraph.

You can find further information on the BurstIQ connector in the <a href="https://docs.open-metadata.org/connectors/database/burstiq" target="_blank">docs</a>.

## Connection Details

$$section
### Username $(id="username")
Username to connect to BurstIQ. This user should have privileges to read all the metadata in BurstIQ LifeGraph.
$$

$$section
### Password $(id="password")
Password to connect to BurstIQ.
$$

$$section
### Realm Name $(id="realmName")
BurstIQ Keycloak realm name (e.g., 'ems' from https://auth.burstiq.com/realms/ems).
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")
Regex to only include/exclude dictionaries (tables) that matches the pattern.
$$
