"use strict";

import * as crypto from 'crypto';

// TODO: revist the interface of this hash function
// TODO: revist if we can reuse hashFunction for digesting for signData
type EncryptFunction = (key: Buffer, data: Buffer, iv: Buffer) => Buffer;
type DecryptFunction = (key: Buffer, encryptedData: Buffer, iv: Buffer) => Buffer;
type HashFunction = (values: any[]) => Buffer;
type KeyDerivationFunction = (password: Buffer, salt: Buffer) => Buffer;
type SignDigestFunction = (key: Buffer, digest: Buffer) => object;
type DeriveAddressFunction = (key: Buffer) => string;

export default class Account {
    private _accountAddress: string;
    private _encryptedRoot: Buffer;
    private _encryptFunction: EncryptFunction;
    private _decryptFunction: DecryptFunction;
    private _deriveAddressFunction: DeriveAddressFunction;
    private _hashFunction: HashFunction;
    private _iv: Buffer;
    private _keyDerivationFunction: KeyDerivationFunction;
    private _password: Buffer;
    private _saltedPassword: Buffer;
    private _signDigestFunction: SignDigestFunction;

    public constructor(accountAddress: string, hashFunction: HashFunction, keyDerivationFunction: KeyDerivationFunction, encryptFunction: EncryptFunction, decryptFunction: DecryptFunction, signDigestFunction: SignDigestFunction, deriveAddressFunction: DeriveAddressFunction) {
        if (accountAddress.length !== 42) throw(Error);

        this._accountAddress = accountAddress;
        this._encryptFunction = encryptFunction;
        this._decryptFunction = decryptFunction;
        this._deriveAddressFunction = deriveAddressFunction;
        this._hashFunction = hashFunction;
        this._keyDerivationFunction = keyDerivationFunction;
        this._signDigestFunction = signDigestFunction;
    }

    public setPassword(password: string) : Boolean {
        if (this._password || this._iv || this._saltedPassword) throw(Error);
        if (!password.length) return false;

        this._password = Buffer.from(password, 'utf8');
        this._iv = crypto.randomBytes(32);

        const passwordSalt = this._hashFunction([this._iv]);
        this._saltedPassword = this._hashFunction([this._password, passwordSalt]);
        return true;
    }

    public setRoot(root: Buffer) : Boolean {
        if (this._encryptedRoot) throw(Error);
        if (root.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(root)) return false;

        this._encryptedRoot = this._encryptFunction(this._key, root, this._iv);
        return true;
    }

    public setEncryptedRoot(encryptedRoot: Buffer) : Boolean {
        if (this._encryptedRoot) throw(Error);
        if (encryptedRoot.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(encryptedRoot)) return false;

        this._encryptedRoot = encryptedRoot;
        return true;
    }

    public setIv(iv: Buffer) : Boolean {
        if (this._iv) throw(Error);
        if (iv.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(iv)) return false;

        this._iv = iv;
        return true;
    }

    public setSaltedPassword(saltedPassword: Buffer) : Boolean {
        if (this._saltedPassword) throw(Error);
        if (saltedPassword.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(saltedPassword)) return false;

        this._saltedPassword = saltedPassword;
        return true;
    }

    public setPublics(encryptedRoot: Buffer, iv: Buffer, saltedPassword: Buffer) : Boolean {
        if (this._encryptedRoot) throw(Error);
        if (encryptedRoot.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(encryptedRoot)) return false;

        if (this._iv) throw(Error);
        if (iv.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(iv)) return false;

        if (this._saltedPassword) throw(Error);
        if (saltedPassword.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(saltedPassword)) return false;

        this._encryptedRoot = encryptedRoot;
        this._iv = iv;
        this._saltedPassword = saltedPassword;
        return true;
    }

    public clearPrivates() {
        this._encryptedRoot = null;
        this._password = null;
    }

    public clearPassword() {
        this._password = null;
    }

    public clearAll() {
        this._encryptedRoot = null;
        this._iv = null;
        this._password = null;
        this._saltedPassword = null;
    }

    public testPassword(password: string) : Boolean {
        if (!this._iv) throw(Error);
        if (!this._saltedPassword) throw(Error);

        const passwordSalt = this._hashFunction([this._iv]);
        return this._hashFunction([Buffer.from(password, 'utf8'), passwordSalt]).equals(this._saltedPassword);
    }

    public encrypt(data: Buffer, iv: Buffer) : Buffer {
        return this._encryptFunction(this._key, data, iv);
    }

    public decrypt(encryptedData: Buffer, iv: Buffer) : Buffer {
        return this._decryptFunction(this._key, encryptedData, iv);
    }

    public signDigest(digest: Buffer) : object {
        return this._signDigestFunction(this._key, digest);
    }

    private get _key() : Buffer {
        if (!this._password) throw(Error);
        if (!this._iv) throw(Error);

        return this._keyDerivationFunction(this._password, this._iv);
    }

    get accountAddress() : string {
        return this._accountAddress;
    }

    get root() : Buffer {
        if (!this._iv) throw(Error);
        if (!this._encryptedRoot) throw(Error);

        const rootIv = this._iv.slice(16, 32);
        return this._decryptFunction(this._key, this._encryptedRoot, rootIv);
    }

    get iv() : Buffer {
        return this._iv;
    }

    get seedIv() : Buffer {
        return this._iv.slice(0, 16);
    }

    get saltedPassword() : Buffer {
        return this._saltedPassword;
    }

    get signerAddress() : string {
        return this._deriveAddressFunction(this._key);
    }

    get isReady() : Boolean {
        return this._encryptedRoot != null && this._iv != null && this._saltedPassword != null;
    }

    get isLoggedIn() : Boolean {
        return !Buffer.alloc(32, 0).equals(this._password);
    }
}
