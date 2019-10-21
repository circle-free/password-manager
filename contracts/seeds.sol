pragma solidity >=0.5.0 <0.7.0;

contract DecentSeeds {
    mapping(address => bytes32) public encryptedSeeds;

    constructor() public {}

    function setEncryptedSeed(bytes32 encryptedSeed) public {
        encryptedSeeds[msg.sender] = encryptedSeed;
    }

    function getEncryptedSeed(address account) public view returns (bytes32) {
        return encryptedSeeds[account];
    }
}
