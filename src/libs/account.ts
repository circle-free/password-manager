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
    private _encryptedSeed: Buffer;
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

    public setPassword(password: string) {
        if (this._password) throw(Error);
        if (!password.length) throw(Error);
        if (this._saltedPassword && !this.testPassword(password)) throw(Error);

        this._password = Buffer.from(password, 'utf8');
        this._iv = crypto.randomBytes(32);

        const passwordSalt = this._hashFunction([this._iv]);
        this._saltedPassword = this._hashFunction([this._password, passwordSalt]);
    }

    public setRoot(root: Buffer) {
        if (this._encryptedRoot) throw(Error);
        if (root.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(root)) throw(Error);

        this._encryptedRoot = this._encryptFunction(this._key, root, this._iv);
    }

    public setSeed(seed: Buffer) {
        if (this._encryptedSeed) throw(Error);
        if (seed.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(seed)) return false;

        this._encryptedSeed = this._encryptFunction(this._key, seed, this._iv);
    }

    public setPublics(encryptedSeed: Buffer, iv: Buffer, saltedPassword: Buffer) {
        if (this._encryptedSeed) throw(Error);
        if (encryptedSeed.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(encryptedSeed)) return false;

        if (this._iv) throw(Error);
        if (iv.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(iv)) return false;

        if (this._saltedPassword) throw(Error);
        if (saltedPassword.length !== 32) throw(Error);
        if (Buffer.alloc(32, 0).equals(saltedPassword)) return false;

        this._encryptedSeed = encryptedSeed;
        this._iv = iv;
        this._saltedPassword = saltedPassword;
    }

    public clearAll() {
        this._encryptedRoot = null;
        this._encryptedSeed = null;
        this._iv = null;
        this._password = null;
        this._saltedPassword = null;
    }

    public clearPrivates() {
        this._encryptedRoot = null;
        this._password = null;
    }

    public clearPassword() {
        this._password = null;
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

    private get _rootIv() : Buffer {
        return this._iv.slice(16, 32);
    }

    private get _seedIv() : Buffer {
        return this._iv.slice(0, 16);
    }

    get accountAddress() : string {
        return this._accountAddress;
    }

    get encryptedRoot() : Buffer {
        return this._encryptedRoot;
    }

    get encryptedSeed() : Buffer {
        return this._encryptedSeed;
    }

    get root() : Buffer {
        if (!this._iv) throw(Error);
        if (!this._encryptedRoot) throw(Error);

        return this._decryptFunction(this._key, this._encryptedRoot, this._rootIv);
    }

    get seed() : Buffer {
        if (!this._iv) throw(Error);
        if (!this._encryptedSeed) throw(Error);

        return this._decryptFunction(this._key, this._encryptedRoot, this._seedIv);
    }

    get iv() : Buffer {
        return this._iv;
    }

    get saltedPassword() : Buffer {
        return this._saltedPassword;
    }

    get signerAddress() : string {
        return this._deriveAddressFunction(this._key);
    }

    get hasPublics() : Boolean {
        return this._encryptedSeed != null && this._iv != null && this._saltedPassword != null;
    }

    get hasRoot() : Boolean {
        return this._encryptedRoot != null;
    }

    get isLoggedIn() : Boolean {
        return !Buffer.alloc(32, 0).equals(this._password);
    }
}
