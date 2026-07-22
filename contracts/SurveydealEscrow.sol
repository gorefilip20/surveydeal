// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SurveydealEscrow
 * @notice Multi-chain escrow with admin override, milestone-based releases,
 *         arbiter dispute resolution, and protocol fee collection.
 *
 * Admin powers:
 *   - Approve milestone release when both parties agree or when stuck
 *   - Force-release funds in emergency
 *   - Pause/unpause the entire protocol
 *   - Manage arbiters, tokens, fee config
 */
contract SurveydealEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    enum EscrowState {
        Created,
        Funded,
        Active,
        Completed,
        Disputed,
        Refunded
    }

    enum EscrowMode {
        Locked,   // 2-of-2: buyer + seller must agree
        Arbiter   // 2-of-3: arbiter can break ties
    }

    struct Milestone {
        string description;
        uint256 amount;
        bool released;
        bool disputed;
        bool buyerApproved;
        bool sellerDelivered;
        bool adminApproved;    // NEW: admin override flag
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
        uint256 protocolFeeCollected;
        EscrowState state;
        EscrowMode mode;
        bytes32 agreementHash;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 deadline;
        uint256 milestoneCount;
    }

    struct ProtocolFeeConfig {
        uint256 feeBasisPoints;
        uint256 maxFeeAbsolute;
        address feeRecipient;
    }

    uint256 public nextEscrowId;
    ProtocolFeeConfig public feeConfig;

    mapping(uint256 => Escrow) public escrows;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(address => bool) public blacklistedTokens;
    mapping(address => bool) public featuredTokens;

    // ── Events ──────────────────────────────────────
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 totalAmount,
        EscrowMode mode
    );
    event EscrowFunded(uint256 indexed escrowId, uint256 actualAmount);
    event EscrowActivated(uint256 indexed escrowId);
    event MilestoneDelivered(uint256 indexed escrowId, uint256 milestoneIndex);
    event MilestoneApproved(uint256 indexed escrowId, uint256 milestoneIndex);
    event AdminMilestoneApproved(uint256 indexed escrowId, uint256 milestoneIndex, address admin);
    event FundsReleased(uint256 indexed escrowId, uint256 milestoneIndex, uint256 amount);
    event AdminForceRelease(uint256 indexed escrowId, uint256 milestoneIndex, address admin);
    event DisputeInitiated(uint256 indexed escrowId, uint256 milestoneIndex, address initiator);
    event DisputeResolved(
        uint256 indexed escrowId,
        uint256 milestoneIndex,
        uint256 buyerShare,
        uint256 sellerShare
    );
    event EscrowRefunded(uint256 indexed escrowId, uint256 amount);
    event EscrowCompleted(uint256 indexed escrowId);
    event TokenBlacklisted(address indexed token);
    event TokenUnblacklisted(address indexed token);
    event TokenFeatured(address indexed token);
    event FeeConfigUpdated(uint256 feeBasisPoints, uint256 maxFeeAbsolute, address feeRecipient);

    // ── Errors ──────────────────────────────────────
    error InvalidAddress();
    error InvalidAmount();
    error InvalidState(EscrowState current, EscrowState expected);
    error TokenBlacklisted(address token);
    error NotParticipant();
    error NotBuyer();
    error NotSeller();
    error NotArbiter();
    error MilestoneOutOfRange(uint256 index, uint256 count);
    error MilestoneAlreadyReleased();
    error MilestoneNotDelivered();
    error MilestoneNotDisputed();
    error DeadlineExpired();
    error DeadlineNotExpired();
    error NoLockedModeArbiter();
    error CannotSelfEscrow();
    error InsufficientFunding();
    error InvalidBasisPoints();
    error FeeRecipientZeroAddress();

    // ── Modifiers ───────────────────────────────────
    modifier onlyBuyer(uint256 escrowId) {
        if (msg.sender != escrows[escrowId].buyer) revert NotBuyer();
        _;
    }
    modifier onlySeller(uint256 escrowId) {
        if (msg.sender != escrows[escrowId].seller) revert NotSeller();
        _;
    }
    modifier onlyParticipant(uint256 escrowId) {
        Escrow storage e = escrows[escrowId];
        if (msg.sender != e.buyer && msg.sender != e.seller && msg.sender != e.arbiter)
            revert NotParticipant();
        _;
    }
    modifier inState(uint256 escrowId, EscrowState expected) {
        if (escrows[escrowId].state != expected)
            revert InvalidState(escrows[escrowId].state, expected);
        _;
    }
    modifier milestoneExists(uint256 escrowId, uint256 index) {
        if (index >= escrows[escrowId].milestoneCount)
            revert MilestoneOutOfRange(index, escrows[escrowId].milestoneCount);
        _;
    }

    // ── Constructor ──────────────────────────────────
    constructor(
        address _admin,
        address _feeRecipient,
        uint256 _feeBasisPoints,
        uint256 _maxFeeAbsolute
    ) {
        if (_admin == address(0) || _feeRecipient == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(FEE_MANAGER_ROLE, _admin);

        feeConfig = ProtocolFeeConfig({
            feeBasisPoints: _feeBasisPoints,
            maxFeeAbsolute: _maxFeeAbsolute,
            feeRecipient: _feeRecipient
        });
    }

    // ════════════════════════════════════════════════
    //  ESCROW LIFECYCLE
    // ════════════════════════════════════════════════

    function createEscrow(
        address _seller,
        address _token,
        uint256 _totalAmount,
        EscrowMode _mode,
        address _arbiter,
        bytes32 _agreementHash,
        uint256 _deadline,
        string[] calldata _milestoneDescriptions,
        uint256[] calldata _milestoneAmounts
    ) external whenNotPaused returns (uint256 escrowId) {
        if (_seller == address(0) || _token == address(0)) revert InvalidAddress();
        if (_seller == msg.sender) revert CannotSelfEscrow();
        if (_totalAmount == 0) revert InvalidAmount();
        if (blacklistedTokens[_token]) revert TokenBlacklisted(_token);
        if (_milestoneDescriptions.length == 0 || _milestoneDescriptions.length != _milestoneAmounts.length)
            revert InvalidAmount();

        uint256 milestoneSum;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            if (_milestoneAmounts[i] == 0) revert InvalidAmount();
            milestoneSum += _milestoneAmounts[i];
        }
        if (milestoneSum != _totalAmount) revert InvalidAmount();

        if (_deadline != 0 && _deadline <= block.timestamp) revert DeadlineExpired();

        if (_mode == EscrowMode.Locked) {
            if (_arbiter != address(0)) revert NoLockedModeArbiter();
        } else {
            if (_arbiter == address(0) || !hasRole(ARBITER_ROLE, _arbiter))
                revert NoLockedModeArbiter();
        }

        escrowId = nextEscrowId++;

        Escrow storage e = escrows[escrowId];
        e.id = escrowId;
        e.buyer = msg.sender;
        e.seller = _seller;
        e.arbiter = _arbiter;
        e.token = _token;
        e.totalAmount = _totalAmount;
        e.state = EscrowState.Created;
        e.mode = _mode;
        e.agreementHash = _agreementHash;
        e.createdAt = block.timestamp;
        e.deadline = _deadline;
        e.milestoneCount = _milestoneDescriptions.length;

        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            milestones[escrowId][i] = Milestone({
                description: _milestoneDescriptions[i],
                amount: _milestoneAmounts[i],
                released: false,
                disputed: false,
                buyerApproved: false,
                sellerDelivered: false,
                adminApproved: false
            });
        }

        emit EscrowCreated(escrowId, msg.sender, _seller, _token, _totalAmount, _mode);
    }

    function fundEscrow(uint256 escrowId)
        external
        payable
        nonReentrant
        onlyBuyer(escrowId)
        inState(escrowId, EscrowState.Created)
    {
        Escrow storage e = escrows[escrowId];

        uint256 balanceBefore = IERC20(e.token).balanceOf(address(this));
        IERC20(e.token).safeTransferFrom(msg.sender, address(this), e.totalAmount);
        uint256 balanceAfter = IERC20(e.token).balanceOf(address(this));
        uint256 actualReceived = balanceAfter - balanceBefore;

        if (actualReceived < e.totalAmount) {
            if (actualReceived == 0) revert InsufficientFunding();
            e.totalAmount = actualReceived;
            _recalculateMilestones(escrowId, actualReceived);
        }

        e.fundedAmount = actualReceived;
        e.state = EscrowState.Funded;
        e.fundedAt = block.timestamp;

        emit EscrowFunded(escrowId, actualReceived);
    }

    function activateEscrow(uint256 escrowId)
        external
        onlySeller(escrowId)
        inState(escrowId, EscrowState.Funded)
    {
        escrows[escrowId].state = EscrowState.Active;
        emit EscrowActivated(escrowId);
    }

    // ════════════════════════════════════════════════
    //  MILESTONE ACTIONS
    // ════════════════════════════════════════════════

    function deliverMilestone(uint256 escrowId, uint256 milestoneIndex)
        external
        onlySeller(escrowId)
        inState(escrowId, EscrowState.Active)
        milestoneExists(escrowId, milestoneIndex)
    {
        Milestone storage m = milestones[escrowId][milestoneIndex];
        if (m.released) revert MilestoneAlreadyReleased();
        m.sellerDelivered = true;
        emit MilestoneDelivered(escrowId, milestoneIndex);
    }

    function approveMilestone(uint256 escrowId, uint256 milestoneIndex)
        external
        onlyBuyer(escrowId)
        inState(escrowId, EscrowState.Active)
        milestoneExists(escrowId, milestoneIndex)
    {
        Milestone storage m = milestones[escrowId][milestoneIndex];
        if (m.released) revert MilestoneAlreadyReleased();
        if (!m.sellerDelivered) revert MilestoneNotDelivered();
        m.buyerApproved = true;
        emit MilestoneApproved(escrowId, milestoneIndex);

        // Auto-release if both parties agree (buyer approved + seller delivered)
        if (m.sellerDelivered && m.buyerApproved) {
            _releaseMilestoneFunds(escrowId, milestoneIndex);
        }
    }

    // ════════════════════════════════════════════════
    //  ADMIN APPROVAL (KEY NEW FEATURE)
    // ════════════════════════════════════════════════

    /**
     * @notice Admin approves a milestone release when both parties have agreed
     *         or when the escrow is stuck and needs admin intervention.
     * @dev Can be called when:
     *   - Both buyer and seller have agreed (buyerApproved + sellerDelivered)
     *   - Escrow is in DISPUTED state and admin resolves without arbiter
     *   - Escrow deadline has passed and admin intervenes
     */
    function adminApproveMilestone(uint256 escrowId, uint256 milestoneIndex)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        milestoneExists(escrowId, milestoneIndex)
    {
        Escrow storage e = escrows[escrowId];
        Milestone storage m = milestones[escrowId][milestoneIndex];

        if (m.released) revert MilestoneAlreadyReleased();

        m.adminApproved = true;
        emit AdminMilestoneApproved(escrowId, milestoneIndex, msg.sender);

        // If both parties agreed OR admin is force-approving, release the funds
        if ((m.sellerDelivered && m.buyerApproved) || e.state == EscrowState.Disputed) {
            _releaseMilestoneFunds(escrowId, milestoneIndex);
            emit AdminForceRelease(escrowId, milestoneIndex, msg.sender);
        }
    }

    /**
     * @notice Admin force-releases a specific milestone regardless of state.
     *         Use when deadline passed, party is unresponsive, or emergency.
     */
    function adminForceRelease(uint256 escrowId, uint256 milestoneIndex)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        milestoneExists(escrowId, milestoneIndex)
    {
        Escrow storage e = escrows[escrowId];
        Milestone storage m = milestones[escrowId][milestoneIndex];

        if (m.released) revert MilestoneAlreadyReleased();

        // Force release - bypass all checks
        _releaseMilestoneFunds(escrowId, milestoneIndex);
        emit AdminForceRelease(escrowId, milestoneIndex, msg.sender);

        // If dispute was active, resolve it
        if (e.state == EscrowState.Disputed) {
            e.state = EscrowState.Active;
        }
    }

    /**
     * @notice Admin approves all pending milestones for an escrow at once.
     *         Use when transaction is fully completed and admin finalizes.
     */
    function adminApproveAllMilestones(uint256 escrowId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        Escrow storage e = escrows[escrowId];

        for (uint256 i = 0; i < e.milestoneCount; i++) {
            Milestone storage m = milestones[escrowId][i];
            if (!m.released && (m.sellerDelivered || m.buyerApproved || e.state == EscrowState.Disputed)) {
                m.adminApproved = true;
                _releaseMilestoneFunds(escrowId, i);
                emit AdminForceRelease(escrowId, i, msg.sender);
            }
        }
    }

    // ════════════════════════════════════════════════
    //  DISPUTE RESOLUTION
    // ════════════════════════════════════════════════

    function initiateDispute(uint256 escrowId, uint256 milestoneIndex)
        external
        onlyParticipant(escrowId)
        inState(escrowId, EscrowState.Active)
        milestoneExists(escrowId, milestoneIndex)
    {
        Milestone storage m = milestones[escrowId][milestoneIndex];
        if (m.released) revert MilestoneAlreadyReleased();
        if (m.disputed) revert MilestoneNotDisputed();

        if (escrows[escrowId].mode == EscrowMode.Locked) {
            if (block.timestamp > escrows[escrowId].deadline) revert DeadlineExpired();
        }

        m.disputed = true;
        escrows[escrowId].state = EscrowState.Disputed;
        emit DisputeInitiated(escrowId, milestoneIndex, msg.sender);
    }

    function resolveDisputeByArbiter(
        uint256 escrowId,
        uint256 milestoneIndex,
        uint256 buyerBasisPoints
    )
        external
        nonReentrant
        onlyRole(ARBITER_ROLE)
        inState(escrowId, EscrowState.Disputed)
        milestoneExists(escrowId, milestoneIndex)
    {
        Escrow storage e = escrows[escrowId];
        if (msg.sender != e.arbiter) revert NotArbiter();
        if (buyerBasisPoints > 10000) revert InvalidBasisPoints();

        _splitMilestoneFunds(escrowId, milestoneIndex, buyerBasisPoints);
    }

    // ════════════════════════════════════════════════
    //  REFUNDS
    // ════════════════════════════════════════════════

    function claimRefund(uint256 escrowId)
        external
        nonReentrant
        onlyBuyer(escrowId)
    {
        Escrow storage e = escrows[escrowId];
        if (e.state != EscrowState.Funded && e.state != EscrowState.Active)
            revert InvalidState(e.state, EscrowState.Funded);

        if (e.state == EscrowState.Active) {
            if (e.deadline == 0 || block.timestamp <= e.deadline)
                revert DeadlineNotExpired();
        }

        uint256 refundable = e.fundedAmount - e.releasedAmount - e.protocolFeeCollected;
        if (refundable == 0) revert InvalidAmount();

        e.state = EscrowState.Refunded;
        IERC20(e.token).safeTransfer(e.buyer, refundable);
        emit EscrowRefunded(escrowId, refundable);
    }

    function sellerInitiatedRefund(uint256 escrowId)
        external
        nonReentrant
        onlySeller(escrowId)
        inState(escrowId, EscrowState.Active)
    {
        Escrow storage e = escrows[escrowId];
        uint256 refundable = e.fundedAmount - e.releasedAmount - e.protocolFeeCollected;
        if (refundable == 0) revert InvalidAmount();

        e.state = EscrowState.Refunded;
        IERC20(e.token).safeTransfer(e.buyer, refundable);
        emit EscrowRefunded(escrowId, refundable);
    }

    // ════════════════════════════════════════════════
    //  ADMIN / GOVERNANCE
    // ════════════════════════════════════════════════

    function updateFeeConfig(
        uint256 _feeBasisPoints,
        uint256 _maxFeeAbsolute,
        address _feeRecipient
    ) external onlyRole(FEE_MANAGER_ROLE) {
        if (_feeBasisPoints > 1000) revert InvalidBasisPoints();
        if (_feeRecipient == address(0)) revert FeeRecipientZeroAddress();
        feeConfig = ProtocolFeeConfig(_feeBasisPoints, _maxFeeAbsolute, _feeRecipient);
        emit FeeConfigUpdated(_feeBasisPoints, _maxFeeAbsolute, _feeRecipient);
    }

    function blacklistToken(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklistedTokens[_token] = true;
        emit TokenBlacklisted(_token);
    }

    function unblacklistToken(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklistedTokens[_token] = false;
        emit TokenUnblacklisted(_token);
    }

    function setFeaturedToken(address _token, bool _featured) external onlyRole(DEFAULT_ADMIN_ROLE) {
        featuredTokens[_token] = _featured;
        if (_featured) emit TokenFeatured(_token);
    }

    function addArbiter(address _arbiter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(ARBITER_ROLE, _arbiter);
    }

    function removeArbiter(address _arbiter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(ARBITER_ROLE, _arbiter);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ════════════════════════════════════════════════

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    function getMilestone(uint256 escrowId, uint256 milestoneIndex)
        external view returns (Milestone memory)
    {
        return milestones[escrowId][milestoneIndex];
    }

    function getMilestones(uint256 escrowId)
        external view returns (Milestone[] memory)
    {
        uint256 count = escrows[escrowId].milestoneCount;
        Milestone[] memory result = new Milestone[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = milestones[escrowId][i];
        }
        return result;
    }

    function calculateProtocolFee(uint256 amount) public view returns (uint256) {
        uint256 fee = (amount * feeConfig.feeBasisPoints) / 10000;
        if (feeConfig.maxFeeAbsolute > 0 && fee > feeConfig.maxFeeAbsolute) {
            fee = feeConfig.maxFeeAbsolute;
        }
        return fee;
    }

    function getUnreleasedAmount(uint256 escrowId) external view returns (uint256) {
        Escrow storage e = escrows[escrowId];
        return e.fundedAmount - e.releasedAmount - e.protocolFeeCollected;
    }

    // ════════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ════════════════════════════════════════════════

    function _releaseMilestoneFunds(uint256 escrowId, uint256 milestoneIndex) internal {
        Escrow storage e = escrows[escrowId];
        Milestone storage m = milestones[escrowId][milestoneIndex];

        uint256 fee = calculateProtocolFee(m.amount);
        uint256 sellerPayout = m.amount - fee;

        m.released = true;
        e.releasedAmount += sellerPayout;
        e.protocolFeeCollected += fee;

        IERC20(e.token).safeTransfer(e.seller, sellerPayout);
        if (fee > 0) {
            IERC20(e.token).safeTransfer(feeConfig.feeRecipient, fee);
        }

        emit FundsReleased(escrowId, milestoneIndex, sellerPayout);

        if (_allMilestonesReleased(escrowId)) {
            e.state = EscrowState.Completed;
            emit EscrowCompleted(escrowId);
        }
    }

    function _splitMilestoneFunds(
        uint256 escrowId,
        uint256 milestoneIndex,
        uint256 buyerBasisPoints
    ) internal {
        Escrow storage e = escrows[escrowId];
        Milestone storage m = milestones[escrowId][milestoneIndex];

        uint256 fee = calculateProtocolFee(m.amount);
        uint256 distributable = m.amount - fee;

        uint256 buyerShare = (distributable * buyerBasisPoints) / 10000;
        uint256 sellerShare = distributable - buyerShare;

        m.released = true;
        m.disputed = false;
        e.releasedAmount += distributable;
        e.protocolFeeCollected += fee;

        if (buyerShare > 0) {
            IERC20(e.token).safeTransfer(e.buyer, buyerShare);
        }
        if (sellerShare > 0) {
            IERC20(e.token).safeTransfer(e.seller, sellerShare);
        }
        if (fee > 0) {
            IERC20(e.token).safeTransfer(feeConfig.feeRecipient, fee);
        }

        emit DisputeResolved(escrowId, milestoneIndex, buyerShare, sellerShare);

        if (_allMilestonesReleased(escrowId)) {
            e.state = EscrowState.Completed;
            emit EscrowCompleted(escrowId);
        } else {
            e.state = EscrowState.Active;
        }
    }

    function _recalculateMilestones(uint256 escrowId, uint256 actualTotal) internal {
        Escrow storage e = escrows[escrowId];
        uint256 originalTotal = 0;
        for (uint256 i = 0; i < e.milestoneCount; i++) {
            originalTotal += milestones[escrowId][i].amount;
        }

        uint256 remaining = actualTotal;
        for (uint256 i = 0; i < e.milestoneCount; i++) {
            if (i == e.milestoneCount - 1) {
                milestones[escrowId][i].amount = remaining;
            } else {
                uint256 proportional = (milestones[escrowId][i].amount * actualTotal) / originalTotal;
                milestones[escrowId][i].amount = proportional;
                remaining -= proportional;
            }
        }
    }

    function _allMilestonesReleased(uint256 escrowId) internal view returns (bool) {
        Escrow storage e = escrows[escrowId];
        for (uint256 i = 0; i < e.milestoneCount; i++) {
            if (!milestones[escrowId][i].released) return false;
        }
        return true;
    }

    // Allow receiving ETH for native chain support
    receive() external payable {}
}
