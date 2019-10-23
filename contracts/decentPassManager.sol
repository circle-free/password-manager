pragma solidity >=0.5.0 <0.7.0;

contract DecentPassManager {
    event SignerAdded(address indexed account, address indexed signer);
    event SignerRemoved(address indexed account, address indexed signer);
    event DepositMade(address indexed account, uint256 indexed amount, uint256 indexed unlockBlock);
    event WithdrawalMade(address indexed account, uint256 indexed amount);
    event IndexIncremented(address indexed account, bytes32 saltKey);
    event EncryptedSeedSet(address indexed account);

    struct Account {
        uint256 balance;
        uint256 unlockBlock;
        bytes32 encryptedSeed;
    }

    mapping(address => Account) public accounts;
    mapping(address => address) public delegations;
    mapping(bytes32 => uint256) public indices;
    mapping(bytes32 => uint256) public nonces;

    constructor() public {}

    // compute the index key by salting the salt key with the account
    function getIndexKey(bytes32 saltKey, address account) public pure returns (bytes32) {
        return sha256(abi.encodePacked(saltKey, account));
    }

    // compute the nonce key by salting account with the relayer
    function getNonceKey(address account, address relayer) public pure returns (bytes32) {
        return sha256(abi.encodePacked(account, relayer));
    }

    // get address of account that signed the arg with the proxy paramaters
    function getAddressFromSig(bytes1 func, bytes32 arg, address relayer, uint256 gasprice, uint256 fee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) public pure returns (address) {
        return ecrecover(keccak256(abi.encodePacked(func, arg, relayer, gasprice, fee, nonce, expiry)), v, r, s);
    }

    // pay the relayer (the sender) as much as possible
    function payRelayer(uint256 fee, Account storage account) internal {
        uint256 possibleFee = account.balance >= fee ? fee : account.balance;
        account.balance -= possibleFee;
        accounts[msg.sender].balance += possibleFee;
    }

    // fallback to result in fund deposit
    function() external payable {
        deposit();
    }

    // create an account by funding it, assigning a singer for relayed calls, and setting an encrypted seed
    function create(address signingAddress, bytes32 encryptedSeed) public payable {
        deposit();
        addSigner(signingAddress);
        setEncryptedSeed(encryptedSeed);
    }

    // deposit ETH (in wei) into account, and lock withdrawing for 24 hours, which helps against front-running a relayer
    function deposit() public payable {
        Account storage account = accounts[msg.sender];
        account.balance += msg.value;
        account.unlockBlock = block.number + 7200;

        emit DepositMade(msg.sender, msg.value, account.unlockBlock);
    }

    // allows another address to sign on an account's behalf
    function addSigner(address signingAddress) public {
        assert(delegations[signingAddress] == address(0));
        delegations[signingAddress] = msg.sender;

        emit SignerAdded(msg.sender, signingAddress);
    }

    // disallows another address to sign on an account's behalf
    function removeSigner(address signingAddress) public {
        assert(delegations[signingAddress] == msg.sender);
        delegations[signingAddress] = address(0);

        emit SignerRemoved(msg.sender, signingAddress);
    }

    // withdraw all ETH (in wei) in account, only if they've waited 24 hours since the last deposit
    function withdraw() public {
        Account storage account = accounts[msg.sender];
        assert(block.number > account.unlockBlock);

        uint256 value = account.balance;
        account.balance = 0;
        account.unlockBlock = 0;

        msg.sender.transfer(value);

        emit WithdrawalMade(msg.sender, value);
    }

    // increment the index directly, where the account in question is the sender
    function incrementIndex(bytes32 saltKey) public {
        indices[getIndexKey(saltKey, msg.sender)]++;
        emit IndexIncremented(msg.sender, saltKey);
    }

    // set the encrypted seed directly, where the account in question is the sender
    function setEncryptedSeed(bytes32 encryptedSeed) public {
        accounts[msg.sender].encryptedSeed = encryptedSeed;
        emit EncryptedSeedSet(msg.sender);
    }

    // increment the index by proxy, where the relayer provides a signature that implies the account
    function incrementIndexByProxy(bytes32 saltKey, uint256 fee, uint256 nonce, uint256 expiryBlock, uint8 v, bytes32 r, bytes32 s) public {
        // get signingAddress from signature of paramaters
        address signingAddress = getAddressFromSig(0x01, saltKey, msg.sender, tx.gasprice, fee, nonce, expiryBlock, v, r, s);

        // get account address from delegate mapping, then get reference to account itself
        address accountAddress = delegations[signingAddress];
        Account storage account = accounts[accountAddress];

        // assert signature is not expired, assert nonce is valid, and increment nonce (replay protection)
        assert(block.number < expiryBlock);
        assert(nonce == nonces[getNonceKey(accountAddress, msg.sender)]++);

        // increment the index
        indices[getIndexKey(saltKey, accountAddress)]++;

        // refund the relayer as much as possible
        payRelayer(fee, account);

        emit IndexIncremented(accountAddress, saltKey);
    }

    // set encrypted seed by proxy, where the relayer provides a signature that implies the account
    function setEncryptedSeedByProxy(bytes32 encryptedSeed, uint256 fee, uint256 nonce, uint256 expiryBlock, uint8 v, bytes32 r, bytes32 s) public {
        // get signingAddress from signature of paramaters
        address signingAddress = getAddressFromSig(0x02, encryptedSeed, msg.sender, tx.gasprice, fee, nonce, expiryBlock, v, r, s);

        // get account address from delegate mapping, then get reference to account itself
        address accountAddress = delegations[signingAddress];
        Account storage account = accounts[accountAddress];

        // assert signature is not expired, assert nonce is valid, and increment nonce (replay protection)
        assert(block.number < expiryBlock);
        assert(nonce == nonces[getNonceKey(accountAddress, msg.sender)]++);

        // set the encrypted seed
        account.encryptedSeed = encryptedSeed;

        // refund the relayer as much as possible
        payRelayer(fee, account);

        emit EncryptedSeedSet(accountAddress);
    }

    // get an account's balance
    function getBalance(address account) public view returns (uint256) {
        return accounts[account].balance;
    }

    // get an account's unlockBlock
    function getUnlockBlock(address account) public view returns (uint256) {
        return accounts[account].unlockBlock;
    }

    // get the raley nonce given adn account and relayer
    function getNonce(address account, address relayer) public view returns (uint256) {
        return nonces[getNonceKey(account, relayer)];
    }

    // get an account's encrypted seed
    function getEncryptedSeed(address account) public view returns (bytes32) {
        return accounts[account].encryptedSeed;
    }

    // get the index for a salt key for an account
    function getIndex(bytes32 saltKey, address account) public view returns (uint256) {
        return indices[getIndexKey(saltKey, account)];
    }
}
