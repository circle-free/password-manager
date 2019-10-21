import * as React from 'react';
import * as ReactDOM from 'react-dom';

import '../styles/popup.css';

interface IState {
    active?: boolean;
    newUser?: boolean;
    port?: chrome.runtime.Port;
    pass?: string;
    confPass?: string;
    transacting?: boolean;
    changing?: boolean;
}

interface IProps {}

class PopupUI extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        this.state = {
            active: false,
            newUser: false,
            port: chrome.runtime.connect(),
            transacting: false,
        };

        this.state.port.onMessage.addListener(message => {
            console.log('DecentPass - Received message from background.');

            const { active, newUser, transacting, changing } = message;

            this.setState({
                active: active == null ? this.state.active : active,
                newUser: newUser == null ? this.state.newUser : newUser,
                transacting: transacting == null ? this.state.transacting : transacting,
                changing: changing == null ? this.state.changing : changing,
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

        if (!this.state.newUser) return this.state.port.postMessage({ password: e.target.value });
    };

    confPassChange = e => {
        console.log('DecentPass - Confirm Password field changed.');

        this.setState({ confPass: e.target.value });

        if (this.state.pass !== e.target.value) return;

        this.state.port.postMessage({ password: e.target.value });
    };

    handlePasswordSubmit = e => {
        if (e.key !== 'Enter') return;

        console.log('DecentPass - Attempting to submit password.');

        if (this.state.newUser && this.state.pass !== this.state.confPass) return;

        console.log('DecentPass - Password submitted.');

        this.state.port.postMessage({ password: this.state.pass });
    };

    endSession = e => {
        console.log('DecentPass - End session submit.');
        this.state.port.postMessage({ endSession: true });
    };

    render() {
        const extensionName = chrome.i18n.getMessage('l10nExtensionName');
        const extensionDescription = chrome.i18n.getMessage('l10nExtensionDescription');
        const passwordText = chrome.i18n.getMessage('l10nMasterPassword');
        const confirmText = chrome.i18n.getMessage('l10nConfirm');
        const changePasswordText = chrome.i18n.getMessage('l10nChangePassword');
        const updatePasswordText = chrome.i18n.getMessage('l10nUpdatePassword');
        const endSessionText = chrome.i18n.getMessage('l10nEndSession');
        const checkMetamaskText = chrome.i18n.getMessage('l10nCheckMetamask');
        const changingInstructios = chrome.i18n.getMessage('l10nChangingInstructions');
        const firstTimeInfo = chrome.i18n.getMessage('l10nFirstTimeInfo');
        const returningInfo = chrome.i18n.getMessage('l10nStartSessionInfo');

        const flexItems = [];

        if (this.state.transacting || this.state.changing) {
            flexItems.push(<div key='info' className='info'>{ this.state.transacting ? checkMetamaskText : changingInstructios }</div>);
        } else if (this.state.active) {
            flexItems.push(<div key='change-password' className='change-password' onClick={ this.changePassword }>{ changePasswordText }</div>);
            flexItems.push(<div key='update-password' className='update-password' onClick={ this.updatePassword }>{ updatePasswordText }</div>);
            flexItems.push(<div key='log-out' className='log-out' onClick={ this.endSession }>{ endSessionText }</div>);
        } else {
            flexItems.push(<div key='info' className='info'>{ this.state.newUser ? firstTimeInfo : returningInfo }</div>);
            flexItems.push(<input key='password' className='password' type='password' placeholder={ passwordText } onChange={ this.passChange } onKeyPress={ this.handlePasswordSubmit }/>);

            if (this.state.newUser) flexItems.push(<input key='confirm-password' className='confirm-password' type='password' placeholder={ `${confirmText} ${passwordText}` } onChange={ this.confPassChange } onKeyPress={ this.handlePasswordSubmit }/>);
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
