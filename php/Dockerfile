FROM php:8.2-fpm

# 1. Install System Dependencies (Added libwebp-dev and configured GD with webp)
RUN apt-get update && apt-get install -y \
    libzip-dev zip unzip libpng-dev libjpeg-dev libfreetype6-dev \
    libmagickwand-dev libwebp-dev --no-install-recommends \
    ghostscript imagemagick \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install pdo pdo_mysql mysqli gd zip

# 2. Install ImageMagick via PECL
RUN pecl install imagick \
    && docker-php-ext-enable imagick

# 3. Fix ImageMagick Policy
RUN find /etc -name "policy.xml" -exec sed -i 's/domain="coder" rights="none" pattern="PDF"/domain="coder" rights="read|write" pattern="PDF"/g' {} +

# 4. Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 5. Copy Config Uploads
COPY ./uploads.ini /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/html