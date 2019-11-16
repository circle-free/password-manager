"use strict";

export function getHostFromSender(sender: chrome.runtime.MessageSender) : string {
    return (new URL(sender.url)).host == (new URL(sender.tab.url)).host ? (new URL(sender.url)).host : null;
}

export function getDomainFromHost(host: string) : string {
    return host && (host.match(/\./g) || []).length ? host.slice(host.indexOf('.') + 1) : host;
}

export function removePrefix(hexString: string) : string {
    return hexString.replace('0x', '');
}

export function addPrefix(hexString: string) : string {
    return hexString.startsWith('0x') ? hexString : `0x${hexString}`;
}

export function hexStringToBuffer(hexString: string) : Buffer {
    return Buffer.from(removePrefix(hexString), 'hex');
}

export function bufferToHexString(buf: Buffer) : string {
    return addPrefix(buf.toString('hex'));
}