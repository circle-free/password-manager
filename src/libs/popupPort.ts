"use strict";

import { BackgroundState, BackgroundResponse, PopupRequest } from "./constants";

type SimpleCallback = (a?: any) => void;

export class PortToPopup {
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

    public sendState(state: BackgroundState) : Boolean { return this._sendMessage({ state }); }

    public sendResponse(response: BackgroundResponse) : Boolean { return this._sendMessage({ response }); }

    public onRequest(request: PopupRequest, callback: SimpleCallback) {
        this._port.onMessage.addListener(message => {
            if (message.request !== request) return;

            message.parameter == null ? callback() : callback(message.parameter);
        });
    }
}

export class PortToBackground {
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

    public sendRequest(request: PopupRequest, parameter?: any) : Boolean {
        return parameter == null ? this._sendMessage({ request }) : this._sendMessage({ request, parameter });
    }

    public onState(state: BackgroundState, callback: SimpleCallback) {
        this._port.onMessage.addListener(message => {
            if (message.state === state) callback();
        });
    }

    public onResponse(response: BackgroundResponse, callback: SimpleCallback) {
        this._port.onMessage.addListener(message => {
            if (message.response === response) callback();
        });
    }
}