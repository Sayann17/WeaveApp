import { s3, YANDEX_BUCKET } from '../../config/yandex';

export class YandexStorageService {

    /**
     * Загружает фото в Yandex Object Storage
     * @param uri Локальный путь к файлу (file://...)
     * @param folder Папка в бакете (например, 'avatars')
     * @returns Ссылка на загруженный файл
     */
    async uploadImage(uri: string, folder: string = 'uploads'): Promise<string> {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();

            // Convert to ArrayBuffer to ensure correct binary transmission in React Native
            const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (reader.result instanceof ArrayBuffer) {
                        resolve(reader.result);
                    } else {
                        reject(new Error('Failed to convert blob to ArrayBuffer'));
                    }
                };
                reader.onerror = () => reject(new Error('Failed to read blob'));
                reader.readAsArrayBuffer(blob);
            });

            const filename = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

            const params = {
                Bucket: YANDEX_BUCKET,
                Key: filename,
                Body: arrayBuffer,
                ContentType: 'image/jpeg',
                ACL: 'public-read' // 🔥 Force public access
            };

            await s3.upload(params).promise();

            // Формируем публичную ссылку
            // https://storage.yandexcloud.net/bucket-name/folder/filename.jpg
            const publicUrl = `https://storage.yandexcloud.net/${YANDEX_BUCKET}/${filename}`;
            return publicUrl;

        } catch (error) {
            console.error("Yandex Upload Error:", error);
            throw error;
        }
    }

    async deleteImage(imageUrl: string): Promise<void> {
        // Извлекаем Key из URL
        // URL: https://storage.yandexcloud.net/bucket/folder/file.jpg
        // Key: folder/file.jpg
        try {
            const pattern = `https://storage.yandexcloud.net/${YANDEX_BUCKET}/`;
            if (!imageUrl.startsWith(pattern)) return; // Не наш файл

            const key = imageUrl.replace(pattern, '');

            await s3.deleteObject({
                Bucket: YANDEX_BUCKET,
                Key: key
            }).promise();
        } catch (error) {
            console.error("Yandex Delete Error:", error);
        }
    }
}

export const yandexStorage = new YandexStorageService();
