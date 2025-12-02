FROM php:8.2-fpm

# Install library
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    libpng-dev \
    && docker-php-ext-install pdo pdo_mysql mysqli gd zip

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# --- TAMBAHAN PENTING DISINI ---
# Copy settingan upload agar bisa terima file besar
COPY ./uploads.ini /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/html