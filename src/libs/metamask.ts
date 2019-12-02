"use strict";

export function connect(web3Provider) : Promise<string> {
    return new Promise<string>((resolve, reject) => {
        web3Provider.sendAsync({ method: 'eth_requestAccounts' }, (err, res) => {
            if (err) return reject(err);

            resolve(res.result[0]);
        });
    });
};

// TODO: formalize the return type
export function personalSign(web3Provider, data, account) : Promise<any> {
    return new Promise<any>((resolve, reject) => {
        web3Provider.sendAsync({ method: 'personal_sign', params: [data, account], from: account }, (err, res) => {
            if (err) return reject(err);

            if (res.error) return reject(res.error);

            resolve(res.result);
        });
    });
};
