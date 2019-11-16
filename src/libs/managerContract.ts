"use strict";

import * as ethers from 'ethers';
import { removePrefix, addPrefix } from "./generalHelpers";

const abi = [
    "event AccountDataSet(address indexed account)",
    "event DepositMade(address indexed account, uint256 indexed amount, uint256 indexed unlockBlock)",
    "event EarlyBonusFactorSet(address indexed account, uint256 indexed earlyBonusFactor)",
    "event IndexIncremented(address indexed account, bytes32 saltKey)",
    "event NonceUsed(address indexed account, address indexed relayer, uint256 indexed nonce)",
    "event SignerAdded(address indexed account, address indexed signer)",
    "event SignerRemoved(address indexed account, address indexed signer)",
    "event WithdrawalMade(address indexed account, address indexed destination, uint256 indexed amount)",
    "function createAccount(bytes32 encryptedSeed, bytes32 iv, bytes32 saltedPassword, uint256 earlyBonusFactor, address signingAddress) public payable",
    "function deposit() public payable",
    "function addSigner(address signingAddress) public",
    "function removeSigner(address signingAddress) public",
    "function setEarlyBonusFactor(uint256 earlyBonusFactor) public",
    "function withdraw(address payable destination, uint256 amount) public",
    "function incrementIndex(bytes32 saltKey) public",
    "function setAccountData(bytes32 encryptedSeed, bytes32 iv, bytes32 saltedPassword) public",
    "function getRelayNonce(address account, address relayer) public view returns (uint256)",
    "function getIndex(address account, bytes32 saltKey) public view returns (uint256)",
    "function balances(address account) public view returns (uint256)",
    "function earlyBonusFactors(address account) public view returns (uint256)",
    "function encryptedSeeds(address account) public view returns (bytes32)",
    "function delegations(address signer) public view returns (address)",
    "function ivs(address account) public view returns (bytes32)",
    "function saltedPasswords(address account) public view returns (bytes32)",
    "function unlockBlocks(address account) public view returns (uint256)",
    "function getAccountData(address account) public view returns (bytes32 encryptedSeed, bytes32 iv, bytes32 saltedPassword)",
];

const mode = {
    IncrementInex: '0x00',
    SetAccountData: '0x01',
};

export default class ManagerContract {
    private _contract: ethers.Contract;
    private _provider: ethers.providers.Web3Provider;

    public constructor(contractAddress: string, signer: ethers.providers.Web3Provider) {
        if (contractAddress.length !== 42) throw(Error);

        this._provider = signer;
        this._contract = new ethers.Contract(contractAddress, abi, this._provider);
    }

    public async createAccount(encryptedSeed: string, iv: string, saltedPassword: string, earlyBonusFactor: number, signingAddress: string) : Promise<Boolean> {
        encryptedSeed = addPrefix(encryptedSeed);
        iv = addPrefix(iv);
        saltedPassword = addPrefix(saltedPassword);
        signingAddress = addPrefix(signingAddress);

        if (encryptedSeed.length !== 66) throw(Error);
        if (iv.length !== 66) throw(Error);
        if (saltedPassword.length !== 66) throw(Error);
        if (signingAddress.length !== 42) throw(Error);

        // TODO: earlyBonusFactor might be big, and needs to be positive

        const sentTx = await this._contract.createAccount(encryptedSeed, iv, saltedPassword, earlyBonusFactor, signingAddress);
        console.log(`DecentPass - Transaction to create account broadcasted. Details follow:`);
        console.log(sentTx);

        const mineTx = await sentTx.wait();
        console.log(`DecentPass - Transaction to create account mined. Details follow:`);
        console.log(mineTx);

        return true;
    }

    public async addSigner(signingAddress: string) : Promise<Boolean> {
        signingAddress = addPrefix(signingAddress);

        if (signingAddress.length !== 42) throw(Error);

        const sentTx = await this._contract.addSigner(signingAddress);
        console.log(`DecentPass - Transaction to add signer broadcasted. Details follow:`);
        console.log(sentTx);

        const mineTx = await sentTx.wait();
        console.log(`DecentPass - Transaction to add signer mined. Details follow:`);
        console.log(mineTx);

        return true;
    }

    public async removeSigner(signingAddress: string) : Promise<Boolean> {
        signingAddress = addPrefix(signingAddress);

        if (signingAddress.length !== 42) throw(Error);

        const sentTx = await this._contract.removeSigner(signingAddress);
        console.log(`DecentPass - Transaction to remove signer broadcasted. Details follow:`);
        console.log(sentTx);

        const mineTx = await sentTx.wait();
        console.log(`DecentPass - Transaction to remove signer mined. Details follow:`);
        console.log(mineTx);

        return true;
    }

    public async isSignerForAccount(signingAddress: string, accountAddress: string) : Promise<Boolean> {
        signingAddress = addPrefix(signingAddress);
        accountAddress = addPrefix(accountAddress);

        if (signingAddress.length !== 42) throw(Error);
        if (accountAddress.length !== 42) throw(Error);

        const rawResult = await this._contract.delegations(signingAddress);
        console.log(`DecentPass - Retrieved delegation address of signer.`);
        return rawResult.toString().toLowerCase() === accountAddress.toLowerCase();
    }

    public async setEarlyBonusFactor(earlyBonusFactor: number) : Promise<Boolean> {
        // TODO: earlyBonusFactor might be big, and needs to be positive

        const sentTx = await this._contract.setEarlyBonusFactor(earlyBonusFactor);
        console.log(`DecentPass - Transaction to set early bonus factor broadcasted. Details follow:`);
        console.log(sentTx);

        const mineTx = await sentTx.wait();
        console.log(`DecentPass - Transaction to set early bonus factor mined. Details follow:`);
        console.log(mineTx);

        return true;
    }

    public async incrementIndex(saltKey: string) : Promise<Boolean> {
        saltKey = addPrefix(saltKey);

        if (saltKey.length !== 66) throw(Error);

        const sentTx = await this._contract.incrementIndex(saltKey);
        console.log(`DecentPass - Transaction to set increment index broadcasted. Details follow:`);
        console.log(sentTx);

        const mineTx = await sentTx.wait();
        console.log(`DecentPass - Transaction to set increment index mined. Details follow:`);
        console.log(mineTx);

        return true;
    }

    public async setAccountData(encryptedSeed: string, iv: string, saltedPassword: string) : Promise<Boolean> {
        encryptedSeed = addPrefix(encryptedSeed);
        iv = addPrefix(iv);
        saltedPassword = addPrefix(saltedPassword);

        if (encryptedSeed.length !== 66) throw(Error);
        if (iv.length !== 66) throw(Error);
        if (saltedPassword.length !== 66) throw(Error);

        const sentTx = await this._contract.setAccountData(encryptedSeed, iv, saltedPassword);
        console.log(`DecentPass - Transaction to set encrypted seed broadcasted. Details follow:`);
        console.log(sentTx);

        const mineTx = await sentTx.wait();
        console.log(`DecentPass - Transaction to set encrypted seed mined. Details follow:`);
        console.log(mineTx);

        return true;
    }

    public async getRelayNonce(accountAddress: string, relayerAddress: string) : Promise<string> {
        accountAddress = addPrefix(accountAddress);
        relayerAddress = addPrefix(relayerAddress);

        if (accountAddress.length !== 42) throw(Error);
        if (relayerAddress.length !== 42) throw(Error);

        const rawResult = await this._contract.getRelayNonce(accountAddress, relayerAddress);
        console.log(`DecentPass - Retrieved relayer nonce.`);
        return rawResult.toString();
    }

    public async getIndex(accountAddress: string, saltKey: string) : Promise<string> {
        accountAddress = addPrefix(accountAddress);
        saltKey = addPrefix(saltKey);

        if (accountAddress.length !== 42) throw(Error);
        if (saltKey.length !== 66) throw(Error);

        const rawResult = await this._contract.getIndex(accountAddress, saltKey);
        console.log(`DecentPass - Retrieved index.`);
        return rawResult.toString();
    }

    public async getAccountData(accountAddress: string) : Promise<{ encryptedSeed: string, iv: string, saltedPassword: string }> {
        accountAddress = addPrefix(accountAddress);

        if (accountAddress.length !== 42) throw(Error);

        const { encryptedSeed, iv, saltedPassword } = await this._contract.getAccountData(accountAddress);
        console.log(`DecentPass - Retrieved account.`);
        return { encryptedSeed, iv, saltedPassword };        // TODO: determine if this is coming out correct
    }

    public async createRelayableIncrementIndex(accountAddress: string, relayerAddress: string, saltKey: string) : Promise<{ digest: string, params: string, args: string }> {
        accountAddress = addPrefix(accountAddress);
        relayerAddress = addPrefix(relayerAddress);
        saltKey = addPrefix(saltKey);

        if (accountAddress.length !== 42) throw(Error);
        if (relayerAddress.length !== 42) throw(Error);
        if (saltKey.length !== 66) throw(Error);

        const minFee = '0xFFFFFFFF';        // TODO: user this._provider.getGasPrice() to compute fee once we know how much gas this actually takes
        const nonce = this.getRelayNonce(accountAddress, relayerAddress);
        const expiryBlock = (await this._provider.getBlockNumber()) + 20;
        const params = ethers.utils.solidityPack([ 'bytes1', 'address', 'uint256', 'uint256', 'uint256' ], [ mode.IncrementInex, relayerAddress, nonce, minFee, expiryBlock ]);

        const args = ethers.utils.solidityPack([ 'bytes32' ], [ saltKey ]);

        const digest = ethers.utils.solidityKeccak256([ 'bytes', 'bytes' ], [ params, args ]);;

        return { digest, params, args };
    }

    public async createRelayableSetAccountData(accountAddress: string, relayerAddress: string, encryptedSeed: string, iv: string, saltedPassword: string, newSigner: string) : Promise<{ digest: string, params: string, args: string }> {
        accountAddress = addPrefix(accountAddress);
        relayerAddress = addPrefix(relayerAddress);
        encryptedSeed = addPrefix(encryptedSeed);
        iv = addPrefix(iv);
        saltedPassword = addPrefix(saltedPassword);
        newSigner = addPrefix(newSigner);

        if (accountAddress.length !== 42) throw(Error);
        if (relayerAddress.length !== 42) throw(Error);
        if (encryptedSeed.length !== 66) throw(Error);
        if (iv.length !== 66) throw(Error);
        if (saltedPassword.length !== 66) throw(Error);
        if (newSigner.length !== 42) throw(Error);

        const minFee = '0xFFFFFFFF';        // TODO: user this._provider.getGasPrice() to compute fee once we know how much gas this actually takes
        const nonce = this.getRelayNonce(accountAddress, relayerAddress);
        const expiryBlock = (await this._provider.getBlockNumber()) + 20;
        const params = ethers.utils.solidityPack([ 'bytes1', 'address', 'uint256', 'uint256', 'uint256' ], [ mode.SetAccountData, relayerAddress, nonce, minFee, expiryBlock ]);

        const args = ethers.utils.solidityPack([ 'bytes32', 'bytes32', 'bytes32', 'address' ], [ encryptedSeed, iv, saltedPassword, newSigner ]);

        const digest = ethers.utils.solidityKeccak256([ 'bytes', 'bytes' ], [ params, args ]);;

        return { digest, params, args };
    }
}
