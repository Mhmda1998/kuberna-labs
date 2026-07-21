// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Simple mock ERC20 that allows configuring name/symbol/decimals and a max mint cap.
 * Compatible with existing tests that call constructor(uint8 decimals_).
 */
contract MockERC20 is ERC20, Ownable {
    string private _customName;
    string private _customSymbol;
    uint8 private _decimals;
    uint256 public maxMint;

    constructor(uint8 decimals_) ERC20("", "") {
        _customName = "Mock Token";
        _customSymbol = "MOCK";
        _decimals = decimals_;
        maxMint = type(uint256).max;
        // Ownable constructor sets owner to msg.sender
    }

    /// @notice Configure token metadata and a max mint cap (only owner)
    function configure(
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_,
        uint256 maxMint_
    ) external onlyOwner {
        _customName = name_;
        _customSymbol = symbol_;
        _decimals = decimals_;
        maxMint = maxMint_;
    }

    /// @dev Override ERC20 name/symbol accessors to return configurable values
    function name() public view virtual override returns (string memory) {
        return _customName;
    }

    function symbol() public view virtual override returns (string memory) {
        return _customSymbol;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        // enforce max mint cap if set
        if (maxMint != type(uint256).max) {
            require(totalSupply() + amount <= maxMint, "MockERC20: mint cap exceeded");
        }
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
