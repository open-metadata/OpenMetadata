FROM centos:centos7
### This is temporary proxy, you may need to update it
ARG proxy="proxy=http://username:password@ip_address:port_number"

RUN echo $proxy >> /etc/yum.conf

### This is temporary proxy, you may need to update it
ENV http_proxy http://username:password@ip_address:port_number
ENV https_proxy http://username:password@ip_address:port_number
ENV ftp_proxy http://username:password@ip_address:port_number

### This is temporary proxy, you may need to update it
RUN export ftp_proxy=http://username:password@ip_address:port_number
RUN export http_proxy=http://username:password@ip_address:port_number
RUN export https_proxy=http://username:password@ip_address:port_number

RUN (cd /lib/systemd/system/sysinit.target.wants/; for i in *; do [ $i == \
systemd-tmpfiles-setup.service ] || rm -f $i; done); \
rm -f /lib/systemd/system/multi-user.target.wants/*;\
rm -f /etc/systemd/system/*.wants/*;\
rm -f /lib/systemd/system/local-fs.target.wants/*; \
rm -f /lib/systemd/system/sockets.target.wants/*udev*; \
rm -f /lib/systemd/system/sockets.target.wants/*initctl*; \
rm -f /lib/systemd/system/basic.target.wants/*;\
rm -f /lib/systemd/system/anaconda.target.wants/*;

RUN yum -y update && yum -y groupinstall 'Development Tools'
RUN yum -y install epel-release
RUN yum -y update && yum -y install \
        wget \
        libtool \
        autotools-dev \
        libssl-dev \
        zlib-devel \
        autoconf \
        automake \
        tcl \
        cmake \
        openssl-devel \
        git \
        java-1.8.0-openjdk \
        java-1.8.0-openjdk-devel \
        zip \
        unzip \
        gcc \
        gcc-c++ \
        readline-devel \
        zlib-devel \
        bison \
        flex \
        ant \
        postgresql-devel \
        jansson-devel \
        postgresql-libs \
        mod_dav_svn subversion \
        libtool-ltdl-devel \
        python3

RUN adduser pgspider
RUN echo "1" | passwd pgspider --stdin
USER pgspider

RUN wget https://ftp.postgresql.org/pub/source/v15.0/postgresql-15.0.tar.gz -P /tmp/
WORKDIR /home/pgspider
RUN tar -xzvf /tmp/postgresql-15.0.tar.gz

WORKDIR /home/pgspider/postgresql-15.0
RUN chmod u+x configure
RUN mkdir install
RUN ./configure --prefix=$(pwd)/install
RUN make clean && make && make install

RUN chown pgspider /home/pgspider/postgresql-15.0

RUN git config --global http.sslVerify false
WORKDIR /home/pgspider
### this is temporary link, need to update it to clone PGSpider
RUN export no_proxy=github.com && git clone -b master https://github.com/pgspider

WORKDIR /home/pgspider/PGSpider
RUN ./configure --prefix=$(pwd)/install
RUN make clean && make && make install

USER root
### remove redundant source code
RUN rm -rf /tmp/postgresql-15.0.tar.gz

COPY ./*.sh /home/test/
RUN chmod a+x /home/test/*.sh
ENTRYPOINT ["/usr/sbin/init"]
