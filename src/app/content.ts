export {};

const ethers = require('ethers');
const salt = 'DecentPassContentScript';

const state = { domainSeed: null, listeningToUserInput: false, port: null };

const getDomain = host => host && (host.match(/\./g) || []).length ? host.slice(host.indexOf('.') + 1) : host;

const getHash = values => ethers.utils.id(values.join(''));

const isPasswordInput = element => {
    const tagNames = ['INPUT', 'input', 'TEXTAREA', 'textarea'];
    return element.type == 'password' && tagNames.includes(element.tagName);
};

const getPasswordInputs = () => <NodeListOf<HTMLInputElement>>document.querySelectorAll(`input[type=password]`);

const getPasswordInput = () => getPasswordInputs()[0];

const updatePasswordInput = (element, password) => {
    element.value = password;
    element.setAttribute("data-empty", 'false');
    element.setAttribute("data-initial-value", password);
    element.setAttribute("value", password);
    element.setAttribute("badinput", 'false');

    const event = new Event('input', { 'bubbles': true, 'cancelable': true });
    element.dispatchEvent(event);
};

const fillChangePasswordForm = (currentPassword, newPassword) => {
    const passwordInputs = getPasswordInputs();
    updatePasswordInput(passwordInputs[0], currentPassword);
    updatePasswordInput(passwordInputs[1], newPassword);
    updatePasswordInput(passwordInputs[2], newPassword);
};

const captureUsername = username => localStorage.setItem('decentCapturedUsername', username);

const clearCapturedUser = () => localStorage.removeItem('decentCapturedUsername');

const getCapturedUsername = () => localStorage.getItem('decentCapturedUsername');

const getUsernameFromDOM = () => (<HTMLInputElement>(document.querySelector('input[name=username]') || document.querySelector('input[name=email]') || {})).value;

const getUsername = () => getUsernameFromDOM() || getCapturedUsername();

const remove0x = hexInput => hexInput.startsWith("0x") ? hexInput.slice(2) : hexInput;

const hexToPassword = hexPassword => {
    hexPassword = remove0x(hexPassword);

    let validAscii = '';
    for (var i = 33; i < 127; i++) { validAscii += String.fromCharCode(i);}

    let password = '';
    for (var i = 0; i < hexPassword.length; i = i + 2) {
        password += validAscii.charAt(parseInt(hexPassword.substr(i, 2), 16) % validAscii.length);
    }

    return password;
};

const getUserDomainSeed = () => {
    const username = getUsername();

    if (!username || !state.domainSeed) return null;

    return getHash([state.domainSeed, username, salt]);
};

const requestDomainSeed = () => state.port.postMessage({ getDomainSeed: true });

const requestPasswordSalt = () => state.port.postMessage({ getSalt: true, userDomainSeed: getUserDomainSeed() });

const requestNewSalt = () => state.port.postMessage({ getNewSalt: true, userDomainSeed: getUserDomainSeed() });

const requestUpdateSalt = () => state.port.postMessage({ updateSalt: true, userDomainSeed: getUserDomainSeed() });

const setPassword = (passwordSalt, saltKey) => {
    if (!state.domainSeed || !passwordSalt) return;

    const username = getUsername();

    if (!username) return;

    captureUsername(username);

    const userDomainSeed = getHash([state.domainSeed, username, salt]);

    if (userDomainSeed !== saltKey) return;

    const hexPassword = getHash([state.domainSeed, username, passwordSalt, salt]);
    const password = hexToPassword(hexPassword);

    console.log(`DecentPass - Filling in password for user ${username}`);

    updatePasswordInput(getPasswordInput(), password);
}

const changePassword = (currentPasswordSalt, newPasswordSalt, saltKey) => {
    if (!state.domainSeed || !currentPasswordSalt || !newPasswordSalt) return;

    const username = getUsername();

    if (!username) return;

    const userDomainSeed = getHash([state.domainSeed, username, salt]);

    if (userDomainSeed !== saltKey) return;

    const currentHexPassword = getHash([state.domainSeed, username, currentPasswordSalt, salt]);
    const currentPassword = hexToPassword(currentHexPassword);

    const newHexPassword = getHash([state.domainSeed, username, newPasswordSalt, salt]);
    const newPassword = hexToPassword(newHexPassword);

    console.log(`DecentPass - Filling in change password form for ${username}`);

    fillChangePasswordForm(currentPassword, newPassword);
}

const isUserInput = element => {
    const tagNames = ['INPUT', 'input', 'TEXTAREA', 'textarea'];
    const types = ['USERNAME', 'username', 'EMAIL', 'email'];

    return tagNames.includes(element.tagName) && (types.includes(element.type) || types.includes(element.name));
};

// TODO: consider connecting only once a password input is focused
state.port = chrome.runtime.connect();

state.port.onMessage.addListener(async message => {
    console.log('DecentPass - Message received from Background.');

    const { domainSeed, userDomainSeed, salt, passwordChangeRequested, passwordUpdateRequested, newSalt } = message;

    if (domainSeed) { state.domainSeed = domainSeed; return requestPasswordSalt(); };

    if (userDomainSeed && salt && newSalt) return changePassword(salt, newSalt, userDomainSeed);

    if (userDomainSeed && salt) return setPassword(salt, userDomainSeed);

    if (passwordChangeRequested && state.domainSeed) return requestNewSalt();

    if (passwordUpdateRequested && state.domainSeed) return requestUpdateSalt();
});

const checkReady = setInterval(() => {
    if (document.readyState === "complete") {
        clearInterval(checkReady);
        console.log("DecentPass - Content Script injected.");
    }
});

document.addEventListener('focusin', async () => {
    if (isUserInput(document.activeElement)) {
        captureUsername((<HTMLInputElement>document.activeElement).value);

        if (state.listeningToUserInput) return;

        document.activeElement.addEventListener('input', function() { captureUsername(this.value); });

        state.listeningToUserInput = true;

        return;
    };

    if (isPasswordInput(document.activeElement)) return state.domainSeed ? requestPasswordSalt() : requestDomainSeed();
}, false);
