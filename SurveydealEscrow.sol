// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
contract SurveydealEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    enum EscrowState { Created, Funded, Active, Completed, Disputed, Refunded }
    enum EscrowMode { Locked, Arbiter }
    struct Milestone {
        string description;
        uint256 amount;
        bool released;
        bool disputed;
        bool buyerApproved;
        bool sellerDelivered;
    }
    struct Escrow {
        uint256 id;
        address buyer;
        address seller;
        address arbiter;
        address token;
        uint256 totalAmount;
        uint256 fundedAmount;
        uint256 releasedAmount;
        uint256 protocolFee;
    }
    // ... (Rest of the contract logic)
}
