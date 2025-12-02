FROM php:8.2-fpm

# 1. Install System Dependencies & ImageMagick
RUN apt-get update && apt-get install -y \
    libzip-dev zip unzip libpng-dev libjpeg-dev libfreetype6-dev \
    libmagickwand-dev --no-install-recommends \
    ghostscript imagemagick \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_mysql mysqli gd zip

# 2. Install ImageMagick via PECL
RUN pecl install imagick \
    && docker-php-ext-enable imagick

# 3. Fix ImageMagick Policy (Agar boleh baca/tulis PDF)
# PERBAIKAN: Menggunakan 'find' agar tidak peduli folder versinya (ImageMagick-6 atau 7)
RUN find /etc -name "policy.xml" -exec sed -i 's/domain="coder" rights="none" pattern="PDF"/domain="coder" rights="read|write" pattern="PDF"/g' {} +

# 4. Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 5. Copy Config Uploads
# Pastikan file uploads.ini ada di folder yang sama dengan Dockerfile ini
COPY ./uploads.ini /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/html