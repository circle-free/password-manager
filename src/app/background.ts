export {};

import ManagerContract from "../libs/managerContract";
import { decryptData, deriveKey, encryptData, generateSeed, getAddressFromKey, hash, signDigest } from "../libs/cryptoHelpers";
import Account from "../libs/account";
import PopupPort from "../libs/popupPort";
import { getHostFromSender, getDomainFromHost, hexStringToBuffer, bufferToHexString } from "../libs/generalHelpers";

const crypto = require('crypto');
const ethers = require('ethers');
const MetamaskInpageProvider = require('metamask-inpage-provider');
const PortStream = require('extension-port-stream');

const salt = 'DecentPassBackground';

// TESTNET ONLY
const CONTRACT_ADDRESS = '0x9d51Fb82a012a387245dA5fFf0Ded52d319FE675';
const METAMASK_EXTENSION_ID = 'nkbihfbeogaeaoehlefnkodbefgpgknn';
const metamaskPort = chrome.runtime.connect(METAMASK_EXTENSION_ID);
const pluginStream = new PortStream(metamaskPort);
const web3Provider = new MetamaskInpageProvider(pluginStream);
const provider = new ethers.providers.Web3Provider(web3Provider);

interface StateLayout {
    account: Account | null;
    contract: ManagerContract | null;
    contentPorts: object | null;
}

const state : StateLayout = {
    account: null,
    contract: null,
    contentPorts: {},
};


// Popup Handlers
const handlePopupConnection = (port : chrome.runtime.Port) => {
    console.log('DecentPass - Connection open from Popup.');
    const popupPort = new PopupPort(port);

    popupPort.onConnectRequest(() => handleConnect(popupPort));
    popupPort.onCreateRequest(password => handleCreate(popupPort, password));
    popupPort.onLoginRequest(password => handleLogin(popupPort, password));
    popupPort.onLogoutRequest(() => handleLogout(popupPort));
    popupPort.onClearRequest(() => handleClear(popupPort));
    popupPort.onChangePasswordRequest(() => handleChangePasswordRequest(popupPort));
    popupPort.onUpdatePasswordRequest(() => handleUpdatePasswordRequest(popupPort));

    if (!state.account) return popupPort.sendUninitialized();

    if (state.account.isLoggedIn) return popupPort.sendLoggedIn();

    return popupPort.sendLoggedOut();
};

const handleConnect = (popupPort: PopupPort) => {
    popupPort.sendConnecting();

    web3Provider.sendAsync({ method: 'eth_requestAccounts' }, async (err, res) => {
        if (err) return console.log('DecentPass - Failed to request accounts from MetaMask');

        const accountAddress = res.result[0];

        if (!state.account) state.account = new Account(accountAddress, hash, deriveKey, encryptData, decryptData, signDigest, getAddressFromKey);

        if (!state.contract) state.contract = new ManagerContract(CONTRACT_ADDRESS, provider.getSigner(accountAddress));

        const { encryptedSeed, iv, saltedPassword } = await state.contract.getAccountData(accountAddress);
        const loadSuccess = await state.account.setPublics(hexStringToBuffer(encryptedSeed), hexStringToBuffer(iv), hexStringToBuffer(saltedPassword));
        loadSuccess ? popupPort.sendAccountFound() : popupPort.sendNoAccountFound();
    });
}

const handleCreate = (popupPort, password) => {
    popupPort.sendCreating();

    const seed = generateSeed();
    const account = state.account.accountAddress;
    const setPasswordSuccess = state.account.setPassword(password);
    const encryptedSeed = state.account.encrypt(seed, state.account.seedIv);

    web3Provider.sendAsync({ method: 'personal_sign', params: [seed, account], from: account }, async (err, res) => {
        if (err || res.error) console.log('DecentPass - Failed to request signature from MetaMask');
        if (err) return console.error(err);
        if (res.error) return console.error(res.error);

        const sig = res.result;

        // TODO: untested result key
        state.account.setRoot(hexStringToBuffer(sig));

        popupPort.sendBroadcastingCreate();
        const createSuccess = await state.contract.createAccount(bufferToHexString(encryptedSeed), bufferToHexString(state.account.iv), bufferToHexString(state.account.saltedPassword), 0, state.account.signerAddress);

        createSuccess ? popupPort.sendCreateSucceeded() : popupPort.sendCreateFailed();
    });
};

const handleLogin = (popupPort, password) => {
    if (state.account.isLoggedIn) state.account.clearPassword();

    if (!state.account.testPassword(password)) return popupPort.sendIncorrectPassword();

    state.account.setPassword(password);

    popupPort.sendLoggedIn();
};

const handleLogout = popupPort => {
    state.account.clearPassword();
    popupPort.sendLoggedOut();
};

const handleClear = popupPort => {
    state.account.clearPrivates()
    popupPort.sendLoggedOut();
};

const handleChangePasswordRequest = popupPort => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs.length === 0) return;

        const tabPorts = state.contentPorts[tabs[0].id];
        const tabPort = tabPorts[tabPorts.length-1];

        tabPort.postMessage({ passwordChangeRequested: true });
        popupPort.sendChangingPassword();
    });
};

const handleUpdatePasswordRequest = popupPort => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs.length === 0) return;

        const tabPorts = state.contentPorts[tabs[0].id];
        const tabPort = tabPorts[tabPorts.length-1];

        tabPort.postMessage({ passwordUpdateRequested: true });
        popupPort.sendBroadcastingUpdate();
    });
};


// Content Script Handlers
// const handleContentScriptConnection = (contentPort, domain) => {
//     console.log(`DecentPass - Connection open from ${domain} Content Script.`);

//     contentPort.onDisconnect.addListener(() => {
//         state.contentPorts[contentPort.sender.tab.id] = state.contentPorts[contentPort.sender.tab.id].filter(p => p.sender.frameId !== contentPort.sender.frameId);
//     });

//     contentPort.onMessage.addListener(message => {
//         console.log(`DecentPass - Message from ${domain} Content Script.`);

//         const { getSalt, getNewSalt, updateSalt, userDomainSeed, getDomainSeed } = message;

//         if (getDomainSeed) return handleGetDomainSeed(contentPort, domain);

//         if (getSalt && userDomainSeed && state.contract && state.masterPassword) return handleGetSalt(contentPort, userDomainSeed);

//         if (getNewSalt && userDomainSeed && state.contract && state.masterPassword) return handleGetNewSalt(contentPort, userDomainSeed);

//         if (updateSalt && userDomainSeed && state.contract && state.masterPassword) return handleUpdateSalt(userDomainSeed);
//     });

//     state.contentPorts[`${contentPort.sender.tab.id}-${contentPort.sender.frameId}`] = contentPort;

//     if (!state.contentPorts[contentPort.sender.tab.id]) state.contentPorts[contentPort.sender.tab.id] = [];

//     state.contentPorts[contentPort.sender.tab.id].push(contentPort);

//     handleGetDomainSeed(contentPort, domain);
// };

// const handleGetDomainSeed = (contentPort, domain) => {
//     if (!state.masterPassword) return;

//     const domainSeed = getHash([state.masterPassword, state.account, domain, salt]);

//     console.log(`DecentPass - Generated domain Seed for ${domain}`);

//     contentPort.postMessage({ domainSeed });
// };

// const handleGetSalt = (contentPort, userDomainSeed) => {
//     const saltKey = getHash([userDomainSeed, state.masterPassword, salt]);

//     state.contract.getIndex(state.account, saltKey).then(result => {
//         console.log(`DecentPass - Retrieved password index for salt key ${saltKey}`);

//         const currentIndex = result.toNumber();
//         const currentSalt = getHash([currentIndex.toString(), state.masterPassword, salt]);

//         contentPort.postMessage({ userDomainSeed, salt: currentSalt });
//     });
// };

// const handleGetNewSalt = (contentPort, userDomainSeed) => {
//     const saltKey = getHash([userDomainSeed, state.masterPassword, salt]);

//     state.contract.getIndex(state.account, saltKey).then(result => {
//         console.log(`DecentPass - Retrieved password index for salt key ${saltKey}`);

//         const currentIndex = result.toNumber();
//         const newIndex = currentIndex + 1;
//         const currentSalt = getHash([currentIndex.toString(), state.masterPassword, salt]);
//         const newSalt = getHash([newIndex.toString(), state.masterPassword, salt]);

//         contentPort.postMessage({ userDomainSeed, salt: currentSalt, newSalt });
//     });
// };

// const handleUpdateSalt = userDomainSeed => {
//     const saltKey = getHash([userDomainSeed, state.masterPassword, salt]);

//     state.contract.incrementIndex(saltKey).then(tx => {
//         console.log(`DecentPass - Transaction to increment index for salt key ${saltKey} broadcasted. Details follow:`);
//         console.log(tx);
//         return tx.wait();
//     }).then(tx => {
//         console.log(`DecentPass - Transaction to increment index for salt key ${saltKey} mined. Details follow:`);
//         console.log(tx);
//     });
// };


// Global connection listener
chrome.runtime.onConnect.addListener(port => {
    if (!port.sender.tab && port.sender.id === chrome.runtime.id) return handlePopupConnection(port);

    const domain = getDomainFromHost(getHostFromSender(port.sender));

    // if (domain) return handleContentScriptConnection(port, domain);
});
