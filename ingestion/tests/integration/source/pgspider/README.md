# PGSpider Integration Test

A dockerfile has been prepared to execute the integration test for PGSpider connector.

## Proxy setting
If you are working under proxy, it is required to configure proxy setting before starting docker.
### Docker 17.07 and higher
You can set the proxy setting in ~/.docker/config.json.
```
{
 "proxies":
 {
   "default":
   {
     "httpProxy": "http://username:password@ip_address:port_number",
     "httpsProxy": "http://username:password@ip_address:port_number",
     "noProxy": "127.0.0.0/8" 
   }
 }
}
```
### Docker 17.06 and ealier version
You need to set proxy as environment variables within the container. Please modify Dockerfile to set proxy.
```
ARG proxy="proxy=http://username:password@ip_address:port_number" 

RUN echo $proxy >> /etc/yum.conf

ENV http_proxy http://username:password@ip_address:port_number
ENV https_proxy http://username:password@ip_address:port_number
ENV ftp_proxy http://username:password@ip_address:port_number

RUN export ftp_proxy=http://username:password@ip_address:port_number
RUN export http_proxy=http://username:password@ip_address:port_number
RUN export https_proxy=http://username:password@ip_address:port_number

RUN export no_proxy=github.com && git clone -b master https://github.com/pgspider
```
## Starting docker
Please do the following steps to start the docker.
If this is the 1st time that you use this docker, you need to build the docker image first.
```
cd tests
docker build -t pgspider_server .
```
After that, from next time, you only need to start the docker and execute the script.
```
docker-compose up -d
docker exec pgspider_server_for_openmetadata /bin/bash -c 'su -c "/home/test/start_model.sh" pgspider'
```
