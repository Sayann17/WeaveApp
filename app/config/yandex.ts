import AWS from 'aws-sdk';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Конфигурация Yandex Object Storage
const YANDEX_CONFIG = {
    accessKeyId: process.env.EXPO_PUBLIC_YANDEX_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.EXPO_PUBLIC_YANDEX_SECRET_ACCESS_KEY || '',
    region: 'ru-central1',
    endpoint: 'https://storage.yandexcloud.net',
    bucket: 'photosgarbage'
};

// Инициализация S3 клиента
export const s3 = new AWS.S3({
    accessKeyId: YANDEX_CONFIG.accessKeyId,
    secretAccessKey: YANDEX_CONFIG.secretAccessKey,
    region: YANDEX_CONFIG.region,
    endpoint: YANDEX_CONFIG.endpoint,
    httpOptions: {
        timeout: 10000,
        connectTimeout: 10000
    }
});

export const YANDEX_BUCKET = YANDEX_CONFIG.bucket;
