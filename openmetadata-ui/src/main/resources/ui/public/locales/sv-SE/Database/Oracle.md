# Oracle

I det här avsnittet ger vi guider och referenser för att använda Oracle-anslutningen.

## Krav

$$note
För att hämta metadata från en Oracle-databas används biblioteket `python-oracledb`, som ger stöd för versionerna `12c`, `18c`, `19c` och `21c`.
$$

För att mata in metadata från Oracle måste användaren ha följande behörigheter:
- Behörigheten `CREATE SESSION` för användaren.

```sql
-- CREATE USER
CREATE USER user_name IDENTIFIED BY admin_password;

-- CREATE ROLE
CREATE ROLE new_role;

-- GRANT ROLE TO USER 
GRANT new_role TO user_name;

-- GRANT CREATE SESSION PRIVILEGE TO USER
GRANT CREATE SESSION TO new_role;

-- GRANT SELECT CATALOG ROLE PRIVILEGE TO FETCH METADATA TO ROLE / USER
GRANT SELECT_CATALOG_ROLE TO new_role;
```

- `GRANT SELECT` på de relevanta tabeller som ska matas in i OpenMetadata till användaren
```sql
GRANT SELECT ON table_name TO {user | role};
```

### Profilering och datakvalitet
Att köra profileringsarbetsflödet eller datakvalitetstester kräver att användaren har behörigheten `SELECT` på de tabeller/scheman där profileringen/testerna ska köras. Användaren bör också ha rätt att se information i `all_objects` och `all_tables` för alla objekt i databasen. Mer information om hur profileringsarbetsflödet konfigureras finns <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">här</a> och datakvalitetstester <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">här</a>.

### Användning och härkomst
För arbetsflödena för användning och härkomst behöver användaren behörigheten `SELECT`. Du hittar mer information om användningsarbetsflödet <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/usage" target="_blank">här</a> och härkomstarbetsflödet <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/lineage" target="_blank">här</a>.

Du hittar mer information om Oracle-anslutningen i <a href="https://docs.open-metadata.org/connectors/database/oracle" target="_blank">dokumentationen</a>.

## Anslutningsdetaljer

$$section
### Schema $(id="scheme")

**oracle+cx_oracle**: Sqlalchemy-schema för att ansluta till Oracle.
$$

$$section
### Användarnamn $(id="username")

Användarnamn för att ansluta till Oracle. Den här användaren bör ha behörighet att läsa all metadata i Oracle.
$$

$$section
### Lösenord $(id="password")

Lösenord för att ansluta till Oracle.
$$

$$section
### Värd och port $(id="hostPort")

Den här parametern anger värd och port för Oracle-instansen. Den ska anges som en sträng i formatet `hostname:port`. Du kan till exempel sätta parametern hostPort till `localhost:1521`.

Om du kör OpenMetadata-inmatningen i en Docker-container och dina tjänster körs på `localhost`, använd då `host.docker.internal:1521` som värde.
$$

$$section
### Oracle-anslutningstyp $(id="oracleConnectionType")

Anslut till Oracle genom att ange antingen tjänstnamn eller databasschemanamn.

- **Databasschema**: Att använda ett databasschemanamn vid anslutning till en Oracle-databas låter användaren komma åt endast objekten inom det schemat, i stället för hela databasen.
- **Oracle-tjänstnamn**: Oracle-tjänstnamnet är en unik identifierare för en databasinstans eller grupp av instanser som utför en viss funktion.
- **Oracle TNS-anslutning**: Du kan använda TNS-anslutningssträngen direkt, t.ex. `(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1530)))(CONNECT_DATA=(SID=MYSERVICENAME)))`.
$$

$$section
### Oracle-tjänstnamn $(id="oracleServiceName")

Oracle-tjänstnamnet är det TNS-alias som du anger när du fjärransluter till din databas, och detta tjänstnamn registreras i `tnsnames`.
$$

$$section
### Databasschema $(id="databaseSchema")

Namnet på det databasschema i Oracle som du vill ansluta till.
$$

$$section
### Oracle TNS-anslutning $(id="oracleTNSConnection")

TNS-anslutningssträng som du skulle ange i `tnsnames.ora`, t.ex. `(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1530)))(CONNECT_DATA=(SID=MYSERVICENAME)))`.

Observera att om denna anges ignorerar vi egenskapen `hostPort`, så du bör se till att `HOST`-posten finns med här.
$$

$$section
### Katalog för Instant Client $(id="instantClientDirectory")

Den här katalogen används för att ange miljövariabeln `LD_LIBRARY_PATH`. Den krävs om du behöver aktivera tjockt anslutningsläge (thick mode). Som standard levererar vi Instant Client 19 och pekar på `/instantclient`.
$$

$$section
### Bevara skiftläge för identifierare $(id="preserveIdentifierCase")

Styr hur Oracles identifierarnamn (tabeller, kolumner, scheman) lagras i OpenMetadata.

Oracle lagrar ociterade identifierare i VERSALER (t.ex. `CREATE TABLE EMPLOYEES` → `EMPLOYEES` i datakatalogen). Citerade identifierare behåller sitt ursprungliga skiftläge (t.ex. `CREATE TABLE "employees"` → `employees`).

**Inaktiverat (standard):** Identifierare med samma bokstäver men olika skiftläge – såsom ociterat `EMPLOYEES` och citerat `"employees"` – garanteras inte lagras separat och kan kollidera till samma namn.

**Aktiverat:** Namn lagras exakt som Oracle sparar dem, vilket bevarar skillnaden mellan `EMPLOYEES` och `"employees"`.

**När det bör aktiveras:** Om ditt schema innehåller identifierare som delar samma bokstäver men endast skiljer sig i skiftläge (en ociterad VERSAL, en citerad gemen) och du behöver att de behandlas som separata entiteter i OpenMetadata.

**⚠ Migreringsvarning:** Att aktivera detta efter att data redan har matats in med standardinställningen ändrar de lagrade namnen på **alla** befintliga tabeller, kolumner, scheman och constraints. Detta bryter all kopplad metadata – taggar, beskrivningar, härkomst, datakvalitetstester och anpassade egenskaper – på dessa entiteter. Om du måste byta, gör en mjuk borttagning av alla tidigare inmatade entiteter innan du matar in på nytt med den nya inställningen.
$$

$$section
### Använd DBA-tabeller $(id="useDBATable")
Oracle tillhandahåller två uppsättningar metadatatabeller:
- `DBA_TABLES` — innehåller metadata för alla objekt i databasen men kräver DBA-behörighet för att frågas.
- `ALL_TABLES` — innehåller metadata för alla objekt som den aktuella användaren har åtkomst till och kräver inga förhöjda behörigheter.

**Inaktiverat:** Anslutningen använder `ALL_TABLES`, som endast returnerar metadata för objekt som är åtkomliga för den aktuella användaren.
**Aktiverat (standard):** Anslutningen använder `DBA_TABLES` för att hämta metadata för alla databasobjekt. Detta kräver att Oracle-användaren har DBA-behörighet.
$$

$$section
### Databasnamn $(id="databaseName")
I OpenMetadata fungerar hierarkin för databastjänsten enligt följande:
```
Database Service > Database > Schema > Table
```
När det gäller Oracle har vi ingen Database som sådan. Om du vill se dina data i en databas med ett annat namn än `default` kan du ange namnet i det här fältet.

**Obs:** Det rekommenderas att använda samma databasnamn som SID. Detta säkerställer korrekta resultat och korrekt identifiering av tabeller under profilering, datakvalitetskontroller och dbt-arbetsflöde.

$$

$$section
### Anslutningsalternativ $(id="connectionOptions")

Ange detaljerna för eventuella ytterligare anslutningsalternativ som kan skickas till Oracle under anslutningen. Dessa detaljer måste anges som nyckel–värde-par.
$$

$$section
### Anslutningsargument $(id="connectionArguments")

Ange detaljerna för eventuella ytterligare anslutningsargument, såsom säkerhets- eller protokollkonfigurationer, som kan skickas till Oracle under anslutningen. Dessa detaljer måste anges som nyckel–värde-par.
$$

## Exempelkonfiguration för AWS S3-lagring

$$section
### AWS Access Key ID $(id="awsAccessKeyId")

När du interagerar med AWS anger du dina AWS-säkerhetsuppgifter för att verifiera vem du är och om du har behörighet att komma åt de resurser du begär. AWS använder säkerhetsuppgifterna för att autentisera och auktorisera dina begäranden (<a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html" target="_blank">dokumentation</a>).

Åtkomstnycklar består av två delar:
1. Ett åtkomstnyckel-ID (till exempel `AKIAIOSFODNN7EXAMPLE`),
2. Och en hemlig åtkomstnyckel (till exempel `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

Du måste använda både åtkomstnyckel-ID och hemlig åtkomstnyckel tillsammans för att autentisera dina begäranden.

Du hittar mer information om hur du hanterar dina åtkomstnycklar <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html" target="_blank">här</a>
$$

$$section
### AWS Secret Access Key $(id="awsSecretAccessKey")

Hemlig åtkomstnyckel (till exempel `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).
$$

$$section
### AWS Region $(id="awsRegion")

Varje AWS-region är ett separat geografiskt område där AWS samlar datacenter (<a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html" target="_blank">dokumentation</a>).

Eftersom AWS kan ha instanser i flera regioner behöver vi veta vilken region den tjänst du vill nå tillhör.

Observera att AWS-regionen är den enda obligatoriska parametern när du konfigurerar en anslutning. När du ansluter till tjänsterna programmatiskt finns det olika sätt att extrahera och använda resten av AWS-konfigurationerna. Du hittar mer information om hur du konfigurerar dina autentiseringsuppgifter <a href="https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials" target="_blank">här</a>.
$$

$$section
### AWS Session Token $(id="awsSessionToken")

Om du använder tillfälliga autentiseringsuppgifter för att komma åt dina tjänster måste du ange AWS Access Key ID och AWS Secret Access Key. Dessa kommer dessutom att inkludera en AWS Session Token.

Du hittar mer information på <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html" target="_blank">Använda tillfälliga autentiseringsuppgifter med AWS-resurser</a>.
$$

$$section
### Endpoint URL $(id="endPointURL")

För att ansluta programmatiskt till en AWS-tjänst använder du en slutpunkt. En *slutpunkt* är URL:en till ingångspunkten för en AWS-webbtjänst. AWS SDK:er och AWS Command Line Interface (AWS CLI) använder automatiskt standardslutpunkten för varje tjänst i en AWS-region. Men du kan ange en alternativ slutpunkt för dina API-begäranden.

Mer information finns på <a href="https://docs.aws.amazon.com/general/latest/gr/rande.html" target="_blank">AWS-tjänstslutpunkter</a>.
$$

$$section
### Profile Name $(id="profileName")

En namngiven profil är en samling inställningar och autentiseringsuppgifter som du kan tillämpa på ett AWS CLI-kommando. När du anger en profil för att köra ett kommando används inställningarna och autentiseringsuppgifterna för att köra det kommandot. Flera namngivna profiler kan lagras i konfigurations- och autentiseringsfilerna.

Du kan ange det här fältet om du vill använda en annan profil än `default`.

Mer information finns här om <a href="https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html" target="_blank">Namngivna profiler för AWS CLI</a>.
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")

Vanligtvis använder du `AssumeRole` inom ditt konto eller för åtkomst mellan konton. I det här fältet anger du `ARN` (Amazon Resource Name) för det andra kontots policy.

En användare som vill komma åt en roll i ett annat konto måste också ha behörigheter som delegerats från kontoadministratören. Administratören måste koppla en policy som tillåter användaren att anropa `AssumeRole` för rollens `ARN` i det andra kontot.

Det här är ett obligatoriskt fält om du vill använda `AssumeRole`.

Mer information finns på <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html" target="_blank">AssumeRole</a>.
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")

En identifierare för den antagna rollsessionen. Använd rollsessionsnamnet för att unikt identifiera en session när samma roll antas av olika principaler eller av olika skäl.

Som standard använder vi namnet `OpenMetadataSession`.

Mer information finns om <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session." target="_blank">Role Session Name</a>.
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

Källidentiteten som anges av den principal som anropar `AssumeRole`-operationen. Du kan använda information om källidentitet i AWS CloudTrail-loggar för att avgöra vem som utförde åtgärder med en roll.

Mer information finns om <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity" target="_blank">Source Identity</a>.
$$

$$section
### Bucket-namn $(id="bucketName")

Ett bucket-namn i Data Lake är en unik identifierare som används för att organisera och lagra dataobjekt.

Det liknar ett mappnamn, men används för objektlagring snarare än fillagring.
$$

$$section
### Prefix $(id="prefix")

Prefixet för en datakälla avser den första delen av datasökvägen som identifierar datans källa eller ursprung.

Det används för att organisera och kategorisera data inom behållaren och kan hjälpa användare att enkelt hitta och komma åt de data de behöver.
$$

$$section
### Standardfiltermönster för databas $(id="databaseFilterPattern")

Regex för att endast inkludera/exkludera databaser som matchar mönstret.
$$

$$section
### Standardfiltermönster för schema $(id="schemaFilterPattern")

Regex för att endast inkludera/exkludera scheman som matchar mönstret.
$$

$$section
### Standardfiltermönster för tabell $(id="tableFilterPattern")

Regex för att endast inkludera/exkludera tabeller som matchar mönstret.
$$


$$section
### Standardfiltermönster för lagrad procedur $(id="storedProcedureFilterPattern")
Regex för att endast inkludera/exkludera lagrade procedurer som matchar mönstret.
$$
