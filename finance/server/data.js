import fs from "fs";
import crypto from "crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Decryption function compatible with encrypt.py
export function decrypt(encryptedData, keyStr) {
  try {
    // Decode the base64 key
    const key = Buffer.from(keyStr, "base64url");

    // Extract IV, ciphertext, and HMAC
    const iv = encryptedData.slice(0, 16);
    const hmacDigest = encryptedData.slice(-32); // SHA256 produces 32 bytes
    const ciphertext = encryptedData.slice(16, -32);

    // Verify HMAC
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(Buffer.concat([iv, ciphertext]));
    const computedHmac = hmac.digest();

    if (!crypto.timingSafeEqual(hmacDigest, computedHmac)) {
      throw new Error(
        "HMAC verification failed: Data may have been tampered with"
      );
    }

    // Decrypt the data
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

export async function s3fetch(s3client, bucket, filename) {
  try {
    console.log(`Fetching ${filename}...`);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: filename,
    });

    const response = await s3client.send(command);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    throw new Error(`Fetch failed "${filename}": ${error.message}`);
  }
}

export function readLocal(dataFile) {
  console.log(`Reading ${dataFile}`);
  const sqlitePath = path.resolve(__dirname, dataFile);
  return fs.readFileSync(sqlitePath);
}
