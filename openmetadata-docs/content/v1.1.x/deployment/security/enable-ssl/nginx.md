---
title: Enable SSL with Nginx
slug: /deployment/security/enable-ssl/nginx
---

# Enable SSL with Nginx

Nginx can be used as a load balancer or an SSL termination point for OpenMetadata.

In this section, we will look at how to use Nginx and Certbot to deploy SSL. The below instructions are for Ubuntu 20 
and any other flavor of Linux please find similar instructions.

## Install Nginx

Nginx can be installed to a completely different host where you are running OpenMetadata Server or on the same host. 
For simplicity, we will do this on the same host as the OpenMetadata server.

```commandline
sudo apt update
sudo apt install nginx
sudo systemctl start nginx
```

## Configure Nginx to redirect requests to OpenMetadata

For Nginx to serve this content, it’s necessary to create a server block with the correct directives. 
Instead of modifying the default configuration file directly, let’s make a new one at `/etc/nginx/sites-available/openmetadata`:

```commandline
sudo vi /etc/nginx/sites-available/openmetadata
```

And add the below content

```commandline
server {
        access_log /var/log/nginx/sandbox-access.log;
        error_log /var/log/nginx/sandbox-error.log;         
        server_name sandbox.open-metadata.org;
        location / {
          proxy_pass http://127.0.0.1:8585;
        }
}
```

In the above configuration, please ensure that the `server_name` matches the domain where you are hosting the OpenMetadata 
server. Also, the `proxy_pass` configuration should point to the OpenMetadata server port.

Then, link the configuration to `sites-enabled` and restart nginx:

```commandline
sudo ln -s /etc/nginx/sites-available/openmetadata /etc/nginx/sites-enabled/openmetadata
sudo systemctl restart nginx
```

The above configuration will serve at port 80, so if you configured a domain like `sandbox.open-metadata.org` one can 
start accessing OpenMetadata server by just pointing the browser to [http://sandbox.open-metadata.org](http://sandbox.open-metadata.org).

## Enable SSL using Certbot

Certbot, [https://certbot.eff.org/](https://certbot.eff.org/), is a non-profit org that distributes the certified X509 
certs and renews them as well.

```commandline
sudo apt install certbot python3-certbot-nginx
sudo systemctl reload nginx
```

## Obtaining an SSL Certificate

Certbot provides a variety of ways to obtain SSL certificates through plugins. The Nginx plugin will take care of
reconfiguring Nginx and reloading the config whenever necessary. To use this plugin, type the following:

```commandline
sudo certbot --nginx -d sandbox.open-metadata.org 
```

Replace` sandbox.open-metadata.org` with your domain for OpenMetadata. 

If this is your first time running certbot, you will be prompted to enter an email address and agree to the terms of 
service. After doing so, certbot will communicate with the `Let's Encrypt` server, then run a challenge to verify that
you control the domain you’re requesting a certificate for.

If that’s successful, certbot will ask how you’d like to configure your HTTPS settings.

## Verifying Certbot Auto-Renewal

`Let's Encrypt`'s certificates are only valid for ninety days. This is to encourage users to automate their certificate
renewal process. The certbot package we installed takes care of this for us by adding a `systemd` timer that will run 
twice a day and automatically renew any certificate that’s within thirty days of expiration.

You can query the status of the timer with `systemctl`:
```commandline
sudo systemctl status certbot.timer
```

to renew, you can run the following command

```commandline
sudo certbot renew --dry-run
```

## Summary

In this tutorial, we walked through the setup of Nginx to serve the requests to OpenMetadata and used Certbot to enable
SSL on Nginx. 

Do keep in mind that we secured the external connection to Nginx, and Nginx terminates the SSL connections, 
and the rest of the transport Nginx to the OpenMetadata server is on Plaintext. However, OpenMetadata server should be 
configured to listen to only localhost requests, i.e., It cannot be reached directly from outside traffic except for 
Nginx on that host. This makes it a secure SSL.
