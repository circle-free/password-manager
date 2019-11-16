"use strict";

import * as ethers from 'ethers';
import * as crypto from 'crypto';
import { pbkdf2 } from 'ethers/utils/pbkdf2';
import { removePrefix } from "./generalHelpers";

export function decryptData(key: Buffer, encryptedData: Buffer, iv: Buffer) : Buffer {
    if (key.length != 32) throw(Error);
    if (iv.length != 16) throw(Error);

    const algorithm = 'aes-256-cbc';
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

export function encryptData(key: Buffer, data: Buffer, iv: Buffer) : Buffer {
    if (key.length != 32) throw(Error);
    if (iv.length != 16) throw(Error);

    const algorithm = 'aes-256-cbc';
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(data), cipher.final()]);
}

export function generateSeed() : Buffer {
    return crypto.randomBytes(32);
}

export function getAddressFromKey(key: Buffer) : string {
    return (new ethers.Wallet(key)).address;
}

export function hash(values: any[]) : Buffer {
    const items = values.map(value => {
        if (Buffer.isBuffer(value)) return value;

        if (value.startsWith('0x')) return Buffer.from(removePrefix(value), 'hex');

        return Buffer.from(value, 'utf8');
    });

    const hexStringOrArrayish = Buffer.concat(items);
    return Buffer.from(removePrefix(ethers.utils.sha256(hexStringOrArrayish)), 'hex');
}

export function signDigest(key: Buffer, digest: Buffer) : ethers.utils.Signature {
    return (new ethers.utils.SigningKey(key)).signDigest(digest);
}

export function deriveKey(password: Buffer, salt: Buffer) : Buffer {
    return Buffer.from(pbkdf2(password, salt, 1024, 64, 'sha512'));
}