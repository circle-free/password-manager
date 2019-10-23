import * as React from 'react';
import * as ReactDOM from 'react-dom';

import '../styles/popup.css';

interface IState {
    newUser?: boolean;
    port?: chrome.runtime.Port;
    pass?: string;
    confPass?: string;
    mode?: string;
}

interface IProps {}

class PopupUI extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        this.state = {
            newUser: false,
            port: chrome.runtime.connect(),
            mode: 'passwords',
        };

        this.state.port.onMessage.addListener(message => {
            console.log('DecentPass - Received message from background.');

            console.log(message);

            const { newUser, mode, incorrectPassword } = message;

            this.setState({
                newUser: newUser == null ? this.state.newUser : newUser,
                mode: mode || 'passwords',
                pass: incorrectPassword ? this.state.pass : null,
                confPass: incorrectPassword ? this.state.confPass : null,
            });
        });
    }

    changePassword = e => {
        console.log('DecentPass - Change password clicked.');

        this.state.port.postMessage({ changePasswordRequest: true });
    };

    updatePassword = e => {
        console.log('DecentPass - Update password clicked.');

        this.state.port.postMessage({ updatePasswordRequest: true });
    };

    passChange = e => {
        console.log('DecentPass - Password field changed.');

        this.setState({ pass: e.target.value });
    };

    confPassChange = e => {
        console.log('DecentPass - Confirm Password field changed.');

        this.setState({ confPass: e.target.value });
    };

    passwordsMatch = () => this.state.pass === this.state.confPass;

    continue = () => {
        if (this.state.mode === 'passwords' && !this.state.newUser) return this.state.port.postMessage({ password: this.state.pass });

        if (this.state.mode === 'passwords' && this.passwordsMatch()) return this.setState({ mode: 'preConnecting' });

        if (this.state.mode === 'preConnecting') return this.state.port.postMessage({ password: this.state.pass, connect: true });
    };

    handlePasswordKeyPress = e => {
        if (e.key === 'Enter') return this.continue();
    };

    logOut = e => {
        console.log('DecentPass - End session submit.');
        this.state.port.postMessage({ logOut: true });
    };

    getInfoText = () => {
        const preConnectionText = chrome.i18n.getMessage('l10nPreConnectInstructions');
        const connectionText = chrome.i18n.getMessage('l10nConnectingInstructions');
        const changingInstructions = chrome.i18n.getMessage('l10nChangingInstructions');
        const updatingText = chrome.i18n.getMessage('l10nUpdatingInstructions');
        const firstTimeInfo = chrome.i18n.getMessage('l10nFirstTimeInstructions');
        const returningInfo = chrome.i18n.getMessage('l10nStartSessionInstructions');

        if (this.state.mode === 'preConnecting') return preConnectionText;

        if (this.state.mode === 'connecting') return connectionText;

        if (this.state.mode === 'changing') return changingInstructions;

        if (this.state.mode === 'transacting') return updatingText;

        if (this.state.newUser) return firstTimeInfo;

        if (!this.state.newUser) return returningInfo;

        return;
    };

    render() {
        const extensionName = chrome.i18n.getMessage('l10nExtensionName');
        const extensionDescription = chrome.i18n.getMessage('l10nExtensionDescription');
        const passwordText = chrome.i18n.getMessage('l10nPasswordPlaceholder');
        const confirmText = chrome.i18n.getMessage('l10nConfirmPasswordPlaceholder');
        const changePasswordText = chrome.i18n.getMessage('l10nChangePasswordButton');
        const updatePasswordText = chrome.i18n.getMessage('l10nUpdatePasswordButton');
        const loginText = chrome.i18n.getMessage('l10nLoginButton');
        const logoutText = chrome.i18n.getMessage('l10nLogoutButton');
        const connectText = chrome.i18n.getMessage('l10nConnectButton');
        const nextText = chrome.i18n.getMessage('l10nNextButton');

        const flexItems = [];

        if (this.state.mode === 'preConnecting') {
            flexItems.push(<div key='info' className='info'>{ this.getInfoText() }</div>);
            flexItems.push(<div key='general-button' className='general-button' onClick={ this.continue }>{ connectText }</div>);
        } else if (this.state.mode === 'passwords') {
            flexItems.push(<div key='info' className='info'>{ this.getInfoText() }</div>);
            flexItems.push(<input key='password' className='password' type='password' placeholder={ passwordText } onChange={ this.passChange } onKeyPress={ this.handlePasswordKeyPress }/>);

            if (this.state.newUser) flexItems.push(<input key='confirm-password' className='confirm-password' type='password' placeholder={ `${confirmText} ${passwordText}` } onChange={ this.confPassChange } onKeyPress={ this.handlePasswordKeyPress }/>);

            flexItems.push(<div key='general-button' className='general-button' onClick={ this.continue }>{ this.state.newUser ? nextText : loginText }</div>);
        } else if (this.state.mode === 'main') {
            flexItems.push(<div key='change-password' className='change-password' onClick={ this.changePassword }>{ changePasswordText }</div>);
            flexItems.push(<div key='update-password' className='update-password' onClick={ this.updatePassword }>{ updatePasswordText }</div>);
            flexItems.push(<div key='log-out' className='log-out' onClick={ this.logOut }>{ logoutText }</div>);
        } else {
            flexItems.push(<div key='info' className='info'>{ this.getInfoText() }</div>);
        }

        return (
            <div className='popup-padded'>
                <h1>{ extensionName }</h1>
                <h3>({ extensionDescription })</h3>
                <div className='flex-column'>
                    {flexItems}
                </div>
            </div>
        );
    };
}

ReactDOM.render(<PopupUI />, document.getElementById('root'));
