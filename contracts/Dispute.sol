// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

error Dispute__Invalid();

enum DisputeStatus {
    Open,
    Voting,
    Resolved,
    Appealed,
    Closed
}
enum Vote {
    None,
    RequesterWins,
    ExecutorWins,
    Split
}

struct DisputeData {
    bytes32 escrowId;
    address requester;
    address executor;
    string reason;
    string requesterEvidence;
    string executorEvidence;
    uint256 createdAt;
    uint256 votingEndTime;
    uint256 requesterVotes;
    uint256 executorVotes;
    DisputeStatus status;
    Vote result;
    bool appealed;
}

struct Juror {
    address juror;
    uint256 stakedAmount;
    bool active;
}

struct VoteRecord {
    address voter;
    Vote vote;
    uint256 timestamp;
}

contract KubernaDispute is Ownable, ReentrancyGuard {
    // counts how many disputes have been opened
    uint256 public disputeCount;
    uint256 public immutable VOTING_PERIOD = 7 days;
    uint256 public immutable APPEAL_PERIOD = 3 days;
    uint256 public immutable MIN_JUROR_STAKE = 100 ether;
    uint256 public immutable JUROR_REWARD = 10 ether;

    mapping(bytes32 => DisputeData) public disputes;
    mapping(bytes32 => VoteRecord[]) public disputeVotes;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    mapping(bytes32 => mapping(address => uint256)) public pendingRewards;
    mapping(address => Juror) public jurors;
    address[] public jurorList;

    // Track if an escrow already has an active dispute to prevent duplicates
    mapping(bytes32 => bool) public escrowHasActiveDispute;

    event RewardClaimed(address indexed juror, uint256 amount);

    event DisputeOpened(bytes32 disputeId, bytes32 escrowId, address requester, address executor);
    event VoteCast(bytes32 disputeId, address voter, Vote vote);
    event DisputeResolved(bytes32 disputeId, Vote result);
    event DisputeAppealed(bytes32 disputeId);
    event JurorRegistered(address juror);
    event JurorUnregistered(address juror, uint256 amount);

    constructor() {
        // Ownable sets owner to msg.sender in its constructor; no manual args needed
    }

    function registerJuror(address juror) external payable {
        require(msg.value >= MIN_JUROR_STAKE, "Insufficient stake");
        require(!jurors[juror].active, "Already an active juror");

        jurors[juror] = Juror(juror, msg.value, true);
        jurorList.push(juror);

        emit JurorRegistered(juror);
    }

    function unstakeJuror() external nonReentrant {
        Juror storage j = jurors[msg.sender];
        require(j.active, "Not an active juror");
        require(j.stakedAmount > 0, "No stake to withdraw");

        uint256 amount = j.stakedAmount;
        j.active = false;
        j.stakedAmount = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");

        emit JurorUnregistered(msg.sender, amount);
    }

    function openDispute(
        bytes32 escrowId,
        address requester,
        address executor,
        string calldata reason
    ) external onlyOwner returns (bytes32) {
        // Prevent multiple active disputes for the same escrow
        require(!escrowHasActiveDispute[escrowId], "Active dispute exists for escrow");

        bytes32 disputeId = keccak256(abi.encodePacked(escrowId, block.timestamp, msg.sender));

        disputes[disputeId] = DisputeData({
            escrowId: escrowId,
            requester: requester,
            executor: executor,
            reason: reason,
            requesterEvidence: "",
            executorEvidence: "",
            createdAt: block.timestamp,
            votingEndTime: block.timestamp + VOTING_PERIOD,
            requesterVotes: 0,
            executorVotes: 0,
            status: DisputeStatus.Voting,
            result: Vote.None,
            appealed: false
        });

        escrowHasActiveDispute[escrowId] = true;
        unchecked { disputeCount++; }

        emit DisputeOpened(disputeId, escrowId, requester, executor);
        return disputeId;
    }

    function submitEvidence(bytes32 disputeId, string calldata evidence, bool isRequester) external {
        DisputeData storage d = disputes[disputeId];
        require(d.createdAt != 0, "Dispute not found");
        require(d.status == DisputeStatus.Voting, "Not in voting state");
        require(bytes(evidence).length <= 1000, "Evidence too long");

        if (isRequester) {
            require(msg.sender == d.requester, "Only requester can submit requester evidence");
            d.requesterEvidence = evidence;
        } else {
            require(msg.sender == d.executor, "Only executor can submit executor evidence");
            d.executorEvidence = evidence;
        }
    }

    function vote(bytes32 disputeId, Vote support) external {
        DisputeData storage d = disputes[disputeId];
        require(d.createdAt != 0, "Dispute not found");
        require(d.status == DisputeStatus.Voting, "Not in voting state");
        require(block.timestamp < d.votingEndTime, "Voting period ended");
        require(jurors[msg.sender].active, "Not a juror");
        require(!hasVoted[disputeId][msg.sender], "Already voted");

        hasVoted[disputeId][msg.sender] = true;
        disputeVotes[disputeId].push(VoteRecord(msg.sender, support, block.timestamp));

        if (support == Vote.RequesterWins) {
            unchecked { d.requesterVotes++; }
        } else if (support == Vote.ExecutorWins) {
            unchecked { d.executorVotes++; }
        }

        emit VoteCast(disputeId, msg.sender, support);
    }

    function resolveDispute(bytes32 disputeId) external nonReentrant {
        DisputeData storage d = disputes[disputeId];
        require(d.createdAt != 0, "Dispute not found");
        require(d.status == DisputeStatus.Voting, "Not in voting state");
        require(block.timestamp >= d.votingEndTime, "Voting not ended");

        if (d.requesterVotes > d.executorVotes) d.result = Vote.RequesterWins;
        else if (d.executorVotes > d.requesterVotes) d.result = Vote.ExecutorWins;
        else d.result = Vote.Split;

        d.status = DisputeStatus.Resolved;
        _rewardJurors(disputeId);

        // mark escrow as no longer having an active dispute
        escrowHasActiveDispute[d.escrowId] = false;

        emit DisputeResolved(disputeId, d.result);
    }

    function appealDispute(bytes32 disputeId) external payable {
        DisputeData storage d = disputes[disputeId];
        require(d.createdAt != 0, "Dispute not found");
        require(d.status == DisputeStatus.Resolved, "Not resolved");
        require(!d.appealed, "Already appealed");
        require(msg.sender == d.requester || msg.sender == d.executor, "Only parties can appeal");
        require(msg.value >= 1 ether, "Insufficient appeal fee");

        d.appealed = true;
        d.status = DisputeStatus.Appealed;
        d.votingEndTime = block.timestamp + APPEAL_PERIOD;

        emit DisputeAppealed(disputeId);
    }

    function _rewardJurors(bytes32 disputeId) internal {
        VoteRecord[] storage votes = disputeVotes[disputeId];
        Vote result = disputes[disputeId].result;

        for (uint256 i = 0; i < votes.length; i++) {
            uint256 reward = votes[i].vote == result ? JUROR_REWARD * 2 : JUROR_REWARD;
            pendingRewards[disputeId][votes[i].voter] += reward;
        }
    }

    function claimReward(bytes32 disputeId) external nonReentrant {
        uint256 reward = pendingRewards[disputeId][msg.sender];
        require(reward > 0, "No pending reward");
        pendingRewards[disputeId][msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: reward}("");
        require(sent, "Transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    function getDispute(bytes32 disputeId) external view returns (DisputeData memory) {
        return disputes[disputeId];
    }
    function getVoteCount(bytes32 disputeId) external view returns (uint256) {
        return disputeVotes[disputeId].length;
    }
    function getJurors() external view returns (address[] memory) {
        return jurorList;
    }

    receive() external payable {}
}
