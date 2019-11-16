const ethers = require('ethers');
const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
const signer = new ethers.utils.SigningKey(privateKey);

const wallet = new ethers.Wallet(privateKey);
console.log(wallet.address);

const func = '0x02';
const arg = '0x8888888888888888888888888888888888888888888888888888888888888866';
const relayer = '0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c';
const gasprice = 1;
const fee = 60000000000;
const nonce = 1;
const expiry = 100;

const packedDataHash = ethers.utils.solidityKeccak256([ 'bytes1', 'bytes32', 'address', 'uint256', 'uint256', 'uint256', 'uint256' ], [func, arg, relayer, gasprice, fee, nonce, expiry ]);
console.log(signer.signDigest(packedDataHash));


const crypto = require('crypto');

const seed = crypto.randomBytes(32);
console.log(seed);
const key1 = crypto.scryptSync('test', '0xD9A6c05d4681e6D948CB09c625042B5e695627ca', 32);
const algorithm = 'aes-256-cbc';
const iv = Buffer.alloc(16, 0);
const cipher = crypto.createCipheriv(algorithm, key1, iv);
cipher.setAutoPadding(false);
const encrypted = cipher.update(seed, null, 'hex') + cipher.final('hex');
console.log(Buffer.from(encrypted, 'hex'));

const key2 = crypto.scryptSync('mike', '0xD9A6c05d4681e6D948CB09c625042B5e695627ca', 32);
const decipher = crypto.createDecipheriv(algorithm, key1, iv);
decipher.setAutoPadding(false);
const decrypted = decipher.update(encrypted, 'hex', 'hex') + decipher.final('hex');
console.log(Buffer.from(decrypted, 'hex'));

