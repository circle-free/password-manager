pragma solidity >=0.5.0 <0.7.0;

contract DecentIndices {
    mapping(bytes32 => uint256) public salts;

    constructor() public {}

    function incrementIndex(bytes32 saltKey) public {
        salts[sha256(abi.encodePacked(msg.sender, saltKey))]++;
    }

    function getIndex(address account, bytes32 saltKey) public view returns (uint256) {
        return salts[sha256(abi.encodePacked(account, saltKey))];
    }
}
