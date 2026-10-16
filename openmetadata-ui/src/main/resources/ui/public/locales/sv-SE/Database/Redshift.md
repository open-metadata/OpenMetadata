# Redshift
I det här avsnittet ger vi guider och referenser för att använda Redshift-anslutningen. Du kan se den fullständiga dokumentationen för Redshift <a href="https://docs.open-metadata.org/connectors/database/redshift" target="_blank">här</a>.

## Krav

Redshift-användaren måste bevilja behörigheten `SELECT` på `SVV_TABLE_INFO` för att hämta metadata för tabeller och vyer.

```sql
-- Create a new user
-- More details <a href="https://docs.aws.amazon.com/redshift/latest/dg/r_CREATE_USER.html" target="_blank">https://docs.aws.amazon.com/redshift/latest/dg/r_CREATE_USER.html</a>
CREATE USER test_user with PASSWORD 'password';

-- Grant SELECT on table
GRANT SELECT ON TABLE svv_table_info to test_user;
```

### Profilering och datakvalitet

Att köra profileringsarbetsflödet eller datakvalitetstester kräver att användaren har behörigheten `SELECT` på de tabeller/scheman där profileringen/testerna ska köras. Användaren bör också ha rätt att se information i `SVV_TABLE_INFO` för alla objekt i databasen. Mer information om hur profileringsarbetsflödet konfigureras finns <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">här</a> och datakvalitetstester <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">här</a>.

Information om profilering av **systemmått** finns <a href="https://docs.open-metadata.org/latest/how-to-guides/data-quality-observability/profiler/metrics#redshift" target="_blank">här</a>.

### Användning och härkomst

För arbetsflödena för användning och härkomst behöver användaren behörigheten `SELECT` på:
- vyerna `SVV_TABLE_INFO`, `STL_QUERY`, `STL_QUERYTEXT`, `STL_SCAN` och `SVL_STORED_PROC_CALL` för ett provisionerat kluster
- `SYS_QUERY_HISTORY`, `SYS_QUERY_TEXT`, `SYS_QUERY_DETAIL` och `SYS_PROCEDURE_CALL` för en serverlös instans.
Du hittar mer information om användningsarbetsflödet <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/usage" target="_blank">här</a> och härkomstarbetsflödet <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/lineage" target="_blank">här</a>.

Du hittar mer information om Redshift-anslutningen i <a href="https://docs.open-metadata.org/connectors/database/redshift" target="_blank">dokumentationen</a>.

## Anslutningsdetaljer

$$section
### Schema $(id="scheme")
Schemaalternativ för SQLAlchemy-drivrutinen. Om du är osäker på den här inställningen kan du använda standardvärdet.
$$

$$section
### Användarnamn $(id="username")
Användarnamn för att ansluta till Redshift. Den här användaren bör ha åtkomst till `SVV_TABLE_INFO` för att extrahera metadata. Andra arbetsflöden kan kräva andra behörigheter – se avsnittet ovan för mer information.
$$

$$section
### Lösenord $(id="password")
Lösenord för att ansluta till Redshift.
$$

$$section
### Värd och port $(id="hostPort")
Den här parametern anger värd och port för Redshift-instansen. Den ska anges som en sträng i formatet `hostname:port`. Du kan till exempel sätta parametern hostPort till `localhost:5439`.

Om du kör OpenMetadata-inmatningen i en Docker-container och dina tjänster körs på `localhost`, använd då `host.docker.internal:5439` som värde.
$$

$$section
### Databas $(id="database")

Den första Redshift-databasen att ansluta till. Om du vill mata in alla databaser, sätt `ingestAllDatabases` till true. Detta ska anges som en sträng i formatet `hostname:port`. T.ex. `localhost:5439`, `host.docker.internal:5439`
$$

$$section
### Mata in alla databaser $(id="ingestAllDatabases")
Om kryssrutan är markerad kan arbetsflödet mata in alla databaser i klustret. Om den inte är markerad matar arbetsflödet endast in tabeller från databasen som angetts ovan.
$$

$$section
### SSL-läge $(id="sslMode")
SSL-läge för att ansluta till Redshift-databasen. T.ex. `prefer`, `verify-ca` osv.
$$

$$section
### SSL CA $(id="caCertificate")
CA-certifikatet som används för SSL-validering (`sslrootcert`).
$$
$$note
Redshift behöver endast CA-certifikat
$$
$$section
### Anslutningsalternativ $(id="connectionOptions")
Ytterligare anslutningsalternativ för att bygga URL:en som kan skickas till tjänsten under anslutningen.
$$

$$section
### Anslutningsargument $(id="connectionArguments")
Ytterligare anslutningsargument, såsom säkerhets- eller protokollkonfigurationer, som kan skickas till tjänsten under anslutningen.
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
