"use strict";

export enum BackgroundState {
    NotConnected,
    Connecting,
    NoRoot,
    LoggedOut,
    LoggedIn,
    NoAccount,
    SigningSeed,
    BroadcastingCreate,
    ChangingPassword,
    BroadcastingUpdate,
};

export enum BackgroundResponse {
    CreateSucceeded,
    CreateFailed,
    IncorrectPassword,
};

export enum PopupRequest {
    Connect,
    Create,
    Login,
    Logout,
    Clear,
    ChangePassword,
    UpdatePassword,
};
