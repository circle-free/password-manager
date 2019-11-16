"use strict";

type SimpleCallback = () => void;
type StringCallback = (a: string) => void;

// TODO: Looking like Syayes are more like Repsonses, revsit please
enum State {
    Uninitialized,
    LoggedOut,
    LoggedIn,
    Connecting,
    Connected,
    Creating,
    BroadcastingCreate,
    CreateSucceeded,
    CreateFailed,
    IncorrectPassword,
    ChangingPassword,
    BroadcastingUpdate,
};

enum Request {
    Connect,
    Create,
    Login,
    Logout,
    Clear,
    ChangePassword,
    UpdatePassword,
};

export default class PopupPort {
    private _port : chrome.runtime.Port;
    private _disconnected : Boolean;

    public constructor(port: chrome.runtime.Port) {
        this._port = port;
        this._port.onDisconnect.addListener(() => this._disconnected = true);
    }

    private _sendMessage(message: object) : Boolean {
        if (this._disconnected) return false;

        this._port.postMessage(message);
        return true;
    }

    public sendUninitialized() : Boolean { return this._sendMessage({ state: State.Uninitialized }); }

    public sendLoggedOut() : Boolean { return this._sendMessage({ state: State.LoggedOut }); }

    public sendLoggedIn() : Boolean { return this._sendMessage({ state: State.LoggedIn }); }

    public sendConnecting() : Boolean { return this._sendMessage({ state: State.Connecting }); }

    public sendAccountFound() : Boolean { return this._sendMessage({ state: State.Connected, accountExists: true }); }

    public sendNoAccountFound() : Boolean { return this._sendMessage({ state: State.Connected, accountExists: false }); }

    public sendCreating() : Boolean { return this._sendMessage({ state: State.Creating }); }

    public sendBroadcastingCreate() : Boolean { return this._sendMessage({ state: State.BroadcastingCreate }); }

    public sendCreateSucceeded() : Boolean { return this._sendMessage({ state: State.CreateSucceeded }); }

    public sendCreateFailed() : Boolean { return this._sendMessage({ state: State.CreateFailed }); }

    public sendIncorrectPassword() : Boolean { return this._sendMessage({ state: State.IncorrectPassword }); }

    public sendChangingPassword() : Boolean { return this._sendMessage({ state: State.ChangingPassword }); }

    public sendBroadcastingUpdate() : Boolean { return this._sendMessage({ state: State.BroadcastingUpdate }); }

    public onConnectRequest(callback: SimpleCallback) {
        if (this._disconnected) return;

        this._port.onMessage.addListener(message => {
            if (message.request === Request.Connect) callback();
        });
    }

    public onCreateRequest(callback: StringCallback) {
        if (this._disconnected) return;

        this._port.onMessage.addListener(message => {
            if (message.request === Request.Create && message.password) callback(message.password);
        });
    }

    public onLoginRequest(callback: StringCallback) {
        if (this._disconnected) return;

        this._port.onMessage.addListener(message => {
            if (message.request === Request.Create && message.password) callback(message.password);
        });
    }

    public onLogoutRequest(callback: SimpleCallback) {
        if (this._disconnected) return;

        this._port.onMessage.addListener(message => {
            if (message.request === Request.Logout) callback();
        });
    }

    public onClearRequest(callback: SimpleCallback) {
        if (this._disconnected) return;

        this._port.onMessage.addListener(message => {
            if (message.request === Request.Clear) callback();
        });
    }

    public onChangePasswordRequest(callback: SimpleCallback) {
        if (this._disconnected) return;

        this._port.onMessage.addListener(message => {
            if (message.request === Request.ChangePassword) callback();
        });
    }

    public onUpdatePasswordRequest(callback: SimpleCallback) {
        if (this._disconnected) return;

        this._port.onMessage.addListener(message => {
            if (message.request === Request.UpdatePassword) callback();
        });
    }
}
