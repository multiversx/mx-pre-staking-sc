pragma solidity ^0.5.14;

import "./ERC20Detailed.sol";
import "./ERC20Mintable.sol";
import "./ERC20Burnable.sol";

contract Token is ERC20Detailed, ERC20Mintable, ERC20Burnable {
    constructor(string memory name, string memory symbol, uint8 decimals)
    ERC20Detailed(name, symbol, decimals)
    public
    {}
}
