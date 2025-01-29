# Email Configuration

OpenMetadata is able to send Emails on a various steps like SignUp, Forgot Password , Reset Password, Change Event updates.

Following configuration is needed to allow OpenMetadata to send Emails.

$$section

### Username $(id="username")

Username of the SMTP account.
$$

$$section

### Password $(id="password")

Password to be used with the username to send Emails.
$$

$$section

### Sender Email $(id="senderEmail")

Email of the sender (can be same as `username`, but in Amazon SES this can different)
$$

$$section

### Server Endpoint $(id="serverEndpoint")

Endpoint of the SMTP server (Ex. smtp.gmail.com)
$$

$$section

### SMTP server port $(id="serverPort")

Port of the SMTP Server, this depends on the transportation strategy below.
Following is the mapping between port and the transportation strategy.

**SMTP:**- If SMTP port is 25 use this

**SMTPS:**- If SMTP port is 465 use this

**SMTP_TLS:**- If SMTP port is 587 use this
$$

$$section

### Emailing entity $(id="emailingEntity")

This defines the entity that's sending Email. By default, it's `OpenMetadata`.

If your company name is `JohnDoe` setting it up will update subject line, content line so that mails have `JohnDoe` inplace of `OpenMetadata`.

$$

$$section

### Enable SMTP Server $(id="enableSmtpServer")

True or False , to control whether SMTP configuration is enabled.
$$

$$section

### Support URL $(id="supportUrl")

A support Url link is created in the mails to allow the users to reach in case of issues.

If you have your internal channels / groups this can be updated here.

Default: `https://slack.open-metadata.org`.

$$

$$section

### Transportation strategy $(id="transportationStrategy")

Possible values: `SMTP`, `SMTPS`, `SMTP_TLS`.  Depends as per the `port` above.

$$
