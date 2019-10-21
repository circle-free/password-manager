export {};

const salt = 'DecentPassBackground';

// TESTNET ONLY
const contractAddress = '0xbd36ED3aB5b7e0e7D03e2482C5AC7c9aCc7df3D1';

const ethers = require('ethers');
const MetamaskInpageProvider = require('metamask-inpage-provider');
const PortStream = require('extension-port-stream');

const METAMASK_EXTENSION_ID = 'lfmhpaolnobblncaglcodfjkmpoanpml';
const metamaskPort = chrome.runtime.connect(METAMASK_EXTENSION_ID);
const pluginStream = new PortStream(metamaskPort);
const web3Provider = new MetamaskInpageProvider(pluginStream);
const provider = new ethers.providers.Web3Provider(web3Provider);

const abi = [
    "function incrementIndex(bytes32 saltKey)",
    "function getIndex(address account, bytes32 saltKey) view returns (uint256)"
];

const state = { account: null, signer: null, contract: null, contentPorts: {}, masterPassword: null, saltedPassword: null };

const getHostFromSender = sender => (new URL(sender.url)).host == (new URL(sender.tab.url)).host ? (new URL(sender.url)).host : null;

const getDomainFromHost = host => host && (host.match(/\./g) || []).length ? host.slice(host.indexOf('.') + 1) : host;

const getHash = values => ethers.utils.id(values.join(''));

chrome.storage.sync.get(['saltedPassword'], result => {
    if (!result.key) return;

    state.saltedPassword = result.key;
    console.log(`DecentPass - Retrieved sync storage salted master password ${result.key}`);
});

web3Provider.sendAsync({ method: 'eth_requestAccounts' }, async (err, res) => {
    if (err) return console.log('DecentPass - Failed to request accounts from MetaMask');

    state.account = res.result[0];
    state.signer = provider.getSigner(state.account);
    state.contract = new ethers.Contract(contractAddress, abi, state.signer);
});

const sendDomainSeed = (port, domain) => {
    if (!state.masterPassword) return;

    const domainSeed = getHash([state.masterPassword, state.account, domain, salt]);

    console.log(`DecentPass - Generated domain Seed for ${domain}`);

    port.postMessage({ domainSeed });
}

const handlePopupConnection = port => {
    console.log('DecentPass - Connection open from Popup.');

    port.onMessage.addListener(message => {
        console.log('DecentPass - Message from Popup.');

        const { changePasswordRequest, password, endSession, updatePasswordRequest } = message;

        if (changePasswordRequest) {
            return chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                if (tabs.length === 0) return;

                const tabPorts = state.contentPorts[tabs[0].id];
                const tabPort = tabPorts[tabPorts.length-1];

                tabPort.postMessage({ passwordChangeRequested: true });
                port.postMessage({ changing: true });
            });
        }

        if (updatePasswordRequest) {
            return chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                if (tabs.length === 0) return;

                const tabPorts = state.contentPorts[tabs[0].id];
                const tabPort = tabPorts[tabPorts.length-1];

                tabPort.postMessage({ passwordUpdateRequested: true });
                port.postMessage({ transacting: true });
            });
        }

        if (password) {
            const saltedPassword = getHash([password, state.account, salt]);

            if (state.saltedPassword && saltedPassword !== state.saltedPassword) return port.postMessage({ incorrectPassword: true });

            chrome.storage.sync.set({ saltedPassword }, () => {
                console.log(`DecentPass - Set sync storage salted master password to ${saltedPassword}`);

                state.masterPassword = password;
                state.saltedPassword = saltedPassword;

                port.postMessage({ active: true, newUser: false });
            });
        }

        if (endSession) {
            state.masterPassword = null;
            port.postMessage({ active: false, newUser: false });
        }
    });

    port.postMessage({ active: !!state.masterPassword, newUser: !state.saltedPassword });
};

const handleContentScriptConnection = (port, domain) => {
    console.log(`DecentPass - Connection open from ${domain} Content Script.`);

    port.onDisconnect.addListener(() => {
        state.contentPorts[port.sender.tab.id] = state.contentPorts[port.sender.tab.id].filter(p => p.sender.frameId !== port.sender.frameId);
    });

    port.onMessage.addListener(message => {
        console.log(`DecentPass - Message from ${domain} Content Script.`);

        const { getSalt, getNewSalt, updateSalt, userDomainSeed, getDomainSeed } = message;

        if (getDomainSeed) return sendDomainSeed(port, domain);

        if (getSalt && userDomainSeed && state.contract && state.masterPassword) {
            const saltKey = getHash([userDomainSeed, state.masterPassword, salt]);

            return state.contract.getIndex(state.account, saltKey).then(result => {
                console.log(`DecentPass - Retrieved password index for ${domain} with salt key ${saltKey}`);

                const currentIndex = result.toNumber();
                const currentSalt = getHash([currentIndex.toString(), state.masterPassword, salt]);

                return port.postMessage({ userDomainSeed, salt: currentSalt });
            });
        }

        if (getNewSalt && userDomainSeed && state.contract && state.masterPassword) {
            const saltKey = getHash([userDomainSeed, state.masterPassword, salt]);

            return state.contract.getIndex(state.account, saltKey).then(result => {
                console.log(`DecentPass - Retrieved password index for ${domain} with salt key ${saltKey}`);

                const currentIndex = result.toNumber();
                const newIndex = currentIndex + 1;
                const currentSalt = getHash([currentIndex.toString(), state.masterPassword, salt]);
                const newSalt = getHash([newIndex.toString(), state.masterPassword, salt]);

                return port.postMessage({ userDomainSeed, salt: currentSalt, newSalt });
            });
        }

        if (updateSalt && userDomainSeed && state.contract && state.masterPassword) {
            const saltKey = getHash([userDomainSeed, state.masterPassword, salt]);

            return state.contract.incrementIndex(saltKey).then(tx => {
                console.log(`DecentPass - Transaction to increment index for ${domain} with salt key ${saltKey} broadcasted. Details follow:`);
                console.log(tx);
                return tx.wait();
            }).then(tx => {
                console.log(`DecentPass - Transaction to increment index for ${domain} with salt key ${saltKey} mined. Details follow:`);
                console.log(tx);
            });
        }
    });

    state.contentPorts[`${port.sender.tab.id}-${port.sender.frameId}`] = port;

    if (!state.contentPorts[port.sender.tab.id]) {
        state.contentPorts[port.sender.tab.id] = [];
    }

    state.contentPorts[port.sender.tab.id].push(port);

    sendDomainSeed(port, domain);
};

chrome.runtime.onConnect.addListener(port => {
    if (!port.sender.tab) return handlePopupConnection(port);

    const domain = getDomainFromHost(getHostFromSender(port.sender));

    if (domain) return handleContentScriptConnection(port, domain);
});
