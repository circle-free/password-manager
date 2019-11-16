pragma solidity >=0.5.0 <0.7.0;

contract DecentPassManager {
    event DepositMade(address indexed account, uint256 indexed amount, uint256 indexed unlockBlock);
    event EarlyBonusFactorSet(address indexed account, uint256 indexed earlyBonusFactor);
    event EncryptedSeedSet(address indexed account);
    event IndexIncremented(address indexed account, bytes32 saltKey);
    event NonceUsed(address indexed account, address indexed relayer, uint256 indexed nonce);
    event SignerAdded(address indexed account, address indexed signer);
    event SignerRemoved(address indexed account, address indexed signer);
    event WithdrawalMade(address indexed account, address indexed destination, uint256 indexed amount);

    struct Account {
        uint256 balance;
        uint256 unlockBlock;
        uint256 earlyBonusFactor;
        bytes32 encryptedSeed;
        bytes16 iv;
    }

    mapping(address => Account) public accounts;
    mapping(address => address) public delegations;
    mapping(bytes32 => uint256) internal indices;
    mapping(bytes32 => uint256) internal nonces;

    constructor() public {}

    // compute the index key by salting the salt key with the account
    function getIndexKey(bytes32 saltKey, address account) internal pure returns (bytes32) { return sha256(abi.encodePacked(saltKey, account)); }

    // compute the nonce key by salting the relayer with the account
    function getNonceKey(address relayer, address account) internal pure returns (bytes32) { return sha256(abi.encodePacked(account, relayer)); }

    // pay the relayer (the sender) as much as possible
    function payRelayer(uint256 minFee, Account storage account, uint256 expiryBlock) internal {
        // the fee will be approximately earlyBonusFactor tenths of a percent more for every block earlier the transaction is relayed
        uint256 calculatedFee = minFee + (minFee >> 10) * (expiryBlock - block.number) * account.earlyBonusFactor;

        // if the account doesn't have enough balance, just take it all at this point
        uint256 fee = account.balance >= calculatedFee ? calculatedFee : account.balance;
        account.balance -= fee;
        accounts[msg.sender].balance += fee;
    }

    // fallback to result in fund deposit
    function() external payable { deposit(); }

    // create an account by funding it, assigning a singer for relayed calls, and setting an encrypted seed
    function createAccount(address signingAddress, bytes32 encryptedSeed, bytes16 iv, uint256 earlyBonusFactor) public payable {
        if (msg.value != 0) deposit();
        if (signingAddress != address(0)) addSigner(signingAddress);
        if (encryptedSeed != bytes32(0)) setEncryptedSeed(encryptedSeed, iv);
        if (earlyBonusFactor != uint256(0)) setEarlyBonusFactor(earlyBonusFactor);
    }

    // deposit ETH (in wei) into account, and lock withdrawing for 24 hours, which helps against front-running a relayer
    function deposit() public payable {
        Account storage account = accounts[msg.sender];
        account.balance += msg.value;
        uint256 unlockBlock = block.number + 7200;
        account.unlockBlock = unlockBlock;

        emit DepositMade(msg.sender, msg.value, unlockBlock);
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

    // set an early bonus factor for relayed transactions
    function setEarlyBonusFactor(uint256 earlyBonusFactor) public {
        Account storage account = accounts[msg.sender];
        assert(earlyBonusFactor > account.earlyBonusFactor || block.number >= account.unlockBlock);
        account.earlyBonusFactor = earlyBonusFactor;
        account.unlockBlock = block.number + 7200;

        emit EarlyBonusFactorSet(msg.sender, earlyBonusFactor);
    }

    // withdraw all ETH (in wei) in account, only if they've waited 24 hours since the last deposit
    function withdraw(address payable destination, uint256 amount) public {
        Account storage account = accounts[msg.sender];
        assert(block.number >= account.unlockBlock);

        assert(amount <= account.balance);
        account.balance -= amount;
        account.unlockBlock = 0;

        destination.transfer(amount);
        emit WithdrawalMade(msg.sender, destination, amount);
    }

    // increment the index directly, where the account in question is the sender
    function incrementIndex(bytes32 saltKey) public {
        indices[getIndexKey(saltKey, msg.sender)]++;
        emit IndexIncremented(msg.sender, saltKey);
    }

    // set the encrypted seed directly, where the account in question is the sender
    function setEncryptedSeed(bytes32 encryptedSeed, bytes16 iv) public {
        Account storage account = accounts[msg.sender];
        account.encryptedSeed = encryptedSeed;
        account.iv = iv;
        emit EncryptedSeedSet(msg.sender);
    }

    // relay encoded data with signature to increment an index or set encrypted seed
    function relay(bytes memory encoded, uint8 v, bytes32 r, bytes32 s) public {
        // get signingAddress from signature of parameters
        address signingAddress = ecrecover(keccak256(encoded), v, r, s);

        // decode the payload into paramters
        (bytes1 mode, bytes32 arg1, bytes16 arg2, uint256 minFee, uint256 nonce, uint256 expiryBlock) = abi.decode(encoded, (bytes1, bytes32, bytes16, uint256, uint256, uint256));

        // get account address from delegate mapping, then get reference to account itself
        address accountAddress = delegations[signingAddress];
        Account storage account = accounts[accountAddress];

        // assert signature is not expired, assert nonce is valid, and increment nonce (replay protection)
        assert(block.number <= expiryBlock);
        emit NonceUsed(accountAddress, msg.sender, nonce);
        assert(nonce == nonces[getNonceKey(accountAddress, msg.sender)]++);

        if (mode == 0x00) {                                     // increment the index
            indices[getIndexKey(arg1, accountAddress)]++;
            emit IndexIncremented(accountAddress, arg1);
        } else if (mode == 0x01) {                              // set the encrypted seed
            account.encryptedSeed = arg1;
            account.iv = arg2;
            emit EncryptedSeedSet(accountAddress);
        }

        // refund the relayer as much as possible
        payRelayer(minFee, account, expiryBlock);
    }

    // get the relay nonce given an account and a relayer
    function getRelayNonce(address account, address relayer) public view returns (uint256) { return nonces[getNonceKey(relayer, account)]; }

    // get the index given a salt key and an account
    function getIndex(address account, bytes32 saltKey) public view returns (uint256) { return indices[getIndexKey(saltKey, account)]; }
}
