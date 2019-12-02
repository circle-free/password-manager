export {};

import ManagerContract from "../libs/managerContract";
import { decryptData, deriveKey, encryptData, generateSeed, getAddressFromKey, hash, signDigest } from "../libs/cryptoHelpers";
import Account from "../libs/account";
import { PortToPopup } from "../libs/popupPort";
import { connect, personalSign } from "../libs/metamask";
import { BackgroundState, BackgroundResponse, PopupRequest } from "../libs/constants";
import { getHostFromSender, getDomainFromHost, hexStringToBuffer, bufferToHexString } from "../libs/generalHelpers";

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
};

const state : StateLayout = {
    account: null,
    contract: null,
    contentPorts: {},
};

const conveyState = (popupPort : PortToPopup) => {
    // account never initialized, which means address was never fetched from MetaMask
    if (!state.account) return popupPort.sendState(BackgroundState.NotConnected);

    // got address from metamask, but publics don't exist, so no on-chain account
    if (!state.account.hasPublics) return popupPort.sendState(BackgroundState.NoAccount);

    // account exists, but need to login before we bother checking if we have a root
    if (!state.account.isLoggedIn) return popupPort.sendState(BackgroundState.LoggedOut);

    // account exists and logged in, but need to get root from seed
    if (!state.account.hasRoot) return popupPort.sendState(BackgroundState.NoRoot);

    return popupPort.sendState(BackgroundState.LoggedIn);    // can generate passwords
}

// Popup Handlers
const handlePopupConnection = (port : chrome.runtime.Port) => {
    console.log('DecentPass - Connection open from Popup.');
    const popupPort = new PortToPopup(port);

    popupPort.onRequest(PopupRequest.Connect, () => handleConnectToMetamask(popupPort));
    popupPort.onRequest(PopupRequest.CreateAccount, password => handleCreateAccount(popupPort, password));
    popupPort.onRequest(PopupRequest.Login, password => handleLogin(popupPort, password));
    popupPort.onRequest(PopupRequest.GetRoot, () => handleGetRoot(popupPort));
    popupPort.onRequest(PopupRequest.Logout, () => handleLogout(popupPort));
    popupPort.onRequest(PopupRequest.ClearPrivates, () => handleClearPrivates(popupPort));
    popupPort.onRequest(PopupRequest.ChangePassword, () => handleChangePasswordRequest(popupPort));
    popupPort.onRequest(PopupRequest.UpdatePassword, () => handleUpdatePasswordRequest(popupPort));

    conveyState(popupPort);
};

const handleConnectToMetamask = async (popupPort: PortToPopup) => {
    popupPort.sendState(BackgroundState.Connecting);

    const accountAddress = await connect(web3Provider);

    if (!state.account) state.account = new Account(accountAddress, hash, deriveKey, encryptData, decryptData, signDigest, getAddressFromKey);

    if (!state.contract) state.contract = new ManagerContract(CONTRACT_ADDRESS, provider.getSigner(accountAddress));

    const { encryptedSeed, iv, saltedPassword } = await state.contract.getAccountData(accountAddress);
    await state.account.setPublics(hexStringToBuffer(encryptedSeed), hexStringToBuffer(iv), hexStringToBuffer(saltedPassword));

    conveyState(popupPort);
}

const handleCreateAccount = async (popupPort: PortToPopup, password: string) => {
    popupPort.sendState(BackgroundState.SigningSeed);

    const account = state.account.accountAddress;
    const seed = generateSeed();
    const sig = await personalSign(web3Provider, seed, account);

    // TODO: serialize rsv sig and hash instead of slice
    const root = hexStringToBuffer(sig.r).slice(0, 32);
    state.account.setPassword(password);
    state.account.setRoot(root);
    state.account.setSeed(seed);

    popupPort.sendState(BackgroundState.BroadcastingCreate);
    const createSuccess = await state.contract.createAccount(bufferToHexString(state.account.encryptedSeed), bufferToHexString(state.account.iv), bufferToHexString(state.account.saltedPassword), 0, state.account.signerAddress);

    // TODO: this stuff may not show due to MetaMask stealing focus
    if (!createSuccess) {
        state.account.clearAll();
        popupPort.sendResponse(BackgroundResponse.CreateFailed);
    }

    popupPort.sendResponse(BackgroundResponse.CreateSucceeded)

    conveyState(popupPort);
};

const handleLogin = (popupPort: PortToPopup, password: string) => {
    if (state.account.isLoggedIn) state.account.clearPassword();

    if (!state.account.testPassword(password)) return popupPort.sendState(BackgroundResponse.IncorrectPassword);

    state.account.setPassword(password);

    conveyState(popupPort);
};

const handleGetRoot = async (popupPort: PortToPopup) => {
    if (!state.account.isLoggedIn) return popupPort.sendState(BackgroundState.LoggedOut);

    popupPort.sendState(BackgroundState.SigningSeed);

    const account = state.account.accountAddress;
    const seed = state.account.seed;
    const sig = await personalSign(web3Provider, seed, account);

    // TODO: serialize rsv sig and hash instead of slice
    const root = hexStringToBuffer(sig.r).slice(0, 32);
    state.account.setRoot(root);

    // Left off here, clean the end of this process up
};

const handleLogout = (popupPort: PortToPopup) => {
    state.account.clearPassword();
    conveyState(popupPort);
};

const handleClearPrivates = (popupPort: PortToPopup) => {
    state.account.clearPrivates()
    conveyState(popupPort);
};

const handleChangePasswordRequest = (popupPort: PortToPopup) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs.length === 0) return;

        const tabPorts = state.contentPorts[tabs[0].id];
        const tabPort = tabPorts[tabPorts.length-1];

        tabPort.postMessage({ passwordChangeRequested: true });
        popupPort.sendState(BackgroundState.ChangingPassword);
    });
};

const handleUpdatePasswordRequest = (popupPort: PortToPopup) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs.length === 0) return;

        const tabPorts = state.contentPorts[tabs[0].id];
        const tabPort = tabPorts[tabPorts.length-1];

        tabPort.postMessage({ passwordUpdateRequested: true });
        popupPort.sendState(BackgroundState.BroadcastingUpdate);
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
