// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CreditScore {
    
    // Structs
    struct User {
        string name;
        uint256 creditScore;
        uint256 totalLoans;
        uint256 totalRepayments;
        uint256 defaults;
        uint256 lastUpdated;
        bool isActive;
    }
    
    struct Loan {
        uint256 loanId;
        address borrower;
        uint256 principal;
        uint256 interestRate;
        uint256 issueDate;
        uint256 dueDate;
        uint256 repaidAmount;
        uint256 totalAmountToRepay;
        bool isRepaid;
        bool isDefaulted;
    }
    
    struct FinancialActivity {
        string activityType;
        uint256 amount;
        string description;
        uint256 timestamp;
    }

    // Loan Request structure for user-submitted loan proposals
    struct LoanRequest {
        uint256 requestId;
        address borrower;
        uint256 amount;
        uint256 interestRate;
        uint256 durationDays;
        string reason;
        bool isApproved;
        bool isActive;
    }
    
    // State Variables
    address public admin;
    uint256 private loanCounter;
    uint256 private requestCounter;
    
    mapping(address => User) public users;
    mapping(address => Loan[]) public userLoans;
    mapping(address => FinancialActivity[]) public financialHistory;
    mapping(uint256 => address) public loanBorrower;
    mapping(address => bool) public registeredUsers;
    mapping(address => LoanRequest[]) public loanRequests;
    
    // Staking (Collateral) Mapping
    mapping(address => uint256) public stakes;
    
    // Oracle Integration (Simulated) - External scores from off-chain data
    mapping(address => uint256) public externalScores;
    
    // User Registry - List of all registered users
    address[] public userList;
    
    // Events
    event UserRegistered(address indexed user, string name, uint256 timestamp);
    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 interestRate, uint256 dueDate);
    event RepaymentRecorded(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 timestamp);
    event DefaultRecorded(uint256 indexed loanId, address indexed borrower, uint256 timestamp);
    event CreditScoreUpdated(address indexed user, uint256 newScore, uint256 timestamp);
    event LoanRequested(uint256 indexed requestId, address indexed borrower, uint256 amount, uint256 interestRate, uint256 durationDays, string reason);
    event LoanApproved(uint256 indexed requestId, uint256 indexed loanId, address indexed borrower);
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp);
    event ExternalScoreUpdated(address indexed user, uint256 score, uint256 timestamp);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }
    
    // Renamed to avoid clash with function userExists
    modifier onlyRegistered(address _user) {
        require(registeredUsers[_user], "User does not exist");
        _;
    }
    
    // Constructor
    constructor() {
        admin = msg.sender;
        loanCounter = 1;
        requestCounter = 1;
    }
    
    // User Registration
    function registerUser(string memory _name) public {
        require(!registeredUsers[msg.sender], "User already registered");
        require(bytes(_name).length > 0, "Name cannot be empty");
        
        users[msg.sender] = User({
            name: _name,
            creditScore: 600,
            totalLoans: 0,
            totalRepayments: 0,
            defaults: 0,
            lastUpdated: block.timestamp,
            isActive: true
        });
        
        registeredUsers[msg.sender] = true;
        userList.push(msg.sender); // Add to user registry
        
        financialHistory[msg.sender].push(FinancialActivity({
            activityType: "Registration",
            amount: 0,
            description: "User registered on platform",
            timestamp: block.timestamp
        }));
        
        emit UserRegistered(msg.sender, _name, block.timestamp);
    }
    
    // Internal shared loan creation logic
    function _createLoan(
        address _borrower,
        uint256 _principal,
        uint256 _interestRate,
        uint256 _durationDays
    ) internal {
        uint256 dueDate = block.timestamp + (_durationDays * 1 days);
        uint256 totalAmountToRepay = _principal + ((_principal * _interestRate) / 100);
        
        Loan memory newLoan = Loan({
            loanId: loanCounter,
            borrower: _borrower,
            principal: _principal,
            interestRate: _interestRate,
            issueDate: block.timestamp,
            dueDate: dueDate,
            repaidAmount: 0,
            totalAmountToRepay: totalAmountToRepay,
            isRepaid: false,
            isDefaulted: false
        });
        userLoans[_borrower].push(newLoan);
        loanBorrower[loanCounter] = _borrower;
        if (registeredUsers[_borrower]) {
            users[_borrower].totalLoans += 1;
            financialHistory[_borrower].push(FinancialActivity({
                activityType: "Loan Created",
                amount: _principal,
                description: string(abi.encodePacked("Loan #", uint2str(loanCounter), " created")),
                timestamp: block.timestamp
            }));
            updateCreditScore(_borrower);
        }
        emit LoanCreated(loanCounter, _borrower, _principal, _interestRate, dueDate);
        loanCounter += 1;
    }

    // User requests a loan (must be registered)
    function requestLoan(
        uint256 _amount,
        uint256 _interestRate,
        uint256 _durationDays,
        string memory _reason
    ) public {
        require(registeredUsers[msg.sender], "User not registered");
        require(_amount > 0, "Amount must be > 0");
        require(_interestRate <= 100, "Invalid interest rate");
        require(_durationDays > 0, "Duration must be > 0");
        require(bytes(_reason).length > 0, "Reason required");

        LoanRequest memory lr = LoanRequest({
            requestId: requestCounter,
            borrower: msg.sender,
            amount: _amount,
            interestRate: _interestRate,
            durationDays: _durationDays,
            reason: _reason,
            isApproved: false,
            isActive: true
        });
        loanRequests[msg.sender].push(lr);
        emit LoanRequested(requestCounter, msg.sender, _amount, _interestRate, _durationDays, _reason);
        requestCounter += 1;
    }

    // Admin approves a specific loan request
    function approveLoan(address _borrower, uint256 _requestIndex) public onlyAdmin {
        require(registeredUsers[_borrower], "Borrower not registered");
        require(_requestIndex < loanRequests[_borrower].length, "Invalid request index");
        LoanRequest storage req = loanRequests[_borrower][_requestIndex];
        require(req.isActive, "Request inactive");
        require(!req.isApproved, "Already approved");

        req.isApproved = true;
        req.isActive = false;

        _createLoan(_borrower, req.amount, req.interestRate, req.durationDays);

        emit LoanApproved(req.requestId, loanCounter - 1, _borrower);
    }
    
    // Record Repayment (User sends ETH)
    function recordRepayment(uint256 _loanId) public payable {
        require(msg.value > 0, "Amount must be greater than 0");
        
        address borrower = loanBorrower[_loanId];
        require(borrower != address(0), "Loan does not exist");
        require(msg.sender == borrower, "Only borrower can record repayment");
        
        Loan storage loan = userLoans[borrower][findLoanIndex(borrower, _loanId)];
        require(!loan.isRepaid, "Loan already repaid");
        require(!loan.isDefaulted, "Cannot repay defaulted loan");
        
        // Strict validation: prevent overpayment - revert transaction
        uint256 remainingBalance = loan.totalAmountToRepay - loan.repaidAmount;
        require(msg.value <= remainingBalance, "Payment exceeds amount owed");
        
        loan.repaidAmount += msg.value;
        
        // Auto-close loan if fully repaid
        if (loan.repaidAmount == loan.totalAmountToRepay) {
            loan.isRepaid = true;
        }
        
        if (registeredUsers[borrower]) {
            users[borrower].totalRepayments += msg.value;
            financialHistory[borrower].push(FinancialActivity({
                activityType: "Repayment",
                amount: msg.value,
                description: string(abi.encodePacked("Repayment for Loan #", uint2str(_loanId))),
                timestamp: block.timestamp
            }));
            
            updateCreditScore(borrower);
        }
        
        emit RepaymentRecorded(_loanId, borrower, msg.value, block.timestamp);
    }
    
    // Record Late Payment (Admin Only)
    function recordLatePayment(uint256 _loanId) public onlyAdmin {
        address borrower = loanBorrower[_loanId];
        require(borrower != address(0), "Loan does not exist");
        
        Loan storage loan = userLoans[borrower][findLoanIndex(borrower, _loanId)];
        require(!loan.isRepaid, "Cannot mark late payment on closed loan");
        require(block.timestamp > loan.dueDate, "Cannot mark late before due date");
        require(!loan.isDefaulted, "Loan already defaulted");
        
        if (registeredUsers[borrower]) {
            financialHistory[borrower].push(FinancialActivity({
                activityType: "Late Payment",
                amount: loan.totalAmountToRepay - loan.repaidAmount,
                description: string(abi.encodePacked("Late payment recorded for Loan #", uint2str(_loanId))),
                timestamp: block.timestamp
            }));
            updateCreditScore(borrower);
        }
    }
    
    // Record Default (Admin Only)
    function recordDefault(uint256 _loanId) public onlyAdmin {
        address borrower = loanBorrower[_loanId];
        require(borrower != address(0), "Loan does not exist");
        
        Loan storage loan = userLoans[borrower][findLoanIndex(borrower, _loanId)];
        require(!loan.isRepaid, "Cannot default on repaid loan");
        require(!loan.isDefaulted, "Loan already marked as default");
        require(block.timestamp > loan.dueDate, "Cannot default before due date");
        
        loan.isDefaulted = true;
        
        if (registeredUsers[borrower]) {
            users[borrower].defaults += 1;
            financialHistory[borrower].push(FinancialActivity({
                activityType: "Default",
                amount: loan.principal - loan.repaidAmount,
                description: string(abi.encodePacked("Default on Loan #", uint2str(_loanId))),
                timestamp: block.timestamp
            }));
            updateCreditScore(borrower);
        }
        
        emit DefaultRecorded(_loanId, borrower, block.timestamp);
    }
    
    // Get Credit Score
    function getCreditScore(address _user) public view returns (uint256) {
        if (!registeredUsers[_user]) {
            return 0;
        }
        return users[_user].creditScore;
    }
    
    // Get Credit Score Breakdown
    function getCreditScoreBreakdown(address _user) public view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        if (!registeredUsers[_user]) {
            return (0, 0, 0, 0, 0, 0);
        }
        
        User storage user = users[_user];
        uint256 totalLoans = user.totalLoans;
        uint256 defaults = user.defaults;
        uint256 repaymentConsistency = totalLoans > 0 ? ((totalLoans - defaults) * 100) / totalLoans : 0;
        
        // Payment History (35% of base score)
        uint256 paymentHistoryScore = 350 - (defaults * 50);
        if (paymentHistoryScore < 0) paymentHistoryScore = 0;
        if (paymentHistoryScore > 350) paymentHistoryScore = 350;
        
        // Repayment Consistency (25% of base score)
        uint256 repaymentConsistencyScore = (repaymentConsistency * 250) / 100;
        if (repaymentConsistencyScore > 250) repaymentConsistencyScore = 250;
        
        // Loan Activity (20% of base score)
        uint256 loanActivityScore = totalLoans > 0 ? (totalLoans * 200) / 10 : 0;
        if (loanActivityScore > 200) loanActivityScore = 200;
        
        // NEW: Collateral Score - Staking bonus (up to 50 points)
        uint256 collateralScore = 0;
        if (stakes[_user] >= 0.01 ether) {
            collateralScore = 50;
        }
        
        // NEW: External Score - Oracle data (up to 50 points)
        uint256 oracleScore = externalScores[_user];
        if (oracleScore > 50) oracleScore = 50;
        
        // Total Score (Max 900: 350+250+200+50+50)
        uint256 totalScore = paymentHistoryScore + repaymentConsistencyScore + loanActivityScore + collateralScore + oracleScore;
        if (totalScore > 900) totalScore = 900;
        
        return (paymentHistoryScore, repaymentConsistencyScore, loanActivityScore, collateralScore, oracleScore, totalScore);
    }
    
    // Get Financial History
    function getFinancialHistory(address _user) public view onlyRegistered(_user) returns (FinancialActivity[] memory) {
        return financialHistory[_user];
    }
    
    // Get User Loans
    function getUserLoans(address _user) public view onlyRegistered(_user) returns (Loan[] memory) {
        return userLoans[_user];
    }
    
    // Check if user exists (frontend relies on this)
    function userExists(address _user) public view returns (bool) {
        return registeredUsers[_user];
    }
    
    // Update Credit Score (Internal)
    function updateCreditScore(address _user) internal {
        if (!registeredUsers[_user]) {
            return;
        }
        
        User storage user = users[_user];
        (,,,, , uint256 newScore) = getCreditScoreBreakdown(_user);
        
        user.creditScore = newScore;
        user.lastUpdated = block.timestamp;
        
        emit CreditScoreUpdated(_user, newScore, block.timestamp);
    }
    
    // Find Loan Index (Internal)
    function findLoanIndex(address _borrower, uint256 _loanId) internal view returns (uint256) {
        Loan[] storage loans = userLoans[_borrower];
        for (uint256 i = 0; i < loans.length; i++) {
            if (loans[i].loanId == _loanId) {
                return i;
            }
        }
        revert("Loan not found");
    }
    
    // Utility: Convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bstr[k] = bytes1(temp);
            _i /= 10;
        }
        
        return string(bstr);
    }
    
    // Admin Functions
    function getAdmin() public view returns (address) {
        return admin;
    }
    
    function getUserInfo(address _user) public view returns (User memory) {
        require(registeredUsers[_user], "User does not exist");
        return users[_user];
    }
    
    function getLoanCount() public view returns (uint256) {
        return loanCounter - 1;
    }

    // Getter to fetch all loan requests for a user
    function getLoanRequests(address _user) public view returns (LoanRequest[] memory) {
        return loanRequests[_user];
    }
    
    // Get all registered users (for admin)
    function getAllUsers() public view returns (address[] memory) {
        return userList;
    }

    // ========== STAKING FUNCTIONS (COLLATERAL) ==========
    
    // Stake ETH as collateral
    function stake() public payable {
        require(msg.value > 0, "Must stake a positive amount");
        require(registeredUsers[msg.sender], "Must be registered to stake");
        
        stakes[msg.sender] += msg.value;
        
        financialHistory[msg.sender].push(FinancialActivity({
            activityType: "Stake",
            amount: msg.value,
            description: "Staked ETH as collateral",
            timestamp: block.timestamp
        }));
        
        // Update credit score to reflect new collateral
        updateCreditScore(msg.sender);
        
        emit Staked(msg.sender, msg.value, block.timestamp);
    }
    
    // Unstake ETH (withdraw collateral)
    function unstake(uint256 _amount) public {
        require(registeredUsers[msg.sender], "User not registered");
        require(stakes[msg.sender] >= _amount, "Insufficient staked balance");
        require(_amount > 0, "Amount must be greater than 0");
        
        // Check if user has any active loans
        Loan[] storage userLoanArray = userLoans[msg.sender];
        for (uint256 i = 0; i < userLoanArray.length; i++) {
            require(userLoanArray[i].isRepaid || userLoanArray[i].isDefaulted, 
                "Cannot unstake while you have active loans");
        }
        
        stakes[msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);
        
        financialHistory[msg.sender].push(FinancialActivity({
            activityType: "Unstake",
            amount: _amount,
            description: "Withdrew staked ETH",
            timestamp: block.timestamp
        }));
        
        // Update credit score to reflect reduced collateral
        updateCreditScore(msg.sender);
        
        emit Unstaked(msg.sender, _amount, block.timestamp);
    }
    
    // ========== ORACLE INTEGRATION (SIMULATED) ==========
    
    // Admin updates external credit score (simulating Chainlink oracle)
    function updateExternalScore(address _user, uint256 _score) public onlyAdmin {
        require(registeredUsers[_user], "User not registered");
        require(_score <= 50, "External score cannot exceed 50 points");
        
        externalScores[_user] = _score;
        
        financialHistory[_user].push(FinancialActivity({
            activityType: "Oracle Update",
            amount: _score,
            description: "External credit score updated by oracle",
            timestamp: block.timestamp
        }));
        
        // Update total credit score
        updateCreditScore(_user);
        
        emit ExternalScoreUpdated(_user, _score, block.timestamp);
    }
}