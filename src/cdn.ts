import * as Minio from 'minio';

const bucketName = "ifacaccounts"
const endPoint = process.env.CDN_ENDPOINT

if (endPoint == null) {
    throw new Error("CDN_ENDPOINT is not set")
}

const cdnLogin = process.env.CDN_LOGIN

if (cdnLogin == null) {
    throw new Error("CDN_LOGIN is not set")
} else if (cdnLogin.split(':').length != 2) {
    throw new Error("CDN_LOGIN is not in the correct format")
}

const minioClient = new Minio.Client({
    endPoint: endPoint,
    accessKey: cdnLogin.split(':')[0],
    secretKey: cdnLogin.split(':')[1],
    useSSL: false,
    port: 9000 //TODO remove
});


export function uploadUserFile(userId: string, fileId: string, file: Express.Multer.File): string { //Returns URL
    const path = `files/${userId}/${fileId}/${file.originalname}`
    minioClient.putObject(bucketName, path, file.buffer, { "Content-Type": file.mimetype })
    return `https://${endPoint}/${bucketName}/${path}`
}