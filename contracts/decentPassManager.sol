pragma solidity >=0.5.0 <0.7.0;

contract DecentPassManager {
    event AccountDataSet(address indexed account);
    event DepositMade(address indexed account, uint256 indexed amount, uint256 indexed unlockBlock);
    event EarlyBonusFactorSet(address indexed account, uint256 indexed earlyBonusFactor);
    event IndexIncremented(address indexed account, bytes32 saltKey);
    event NonceUsed(address indexed account, address indexed relayer, uint256 indexed nonce);
    event SignerAdded(address indexed account, address indexed signer);
    event SignerRemoved(address indexed account, address indexed signer);
    event WithdrawalMade(address indexed account, address indexed destination, uint256 indexed amount);

    mapping(bytes32 => uint256) internal _indices;
    mapping(bytes32 => uint256) internal _nonces;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public earlyBonusFactors;
    mapping(address => bytes32) public encryptedSeeds;
    mapping(address => address) public delegations;
    mapping(address => bytes32) public ivs;
    mapping(address => bytes32) public saltedPasswords;
    mapping(address => uint256) public unlockBlocks;

    constructor() public {}

    // computes the index key by salting the salt key with the account
    function _getIndexKey(bytes32 saltKey, address account) internal pure returns (bytes32) { return sha256(abi.encodePacked(saltKey, account)); }

    // computes the nonce key by salting the relayer with the account
    function _getNonceKey(address relayer, address account) internal pure returns (bytes32) { return sha256(abi.encodePacked(account, relayer)); }

    // increments an index given a salt and account
    function _incrementIndex(address account, bytes32 saltKey) internal {
        _indices[_getIndexKey(saltKey, account)]++;
        emit IndexIncremented(account, saltKey);
    }

    // set the password management data (encrypted seed, iv, salted password) for an account
    function _setAccountData(address account, bytes32 encryptedSeed, bytes32 iv, bytes32 saltedPassword) internal {
        encryptedSeeds[account] = encryptedSeed;
        ivs[account] = iv;
        saltedPasswords[account] = saltedPassword;
        emit AccountDataSet(account);
    }

    // pay the relayer (the sender) as much as possible
    function _payRelayer(uint256 minFee, address account, uint256 expiryBlock) internal {
        // the fee will be approximately earlyBonusFactor tenths of a percent more for every block earlier the transaction is relayed
        uint256 calculatedFee = minFee + (minFee >> 10) * (expiryBlock - block.number) * earlyBonusFactors[account];

        uint256 accountBalance = balances[account];
        uint256 fee = accountBalance >= calculatedFee ? calculatedFee : accountBalance;     // take it all if not enough balance
        balances[account] = accountBalance - fee;
        balances[msg.sender] += fee;
    }

    // allows another address to sign on an account's behalf
    function _addSigner(address account, address signingAddress) internal {
        assert(delegations[signingAddress] == address(0));
        delegations[signingAddress] = account;
        emit SignerAdded(account, signingAddress);
    }

    // disallows another address to sign on an account's behalf
    function _removeSigner(address account, address signingAddress) internal {
        assert(delegations[signingAddress] == account);
        delegations[signingAddress] = address(0);
        emit SignerRemoved(account, signingAddress);
    }

    // fallback to result in fund deposit
    function() external payable { deposit(); }

    // create an account by funding it, assigning a singer for relayed calls, and setting up password management data
    function createAccount(bytes32 encryptedSeed, bytes32 iv, bytes32 saltedPassword, uint256 earlyBonusFactor, address signingAddress) public payable {
        if (msg.value != 0) deposit();
        if (encryptedSeed != bytes32(0)) setAccountData(encryptedSeed, iv, saltedPassword);
        if (earlyBonusFactor != uint256(0)) setEarlyBonusFactor(earlyBonusFactor);
        if (signingAddress != address(0)) addSigner(signingAddress);
    }

    // deposit ETH (in wei) into account, and lock withdrawing for 24 hours, which helps against front-running a relayer
    function deposit() public payable {
        balances[msg.sender] += msg.value;
        uint256 unlockBlock = block.number + 7200;
        unlockBlocks[msg.sender] = unlockBlock;
        emit DepositMade(msg.sender, msg.value, unlockBlock);
    }

    // add a signer directly for an account
    function addSigner(address signingAddress) public { _addSigner(msg.sender, signingAddress); }

    // remove a signer directly for an account
    function removeSigner(address signingAddress) public { _removeSigner(msg.sender, signingAddress); }

    // set an early bonus factor for relayed transactions
    function setEarlyBonusFactor(uint256 earlyBonusFactor) public {
        assert(earlyBonusFactor > earlyBonusFactors[msg.sender] || block.number >= unlockBlocks[msg.sender]);
        earlyBonusFactors[msg.sender] = earlyBonusFactor;
        unlockBlocks[msg.sender] = block.number + 7200;
        emit EarlyBonusFactorSet(msg.sender, earlyBonusFactor);
    }

    // withdraw all ETH (in wei) in account, only if they've waited 24 hours since the last deposit
    function withdraw(address payable destination, uint256 amount) public {
        assert(block.number >= unlockBlocks[msg.sender]);

        uint256 accountBalance = balances[msg.sender];
        assert(amount <= accountBalance);
        balances[msg.sender] = accountBalance - amount;
        unlockBlocks[msg.sender] = 0;

        destination.transfer(amount);
        emit WithdrawalMade(msg.sender, destination, amount);
    }

    // increment the index directly, where the account in question is the sender
    function incrementIndex(bytes32 saltKey) public { _incrementIndex(msg.sender, saltKey); }

    // set the password management data directly (encrypted seed, iv, salted password) where the account in question is the sender
    function setAccountData(bytes32 encryptedSeed, bytes32 iv, bytes32 saltedPassword) public { _setAccountData(msg.sender, encryptedSeed, iv, saltedPassword); }

    // relay encoded data with signature to increment an index or set encrypted seed
    function relay(bytes memory params, bytes memory args, uint8 v, bytes32 r, bytes32 s) public {
        address signer = ecrecover(keccak256(abi.encodePacked(params, args)), v, r, s);     // recover signing address
        address account = delegations[signer];                                              // get account the signing address is delegated to

        (bytes1 mode, address relayer, uint256 nonce, uint256 minFee, uint256 expiryBlock) = abi.decode(params, (bytes1, address, uint256, uint256, uint256));

        assert(msg.sender == relayer);                                              // assert relayer is as expected
        assert(block.number <= expiryBlock);                                        // assert signature is not expired
        emit NonceUsed(account, msg.sender, nonce);
        assert(nonce == _nonces[_getNonceKey(account, msg.sender)]++);              // assert nonce is valid and increment nonce (replay protection)
        _payRelayer(minFee, account, expiryBlock);                                  // refund the relayer as much as possible

        if (mode == 0x00) {
            (bytes32 saltKey) = abi.decode(args, (bytes32));
            _incrementIndex(account, saltKey);                                      // increment the index or set the encrypted seed
        } else if (mode == 0x01) {
            (bytes32 encryptedSeed, bytes32 iv, bytes32 saltedPassword, address newSigner) = abi.decode(args, (bytes32, bytes32, bytes32, address));
            _setAccountData(account, encryptedSeed, iv, saltedPassword);            // set new account data
            _removeSigner(account, signer);                                         // remove current signer as delegate for this account
            _addSigner(account, newSigner);                                         // add new signer as delegate for this account
        }
    }

    // get the relay nonce given an account and a relayer
    function getRelayNonce(address account, address relayer) public view returns (uint256) { return _nonces[_getNonceKey(relayer, account)]; }

    // get the index given a salt key and an account
    function getIndex(address account, bytes32 saltKey) public view returns (uint256) { return _indices[_getIndexKey(saltKey, account)]; }

    // get acount data needed for password management (encryptedSeed, iv, saltedPassword)
    function getAccountData(address account) public view returns ( bytes32, bytes32, bytes32 ) { return (encryptedSeeds[account], ivs[account], saltedPasswords[account]); }
}
